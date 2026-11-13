/**
 * RED MISSION — Production-Grade SQLite Backup & Recovery Management Utility
 * Strict Zero-Dependency native Node.js implementation using node:sqlite DatabaseSync.
 * 
 * Features:
 * 1. Safe online atomic snapshots via SQLite core 'VACUUM INTO' (WAL-mode safe).
 * 2. Strict read-only access to source database (guarantees zero mutation to source).
 * 3. Overwrite protection (prevents replacing or corrupting existing backups).
 * 4. Fix 1: Exclusive private staging directory allocation & deterministic cleanup
 *    (established via atomic mkdir, collision retry, zero risk to pre-existing files).
 * 5. Fix 2: Ordered two-phase publication with atomic rollback (never leaves orphaned .db on manifest publish failure).
 * 6. Pre-backup disk space verification via fs.statfsSync with safe fallback.
 * 7. Self-verifying: executes PRAGMA integrity_check and PRAGMA foreign_key_check on backup.
 * 8. Structured Backup Manifest generation (metadata, hash/size, migrations, disk check, zero secrets).
 * 9. Hardened restore simulation: fail-closed junction/symlink protection, Fix 3: comment-aware and
 *    literal-preserving sqlite_master schema comparison (tables, indexes, views, triggers, case-preserving literals).
 */

import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Format timestamp for safe, sortable filenames: YYYYMMDD_HHMMSS
 */
export function formatTimestamp(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  const yyyy = date.getFullYear();
  const MM = pad(date.getMonth() + 1);
  const dd = pad(date.getDate());
  const HH = pad(date.getHours());
  const mm = pad(date.getMinutes());
  const ss = pad(date.getSeconds());
  return `${yyyy}${MM}${dd}_${HH}${mm}${ss}`;
}

/**
 * Generate standardized timestamped backup filenames
 */
export function generateBackupFilename(prefix = 'red_mission_backup', date = new Date()) {
  const ts = formatTimestamp(date);
  return `${prefix}_${ts}.db`;
}

/**
 * Escape file path string for SQLite SQL statement
 */
export function toSqlSafePath(filePath) {
  // Normalize Windows backslashes to forward slashes and escape single quotes
  return filePath.replace(/\\/g, '/').replace(/'/g, "''");
}

/**
 * Resolve the physical filesystem path, dereferencing symbolic links
 * and Windows directory junctions across existing parent directories.
 * 
 * Fail-Closed: If physical resolution is uncertain, broken, or encounters
 * filesystem permission errors, throws a clear safety error instead of silently
 * returning an unverified lexical path.
 */
export function resolvePhysicalPath(inputPath) {
  if (!inputPath || typeof inputPath !== 'string') {
    throw new Error('Path must be a non-empty string for physical resolution.');
  }

  const resolved = path.resolve(inputPath);

  // If the path itself exists as a symlink (or broken symlink), verify it directly
  try {
    const lstat = fs.lstatSync(resolved);
    if (lstat.isSymbolicLink()) {
      try {
        return fs.realpathSync(resolved);
      } catch (linkErr) {
        throw new Error(`Safety error: Path '${inputPath}' is an unresolvable or broken symbolic link: ${linkErr.message}. Path resolution fails closed.`);
      }
    }
  } catch (statErr) {
    if (statErr.code !== 'ENOENT') {
      throw new Error(`Safety error: Failed to inspect path '${inputPath}': ${statErr.message}. Path resolution fails closed.`);
    }
    // ENOENT: file/folder does not exist yet; proceed to check ancestor chain
  }

  let curr = resolved;
  const missingSegments = [];

  while (!fs.existsSync(curr) && curr !== path.dirname(curr)) {
    // If an intermediate missing segment is actually a broken symlink:
    try {
      const lstat = fs.lstatSync(curr);
      if (lstat.isSymbolicLink()) {
        throw new Error(`Safety error: Ancestor '${curr}' is an unresolvable or broken symbolic link. Path resolution fails closed.`);
      }
    } catch (err) {
      if (err.code !== 'ENOENT') {
        throw new Error(`Safety error: Failed to inspect ancestor '${curr}': ${err.message}. Path resolution fails closed.`);
      }
    }

    missingSegments.unshift(path.basename(curr));
    curr = path.dirname(curr);
  }

  if (fs.existsSync(curr)) {
    let real;
    try {
      real = fs.realpathSync(curr);
    } catch (err) {
      throw new Error(`Safety error: Failed to physically resolve existing ancestor '${curr}' for path '${inputPath}': ${err.message}. Path resolution fails closed.`);
    }
    return path.resolve(real, ...missingSegments);
  }

  throw new Error(`Safety error: Cannot confirm physical existence of root ancestor for path '${inputPath}'. Path resolution fails closed.`);
}

/**
 * Helper to retrieve the previous non-whitespace token
 */
function getPrevNonWhitespaceToken(tokens, idx) {
  for (let k = idx - 1; k >= 0; k--) {
    if (tokens[k].type !== 'whitespace') return tokens[k];
  }
  return null;
}

/**
 * Fix 2: SQL Comment-Aware & Literal-Preserving Normalization
 * 
 * Tokenizes SQL statements with full awareness of:
 * - Line comments ('-- ...') until newline or EOF.
 * - Block comments ('/* ... * /') with nesting termination.
 * - Single-quoted string literals ('...'), preserving contents, casing, and escaped quotes ('').
 * - Quoted identifiers ("...", `...`, [...]), preserving casing conservatively.
 * - SQL keywords and unquoted identifiers (lowercased).
 * - Multi-character and single-character operators and punctuation.
 * - If malformed or unterminated constructs are encountered, returns a raw tagged marker
 *   to ensure conservative mismatch detection.
 */
export function normalizeSql(sql) {
  if (!sql || typeof sql !== 'string') return '';

  const tokens = [];
  let i = 0;
  const n = sql.length;
  let isMalformed = false;

  while (i < n) {
    const ch = sql[i];
    const nextCh = i + 1 < n ? sql[i + 1] : '';

    // 1. Line comment: starts with '--'
    if (ch === '-' && nextCh === '-') {
      i += 2;
      while (i < n && sql[i] !== '\n' && sql[i] !== '\r') {
        i++;
      }
      tokens.push({ type: 'whitespace', value: ' ' });
      continue;
    }

    // 2. Block comment: starts with '/*'
    if (ch === '/' && nextCh === '*') {
      i += 2;
      let terminated = false;
      while (i < n) {
        if (sql[i] === '*' && i + 1 < n && sql[i + 1] === '/') {
          i += 2;
          terminated = true;
          break;
        }
        i++;
      }
      if (!terminated) {
        isMalformed = true;
        tokens.push({ type: 'malformed_comment', value: sql.slice(i) });
        break;
      }
      tokens.push({ type: 'whitespace', value: ' ' });
      continue;
    }

    // 3. Whitespace
    if (/\s/.test(ch)) {
      while (i < n && /\s/.test(sql[i])) i++;
      tokens.push({ type: 'whitespace', value: ' ' });
      continue;
    }

    // 4. Single-quoted literal ('...'), supporting '' escapes
    if (ch === "'") {
      let str = "'";
      i++;
      let terminated = false;
      while (i < n) {
        if (sql[i] === "'") {
          if (i + 1 < n && sql[i + 1] === "'") {
            str += "''";
            i += 2;
          } else {
            str += "'";
            i++;
            terminated = true;
            break;
          }
        } else {
          str += sql[i];
          i++;
        }
      }
      if (!terminated) {
        isMalformed = true;
        tokens.push({ type: 'malformed_literal', value: str });
        break;
      }
      tokens.push({ type: 'literal', value: str });
      continue;
    }

    // 5. Quoted identifier: double quotes "...", backticks `...`
    if (ch === '"' || ch === '`') {
      const q = ch;
      let qid = q;
      i++;
      let terminated = false;
      while (i < n) {
        if (sql[i] === q) {
          if (i + 1 < n && sql[i + 1] === q) {
            qid += q + q;
            i += 2;
          } else {
            qid += q;
            i++;
            terminated = true;
            break;
          }
        } else {
          qid += sql[i];
          i++;
        }
      }
      if (!terminated) {
        isMalformed = true;
        tokens.push({ type: 'malformed_ident', value: qid });
        break;
      }
      tokens.push({ type: 'quoted_ident', value: qid });
      continue;
    }

    // 6. Bracket-quoted identifier: [...]
    if (ch === '[') {
      let qid = '[';
      i++;
      let terminated = false;
      while (i < n) {
        if (sql[i] === ']') {
          qid += ']';
          i++;
          terminated = true;
          break;
        } else {
          qid += sql[i];
          i++;
        }
      }
      if (!terminated) {
        isMalformed = true;
        tokens.push({ type: 'malformed_bracket', value: qid });
        break;
      }
      tokens.push({ type: 'quoted_ident', value: qid });
      continue;
    }

    // 7. Word (keyword / unquoted identifier / number)
    if (/[a-zA-Z0-9_]/.test(ch)) {
      let w = '';
      while (i < n && /[a-zA-Z0-9_]/.test(sql[i])) {
        w += sql[i];
        i++;
      }
      tokens.push({ type: 'word', value: w.toLowerCase() });
      continue;
    }

    // 8. Multi-character operators: ||, <=, >=, !=, <>, ==
    if (ch === '|' && nextCh === '|') {
      tokens.push({ type: 'op', value: '||' });
      i += 2;
      continue;
    }
    if ((ch === '<' || ch === '>' || ch === '!') && nextCh === '=') {
      tokens.push({ type: 'op', value: ch + '=' });
      i += 2;
      continue;
    }
    if (ch === '<' && nextCh === '>') {
      tokens.push({ type: 'op', value: '<>' });
      i += 2;
      continue;
    }

    // 9. Single-character punctuation
    tokens.push({ type: 'punct', value: ch });
    i++;
  }

  // If malformed SQL was detected, return a unique raw marker with original text to guarantee mismatch
  if (isMalformed) {
    return `__MALFORMED_SQL__[${sql}]`;
  }

  // Format tokens into normalized canonical string
  let out = '';
  for (let t = 0; t < tokens.length; t++) {
    const tok = tokens[t];
    if (tok.type === 'whitespace') continue;

    const prev = t > 0 ? getPrevNonWhitespaceToken(tokens, t) : null;
    if (!prev) {
      out += tok.value;
      continue;
    }

    let spaceBefore = false;

    if (tok.value === ',' || tok.value === ';') {
      spaceBefore = false;
    } else if (tok.value === '(') {
      spaceBefore = (prev.type === 'word' || prev.type === 'literal' || prev.value === ')');
    } else if (prev.value === '(') {
      spaceBefore = false;
    } else if (tok.value === ')') {
      spaceBefore = false;
    } else if (tok.type === 'op' || prev.type === 'op') {
      spaceBefore = true;
    } else if (prev.value === ',') {
      spaceBefore = true;
    } else if (
      (prev.type === 'word' || prev.type === 'literal' || prev.type === 'quoted_ident') &&
      (tok.type === 'word' || tok.type === 'literal' || tok.type === 'quoted_ident')
    ) {
      spaceBefore = true;
    } else if (prev.value === ')' && (tok.type === 'word' || tok.type === 'literal')) {
      spaceBefore = true;
    } else {
      spaceBefore = true;
    }

    if (spaceBefore) out += ' ';
    out += tok.value;
  }

  return out.trim();
}

/**
 * Check if the target directory has sufficient free disk space.
 * Requires at least 2x source size + 10 MiB safety margin.
 * 
 * @param {string} targetDir - Target directory path.
 * @param {number} requiredBytes - Minimum free bytes required.
 * @returns {{ checked: boolean, freeBytes: number|null, requiredBytes: number, status: string, error?: string }}
 */
export function checkDiskSpace(targetDir, requiredBytes) {
  if (typeof fs.statfsSync !== 'function') {
    return {
      checked: false,
      freeBytes: null,
      requiredBytes,
      status: 'NOT_AVAILABLE'
    };
  }

  try {
    const stats = fs.statfsSync(targetDir);
    const bsize = BigInt(stats.bsize);
    const bavail = BigInt(stats.bavail);
    const freeBytesBigInt = bsize * bavail;
    const reqBigInt = BigInt(requiredBytes);

    if (freeBytesBigInt < reqBigInt) {
      const freeMb = (Number(freeBytesBigInt) / (1024 * 1024)).toFixed(2);
      const reqMb = (Number(reqBigInt) / (1024 * 1024)).toFixed(2);
      throw new Error(`Insufficient disk space in target directory '${targetDir}'. Available: ${freeMb} MB, Required: ${reqMb} MB`);
    }

    return {
      checked: true,
      freeBytes: Number(freeBytesBigInt),
      requiredBytes,
      status: 'PASSED'
    };
  } catch (err) {
    if (err.message && err.message.startsWith('Insufficient disk space')) {
      throw err;
    }
    return {
      checked: false,
      freeBytes: null,
      requiredBytes,
      status: 'NOT_AVAILABLE',
      error: err.message
    };
  }
}

/**
 * Check whether a target path points to or is inside the production data directory,
 * dereferencing all symlinks, junctions, and relative path traversals.
 * Fails closed if physical path resolution throws.
 */
function isProductionDataTarget(targetPath) {
  // Lexical patterns check
  const normalizedInput = path.resolve(targetPath).toLowerCase().replace(/\\/g, '/');
  if (
    normalizedInput.includes('/server/data') ||
    normalizedInput.endsWith('/data')
  ) {
    return true;
  }

  // Physical path check (fails closed if resolvePhysicalPath throws)
  const resolvedPhysical = resolvePhysicalPath(targetPath);
  const normalizedPhysical = resolvedPhysical.toLowerCase().replace(/\\/g, '/');

  if (
    normalizedPhysical.includes('/server/data') ||
    normalizedPhysical.endsWith('/data')
  ) {
    return true;
  }

  // Check against project server/data directory physical path
  try {
    const projectRoot = path.resolve(__dirname, '../..');
    const prodDataDir = path.resolve(projectRoot, 'server', 'data');
    if (fs.existsSync(prodDataDir)) {
      const realProdDataDir = fs.realpathSync(prodDataDir).toLowerCase().replace(/\\/g, '/');
      if (normalizedPhysical === realProdDataDir || normalizedPhysical.startsWith(realProdDataDir + '/')) {
        return true;
      }
    }
  } catch {}

  return false;
}

/**
 * Explicit file identity verification statuses.
 */
export const IdentityStatus = {
  VERIFIED: 'VERIFIED',
  MISMATCH: 'MISMATCH',
  UNAVAILABLE: 'UNAVAILABLE'
};

/**
 * Explicit publication state machine states.
 */
export const PublicationState = {
  INITIAL: 'INITIAL',
  STAGING: 'STAGING',
  STAGED_AND_VERIFIED: 'STAGED_AND_VERIFIED',
  DATABASE_PUBLISHED: 'DATABASE_PUBLISHED',
  MANIFEST_PUBLISHED: 'MANIFEST_PUBLISHED',
  COMMITTED: 'COMMITTED',
  FAILED: 'FAILED'
};

/**
 * Capture filesystem identity metadata for a file to verify ownership.
 * Uses fs.statSync with bigint: true to retrieve 64-bit device ID (dev)
 * and 64-bit inode / NTFS File Reference Number (ino).
 * 
 * Reliable identity strictly requires both dev !== 0n and ino !== 0n.
 * 
 * @param {string} filePath - Path to file.
 * @returns {{ captured: boolean, isReliable: boolean, dev?: bigint, ino?: bigint, size?: bigint, birthtimeNs?: bigint, mtimeNs?: bigint, mode?: number, error?: string }}
 */
export function captureFileIdentity(filePath) {
  try {
    const s = fs.statSync(filePath, { bigint: true });
    const isReliable = (
      typeof s.dev === 'bigint' && s.dev !== 0n &&
      typeof s.ino === 'bigint' && s.ino !== 0n
    );

    return {
      captured: true,
      isReliable,
      dev: s.dev,
      ino: s.ino,
      size: s.size,
      birthtimeNs: s.birthtimeNs,
      mtimeNs: s.mtimeNs,
      mode: s.mode
    };
  } catch (err) {
    return {
      captured: false,
      isReliable: false,
      error: err.message
    };
  }
}

/**
 * Verify whether a destination file demonstrably matches a previously captured identity.
 * 
 * Strict Fail-Closed Policy:
 * 1. If device ID or inode is zero or unavailable on either baseline or current file,
 *    returns UNAVAILABLE.
 * 2. Never uses birthtime, mtime, size, or mode alone as proof of ownership.
 *    Timestamps and file sizes alone are never treated as sufficient identity.
 * 3. Returns VERIFIED only if non-zero device ID and non-zero inode match exactly.
 * 4. Returns MISMATCH if reliable identifiers differ.
 * 
 * @param {Object} baselineIdentity - Output from captureFileIdentity().
 * @param {string} filePath - Path on disk to inspect.
 * @returns {{ status: 'VERIFIED'|'MISMATCH'|'UNAVAILABLE', reason: string }}
 */
export function verifyFileIdentity(baselineIdentity, filePath) {
  if (!baselineIdentity || !baselineIdentity.captured || !baselineIdentity.isReliable) {
    return {
      status: IdentityStatus.UNAVAILABLE,
      reason: 'Baseline file identity was either not captured or lacked reliable non-zero device and inode identifiers.'
    };
  }

  try {
    const s = fs.statSync(filePath, { bigint: true });

    if (
      typeof s.dev !== 'bigint' || s.dev === 0n ||
      typeof s.ino !== 'bigint' || s.ino === 0n
    ) {
      return {
        status: IdentityStatus.UNAVAILABLE,
        reason: 'Current filesystem entry does not provide reliable non-zero device and inode identifiers (ino === 0n or unavailable).'
      };
    }

    if (baselineIdentity.dev === s.dev && baselineIdentity.ino === s.ino) {
      return {
        status: IdentityStatus.VERIFIED,
        reason: 'Device ID and Inode / NTFS File Reference Number match exactly.'
      };
    }

    return {
      status: IdentityStatus.MISMATCH,
      reason: `File identity mismatch: captured dev=${baselineIdentity.dev}, ino=${baselineIdentity.ino}; current dev=${s.dev}, ino=${s.ino}.`
    };
  } catch (err) {
    return {
      status: IdentityStatus.UNAVAILABLE,
      reason: `Failed to inspect current file at '${filePath}': ${err.message}`
    };
  }
}

/**
 * Compatibility helper returning boolean verification status.
 * Fails closed: returns true ONLY when verifyFileIdentity() is VERIFIED.
 * 
 * @param {Object} identity - Captured file identity object from captureFileIdentity().
 * @param {string} filePath - Path to file on disk to compare against.
 * @returns {boolean} True if and only if identity is verified.
 */
export function isSameFileIdentity(identity, filePath) {
  const result = verifyFileIdentity(identity, filePath);
  return result.status === IdentityStatus.VERIFIED;
}

/**
 * Safe rollback helper with fail-closed ownership verification and TOCTOU defense.
 * 
 * Strict Protection Rules:
 * 1. Checks verifyFileIdentity(). If status is not VERIFIED (e.g. UNAVAILABLE or MISMATCH),
 *    refuses to unlink and returns preserved: true with reason.
 * 2. Allows test seam options._testHookBetweenIdentityCheckAndUnlink for verifying race resistance.
 * 3. Immediately before fs.unlinkSync(), executes a pre-unlink identity re-check.
 *    If the file on disk was modified or replaced during the verification window,
 *    unlinking is aborted and the file is preserved.
 * 
 * @param {Object} publishedIdentity - Captured identity object.
 * @param {string} filePath - Path to file on disk.
 * @param {Object} [options]
 * @param {Function} [options._testHookBetweenIdentityCheckAndUnlink] - Hook for testing TOCTOU races.
 * @returns {{ success: boolean, rolledBack: boolean, preserved: boolean, status: string, reason?: string }}
 */
export function ownershipSafeRollback(publishedIdentity, filePath, options = {}) {
  if (!filePath || !fs.existsSync(filePath)) {
    return {
      success: true,
      rolledBack: false,
      preserved: false,
      status: IdentityStatus.UNAVAILABLE,
      reason: 'File does not exist on disk.'
    };
  }

  // Phase 1: Identity verification
  const verifyBefore = verifyFileIdentity(publishedIdentity, filePath);
  if (verifyBefore.status !== IdentityStatus.VERIFIED) {
    return {
      success: false,
      rolledBack: false,
      preserved: true,
      status: verifyBefore.status,
      reason: verifyBefore.reason
    };
  }

  // Optional test seam between identity verification and unlinking
  if (typeof options._testHookBetweenIdentityCheckAndUnlink === 'function') {
    options._testHookBetweenIdentityCheckAndUnlink({ filePath, publishedIdentity });
  }

  // Phase 2: Immediate pre-unlink re-check (defends against race replacement)
  const verifyImmediate = verifyFileIdentity(publishedIdentity, filePath);
  if (verifyImmediate.status !== IdentityStatus.VERIFIED) {
    return {
      success: false,
      rolledBack: false,
      preserved: true,
      status: verifyImmediate.status,
      reason: `Immediate pre-unlink verification aborted: ${verifyImmediate.reason}`
    };
  }

  // Phase 3: Unlink verified owned file
  try {
    fs.unlinkSync(filePath);
    return {
      success: true,
      rolledBack: true,
      preserved: false,
      status: IdentityStatus.VERIFIED
    };
  } catch (err) {
    return {
      success: false,
      rolledBack: false,
      preserved: true,
      status: IdentityStatus.UNAVAILABLE,
      reason: `Failed to unlink file '${filePath}': ${err.message}`
    };
  }
}

/**
 * Atomic no-overwrite file publication.
 * 
 * Guarantees that:
 * 1. The operation fails if the destination already exists (never overwrites).
 * 2. Hard-link publication (fs.linkSync) is attempted where supported on the same filesystem.
 * 3. If hard links are unsupported, restricted by OS security policy (EPERM), or cross-device (EXDEV),
 *    safely uses atomic exclusive copy (fs.copyFileSync with COPYFILE_EXCL), which maps to OS-level
 *    exclusive creation (COPY_FILE_FAIL_IF_EXISTS / O_CREAT | O_EXCL) and strictly maintains no-overwrite.
 * 4. Never falls back to ordinary fs.renameSync(), which could clobber existing files.
 * 5. Captures destination filesystem identity immediately upon publication for ownership tracking.
 * 6. Removes staging artifact only after publication and verification succeed.
 * 
 * @param {string} stagingPath - Source verified staging file.
 * @param {string} destinationPath - Target destination file path.
 * @param {Object} [options]
 * @param {'auto'|'hardlink'|'copy_excl'} [options.publicationMethod='auto'] - Publication strategy.
 * @returns {{ success: boolean, methodUsed: string, destinationPath: string, identity: Object }}
 */
export function publishFileAtomicNoOverwrite(stagingPath, destinationPath, options = {}) {
  const { publicationMethod = 'auto' } = options;

  if (!stagingPath || typeof stagingPath !== 'string') {
    throw new Error('stagingPath must be a non-empty string.');
  }
  if (!destinationPath || typeof destinationPath !== 'string') {
    throw new Error('destinationPath must be a non-empty string.');
  }

  if (!fs.existsSync(stagingPath)) {
    throw new Error(`Staging source file does not exist for publication: ${stagingPath}`);
  }

  // Same-filesystem verification for hardlink safety
  const stagingDir = path.dirname(stagingPath);
  const destDir = path.dirname(destinationPath);
  let sameFilesystem = true;
  try {
    const sStaging = fs.statSync(stagingDir, { bigint: true });
    const sDest = fs.statSync(destDir, { bigint: true });
    sameFilesystem = (sStaging.dev === sDest.dev);
  } catch {
    sameFilesystem = false;
  }

  let methodUsed = null;

  if (publicationMethod === 'hardlink') {
    if (!sameFilesystem) {
      throw new Error(`Atomic hard-link publication requires source and destination to be on the same filesystem. Staging: ${stagingDir}, Destination: ${destDir}`);
    }
    try {
      fs.linkSync(stagingPath, destinationPath);
      methodUsed = 'hardlink';
    } catch (err) {
      if (err.code === 'EEXIST') {
        const existErr = new Error(`Backup destination file already exists (atomic no-overwrite link prevented overwrite): ${destinationPath}`);
        existErr.code = 'EEXIST';
        throw existErr;
      }
      throw new Error(`Atomic hard-link publication failed (${err.code || 'ERR'}): ${err.message}. Never falling back to rename.`);
    }
  } else if (publicationMethod === 'copy_excl') {
    try {
      fs.copyFileSync(stagingPath, destinationPath, fs.constants.COPYFILE_EXCL);
      methodUsed = 'copy_excl';
    } catch (err) {
      if (err.code === 'EEXIST') {
        const existErr = new Error(`Backup destination file already exists (atomic no-overwrite copy prevented overwrite): ${destinationPath}`);
        existErr.code = 'EEXIST';
        throw existErr;
      }
      throw new Error(`Atomic exclusive copy publication failed (${err.code || 'ERR'}): ${err.message}. Never falling back to rename.`);
    }
  } else {
    // 'auto': Try hardlink first if on the same filesystem.
    // If unsupported due to OS permissions/restrictions (EPERM, ENOTSUP, EXDEV, EINVAL, ENOSYS),
    // safely use atomic exclusive copy (COPYFILE_EXCL) which strictly preserves the no-overwrite guarantee.
    // NEVER fall back to renameSync.
    let linked = false;
    if (sameFilesystem) {
      try {
        fs.linkSync(stagingPath, destinationPath);
        methodUsed = 'hardlink';
        linked = true;
      } catch (linkErr) {
        if (linkErr.code === 'EEXIST') {
          const existErr = new Error(`Backup destination file already exists (atomic no-overwrite link prevented overwrite): ${destinationPath}`);
          existErr.code = 'EEXIST';
          throw existErr;
        }
        // If unsupported or permission-denied (e.g. Windows unprivileged sandbox, cross-device):
        const isUnsupported = ['EPERM', 'ENOTSUP', 'EXDEV', 'EINVAL', 'ENOSYS'].includes(linkErr.code);
        if (!isUnsupported) {
          throw linkErr;
        }
      }
    }

    if (!linked) {
      try {
        fs.copyFileSync(stagingPath, destinationPath, fs.constants.COPYFILE_EXCL);
        methodUsed = 'copy_excl';
      } catch (copyErr) {
        if (copyErr.code === 'EEXIST') {
          const existErr = new Error(`Backup destination file already exists (atomic no-overwrite copy prevented overwrite): ${destinationPath}`);
          existErr.code = 'EEXIST';
          throw existErr;
        }
        throw new Error(`Atomic no-overwrite publication failed: ${copyErr.message}. Never falling back to rename.`);
      }
    }
  }

  // Capture file identity of the newly published file
  const identity = captureFileIdentity(destinationPath);
  if (!identity.captured) {
    throw new Error(`Failed to capture filesystem identity of published file '${destinationPath}': ${identity.error}`);
  }

  // Remove the staging artifact now that publication is complete
  try {
    if (fs.existsSync(stagingPath)) {
      fs.unlinkSync(stagingPath);
    }
  } catch (unlinkErr) {
    // Non-fatal if staging unlink fails here; parent stagingDir cleanup will remove it
  }

  return {
    success: true,
    methodUsed,
    destinationPath,
    identity
  };
}

/**
 * Create a consistent, verified SQLite database backup.
 * 
 * Safety & Reliability features:
 * - Pre-backup disk space pre-check (2x source size + 10MB).
 * - Read-only source connection (zero writes or mutations to source).
 * - Fix 1: Exclusive private staging directory allocation with collision retry.
 * - Fix 2: Two-file publication rollback (rolls back published DB if manifest rename fails).
 * - Fix 3: Atomic no-overwrite publication via hard links or exclusive copy (COPYFILE_EXCL).
 * - Fix 4: Ownership-safe rollback verifying device/inode identity before deletion.
 * - Overwrite protection before creation and before promotion.
 * - Integrity and foreign key verification before publishing.
 * 
 * @param {Object} options
 * @param {string} options.sourcePath - Path to source SQLite database.
 * @param {string} options.targetDir - Destination directory for backup file.
 * @param {string} [options.customFilename] - Optional explicit filename for the backup.
 * @param {string} [options.label] - Optional descriptive label (e.g. 'pre_migration_stage_2_6').
 * @param {'auto'|'hardlink'|'copy_excl'} [options.publicationMethod='auto'] - Publication method.
 * @param {Function} [options._testHookBeforeManifestRename] - Internal test hook for testing.
 * @param {Function} [options._testHookDuringManifestRename] - Internal test hook for testing.
 * @param {Function} [options._testHookBeforeStagingDirCreate] - Internal test hook for testing collision retry.
 * @param {Function} [options._testHookBeforeDbPublish] - Internal test hook for testing DB publication races.
 * @param {Function} [options._testHookDuringDbPublish] - Internal test hook for testing DB publication failure.
 * @param {Function} [options._testHookBeforeManifestPublish] - Internal test hook for testing manifest publication races.
 * @param {Function} [options._testHookDuringManifestPublish] - Internal test hook for testing manifest publication failure.
 * @returns {Object} Backup summary and verification report.
 */
export function createDatabaseBackup(options = {}) {
  const {
    sourcePath,
    targetDir,
    customFilename,
    label = 'manual_backup',
    publicationMethod = 'auto'
  } = options;

  if (!sourcePath || typeof sourcePath !== 'string') {
    throw new Error('sourcePath must be a valid file path string.');
  }
  if (!targetDir || typeof targetDir !== 'string') {
    throw new Error('targetDir must be a valid directory path string.');
  }

  const resolvedSourcePath = path.resolve(sourcePath);
  const resolvedTargetDir = path.resolve(targetDir);

  if (!fs.existsSync(resolvedSourcePath)) {
    throw new Error(`Source database does not exist: ${resolvedSourcePath}`);
  }

  const srcStat = fs.statSync(resolvedSourcePath);
  if (!srcStat.isFile()) {
    throw new Error(`Source path is not a file: ${resolvedSourcePath}`);
  }

  // Ensure target directory exists
  if (!fs.existsSync(resolvedTargetDir)) {
    fs.mkdirSync(resolvedTargetDir, { recursive: true });
  }

  // Check disk space before snapshot (2x source size + 10 MB margin)
  const minSafetyMargin = 10 * 1024 * 1024;
  const requiredBytes = Math.max(srcStat.size * 2, 5 * 1024 * 1024) + minSafetyMargin;
  const diskSpaceCheckResult = checkDiskSpace(resolvedTargetDir, requiredBytes);

  const filename = customFilename || generateBackupFilename('red_mission_backup');
  const destinationDbPath = path.join(resolvedTargetDir, filename);
  const manifestPath = destinationDbPath.replace(/\.db$/i, '.manifest.json');

  // Overwrite protection: prevent overwriting existing backup
  if (fs.existsSync(destinationDbPath)) {
    throw new Error(`Backup destination file already exists (overwrite protected): ${destinationDbPath}`);
  }
  if (fs.existsSync(manifestPath)) {
    throw new Error(`Backup manifest file already exists (overwrite protected): ${manifestPath}`);
  }

  // Fix 1: Establish exclusive private staging directory ownership with collision retry
  const MAX_STAGING_ATTEMPTS = 5;
  let stagingDir = null;
  let stagingDirOwned = false;

  for (let attempt = 1; attempt <= MAX_STAGING_ATTEMPTS; attempt++) {
    const randSuffix = `${process.pid}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}_${attempt}`;
    const candidateDir = path.join(resolvedTargetDir, `.staging_${randSuffix}`);

    if (typeof options._testHookBeforeStagingDirCreate === 'function') {
      options._testHookBeforeStagingDirCreate({ candidateDir, attempt });
    }

    try {
      // recursive: false ensures atomic exclusive directory creation (fails with EEXIST if exists)
      fs.mkdirSync(candidateDir, { recursive: false });
      stagingDir = candidateDir;
      stagingDirOwned = true;
      break;
    } catch (mkdirErr) {
      if (mkdirErr.code === 'EEXIST' && attempt < MAX_STAGING_ATTEMPTS) {
        // Collision handled cleanly: retry with new candidate directory
        continue;
      }
      throw new Error(`Failed to establish exclusive staging directory '${candidateDir}': ${mkdirErr.message}`);
    }
  }

  if (!stagingDirOwned || !stagingDir) {
    throw new Error(`Failed to allocate a unique private staging directory after ${MAX_STAGING_ATTEMPTS} attempts.`);
  }

  // Isolated staging file paths inside the exclusively owned private staging directory
  const stagingDbPath = path.join(stagingDir, filename);
  const stagingManifestPath = path.join(stagingDir, filename.replace(/\.db$/i, '.manifest.json'));

  let pubState = PublicationState.INITIAL;
  let stagingManifestCreated = false;
  let destinationDbPublished = false;
  let manifestPublished = false;
  let publishedDbIdentity = null;
  let publishedManifestIdentity = null;
  let sourceDb = null;

  try {
    // Open source database in strict READ-ONLY mode.
    sourceDb = new DatabaseSync(resolvedSourcePath, { readOnly: true });

    // Execute atomic, online backup using SQLite's native VACUUM INTO to isolated staging path.
    const safeStagingSql = toSqlSafePath(stagingDbPath);
    sourceDb.exec(`VACUUM INTO '${safeStagingSql}';`);

    // Close source connection immediately after snapshot
    sourceDb.close();
    sourceDb = null;

    // Verify staging file exists and inspect size
    if (!fs.existsSync(stagingDbPath)) {
      throw new Error(`Backup staging file was not created at expected destination: ${stagingDbPath}`);
    }
    const dstStat = fs.statSync(stagingDbPath);

    // Open backup database independently in READ-ONLY mode to verify integrity
    const verifyResult = verifyBackupFile(stagingDbPath);

    // Build structured backup manifest
    const manifest = {
      manifestVersion: '1.0',
      backupFilename: path.basename(destinationDbPath),
      backupPath: destinationDbPath,
      manifestFilename: path.basename(manifestPath),
      createdAt: new Date().toISOString(),
      label,
      sourceDatabase: {
        identifier: path.basename(resolvedSourcePath),
        sizeBytes: srcStat.size,
        lastModified: srcStat.mtime.toISOString()
      },
      backupDatabase: {
        sizeBytes: dstStat.size,
        integrityCheck: verifyResult.integrityCheck,
        foreignKeyViolations: verifyResult.foreignKeyViolations,
        tablesCount: verifyResult.tables.length,
        migrationsPresent: verifyResult.migrationsPresent
      },
      diskSpaceCheck: {
        status: diskSpaceCheckResult.status,
        requiredBytes: diskSpaceCheckResult.requiredBytes,
        freeBytes: diskSpaceCheckResult.freeBytes
      },
      status: 'VERIFIED_CONSISTENT'
    };

    // Write manifest to staging file inside private staging directory
    fs.writeFileSync(stagingManifestPath, JSON.stringify(manifest, null, 2), 'utf8');
    stagingManifestCreated = true;

    // Final preliminary overwrite check before promotion
    if (fs.existsSync(destinationDbPath)) {
      throw new Error(`Backup destination file already exists before publication: ${destinationDbPath}`);
    }
    if (fs.existsSync(manifestPath)) {
      throw new Error(`Backup manifest file already exists before publication: ${manifestPath}`);
    }

    pubState = PublicationState.STAGED_AND_VERIFIED;

    // Backward-compat test seam before publication (from Step 2D)
    if (typeof options._testHookBeforeManifestRename === 'function') {
      options._testHookBeforeManifestRename({ stagingDbPath, stagingManifestPath, destinationDbPath, manifestPath });
    }
    // Step 2H test seam before DB publish
    if (typeof options._testHookBeforeDbPublish === 'function') {
      options._testHookBeforeDbPublish({ stagingDbPath, destinationDbPath });
    }

    // Two-phase atomic no-overwrite publication with ownership-safe rollback:
    // Step 1: Promote database file using atomic no-overwrite publication
    const dbPubResult = publishFileAtomicNoOverwrite(stagingDbPath, destinationDbPath, {
      publicationMethod
    });
    destinationDbPublished = true;
    publishedDbIdentity = dbPubResult.identity;
    pubState = PublicationState.DATABASE_PUBLISHED;

    // Step 2H test seam during DB publish
    if (typeof options._testHookDuringDbPublish === 'function') {
      options._testHookDuringDbPublish({ stagingDbPath, destinationDbPath, identity: publishedDbIdentity });
    }

    // Optional test seam between Step 1 and Step 2 (Step 2D / Step 2H)
    if (typeof options._testHookBeforeManifestPublish === 'function') {
      options._testHookBeforeManifestPublish({ stagingDbPath, stagingManifestPath, destinationDbPath, manifestPath, publishedDbIdentity });
    }
    if (typeof options._testHookDuringManifestRename === 'function') {
      options._testHookDuringManifestRename({ stagingDbPath, stagingManifestPath, destinationDbPath, manifestPath });
    }

    // Step 2: Promote manifest file using atomic no-overwrite publication
    const manifestPubResult = publishFileAtomicNoOverwrite(stagingManifestPath, manifestPath, {
      publicationMethod
    });
    manifestPublished = true;
    publishedManifestIdentity = manifestPubResult.identity;
    stagingManifestCreated = false;
    pubState = PublicationState.MANIFEST_PUBLISHED;

    // Symmetrical pair verification: both files must be present on disk prior to commit
    if (!fs.existsSync(destinationDbPath) || !fs.existsSync(manifestPath)) {
      throw new Error(`Publication consistency check failed: both database and manifest must exist at commit time.`);
    }

    // COMMIT: Pair is published, verified, and complete
    pubState = PublicationState.COMMITTED;

    // Step 2H/2J test seam during manifest publish / post-commit
    if (typeof options._testHookDuringManifestPublish === 'function') {
      options._testHookDuringManifestPublish({ stagingDbPath, stagingManifestPath, destinationDbPath, manifestPath });
    }

    // Remove now-empty private staging directory
    try {
      if (fs.existsSync(stagingDir)) {
        fs.rmdirSync(stagingDir);
      }
      stagingDirOwned = false;
    } catch {}

    return {
      success: true,
      publicationState: pubState,
      backupPath: destinationDbPath,
      manifestPath,
      sourceSizeBytes: srcStat.size,
      backupSizeBytes: dstStat.size,
      integrityCheck: verifyResult.integrityCheck,
      foreignKeyViolations: verifyResult.foreignKeyViolations,
      migrationsPresent: verifyResult.migrationsPresent,
      diskSpaceCheck: diskSpaceCheckResult,
      manifest
    };
  } catch (err) {
    if (sourceDb) {
      try { sourceDb.close(); } catch (e) {}
      sourceDb = null;
    }

    const cleanupErrors = [];

    // State-Machine Governed Recovery:
    if (pubState === PublicationState.COMMITTED) {
      // Rule: Once COMMITTED, ordinary post-commit cleanup errors must never delete either file!
      cleanupErrors.push(
        `Post-commit cleanup notice: Backup is committed and valid (${destinationDbPath}, ${manifestPath}). ` +
        `Failure occurred during post-commit operations: ${err.message}`
      );
    } else if (pubState === PublicationState.DATABASE_PUBLISHED) {
      // Database was published, but manifest publication failed.
      // Symmetrical Rule: Do not leave an unmanifested database behind if it can be safely rolled back.
      const rollbackRes = ownershipSafeRollback(publishedDbIdentity, destinationDbPath, options);
      if (rollbackRes.rolledBack) {
        destinationDbPublished = false;
      } else {
        cleanupErrors.push(
          `Ownership-safe rollback preserved destination database '${destinationDbPath}': ` +
          `File cannot be safely removed (${rollbackRes.reason}). Manual operator review required.`
        );
      }
    } else if (pubState === PublicationState.MANIFEST_PUBLISHED) {
      // Pre-commit failure after manifest publication:
      // Sequential best-effort rollback of both published files.
      // Standard filesystems do not support atomic multi-file rollback.
      const dbRollback = ownershipSafeRollback(publishedDbIdentity, destinationDbPath, options);
      const manifestRollback = ownershipSafeRollback(publishedManifestIdentity, manifestPath, options);

      if (dbRollback.rolledBack && manifestRollback.rolledBack) {
        destinationDbPublished = false;
        manifestPublished = false;
      } else if (dbRollback.rolledBack && !manifestRollback.rolledBack) {
        destinationDbPublished = false;
        cleanupErrors.push(
          `Sequential rollback partial failure: Database file was safely rolled back and removed ('${destinationDbPath}'), ` +
          `but manifest rollback failed (${manifestRollback.status}: ${manifestRollback.reason || 'unspecified reason'}). ` +
          `An orphaned manifest file may remain on disk ('${manifestPath}'). Incomplete backup pair must not be treated as valid.`
        );
      } else if (!dbRollback.rolledBack && manifestRollback.rolledBack) {
        manifestPublished = false;
        cleanupErrors.push(
          `Sequential rollback partial failure: Manifest file was safely rolled back and removed ('${manifestPath}'), ` +
          `but database rollback failed (${dbRollback.status}: ${dbRollback.reason || 'unspecified reason'}). ` +
          `An orphaned database file may remain on disk ('${destinationDbPath}'). Incomplete backup pair must not be treated as valid.`
        );
      } else {
        cleanupErrors.push(
          `Sequential rollback failed for both published files: Database rollback failed (${dbRollback.status}: ${dbRollback.reason || 'unspecified reason'}), ` +
          `and manifest rollback failed (${manifestRollback.status}: ${manifestRollback.reason || 'unspecified reason'}). ` +
          `Both files remain on disk ('${destinationDbPath}', '${manifestPath}'). Incomplete backup pair must not be treated as valid.`
        );
      }
    }

    // Clean up staging files strictly within the owned private staging directory
    if (stagingDirOwned && stagingDir && fs.existsSync(stagingDir)) {
      try {
        if (fs.existsSync(stagingDbPath)) {
          fs.unlinkSync(stagingDbPath);
        }
      } catch (unlinkErr) {
        cleanupErrors.push(`Failed to cleanup staging database '${stagingDbPath}': ${unlinkErr.message}`);
      }

      try {
        if (stagingManifestCreated && fs.existsSync(stagingManifestPath)) {
          fs.unlinkSync(stagingManifestPath);
        }
      } catch (unlinkErr) {
        cleanupErrors.push(`Failed to cleanup staging manifest '${stagingManifestPath}': ${unlinkErr.message}`);
      }

      try {
        fs.rmdirSync(stagingDir);
      } catch (rmdirErr) {
        cleanupErrors.push(`Failed to remove private staging directory '${stagingDir}': ${rmdirErr.message}`);
      }
    }

    // Preserve original error while including cleanup details if cleanup itself failed
    if (cleanupErrors.length > 0) {
      const combinedMsg = `${err.message} (Cleanup details: ${cleanupErrors.join('; ')})`;
      const combinedErr = new Error(combinedMsg);
      combinedErr.cause = err;
      combinedErr.cleanupErrors = cleanupErrors;
      combinedErr.publicationState = pubState;
      throw combinedErr;
    }

    throw err;
  }
}

/**
 * Verify an existing backup file independently.
 * Opens in read-only mode and runs integrity_check & foreign_key_check.
 */
export function verifyBackupFile(backupDbPath) {
  const resolvedPath = path.resolve(backupDbPath);
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Backup file does not exist: ${resolvedPath}`);
  }

  const stat = fs.statSync(resolvedPath);
  const bakDb = new DatabaseSync(resolvedPath, { readOnly: true });

  try {
    const integrityRow = bakDb.prepare('PRAGMA integrity_check;').get();
    const integrityCheck = integrityRow ? integrityRow.integrity_check : 'unknown';

    if (integrityCheck !== 'ok') {
      throw new Error(`Backup integrity check failed: ${integrityCheck}`);
    }

    const fks = bakDb.prepare('PRAGMA foreign_key_check;').all();
    if (fks.length > 0) {
      throw new Error(`Backup foreign key check failed with ${fks.length} violations: ${JSON.stringify(fks)}`);
    }

    // Inspect tables
    const tables = bakDb.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name;").all().map(t => t.name);

    // Inspect migrations if table exists
    let migrationsPresent = [];
    if (tables.includes('schema_migrations')) {
      migrationsPresent = bakDb.prepare('SELECT version FROM schema_migrations ORDER BY applied_at ASC;').all().map(r => r.version);
    }

    return {
      valid: true,
      sizeBytes: stat.size,
      integrityCheck,
      foreignKeyViolations: fks.length,
      tables,
      migrationsPresent
    };
  } finally {
    bakDb.close();
  }
}

/**
 * Restore verification utility.
 * Simulates restoring a backup into a dedicated scratch location and performs
 * a comprehensive comparison of all sqlite_master objects (tables, indexes, views, triggers,
 * literal-preserving normalized SQL), table row counts, foreign key constraints, and migration history
 * against the reference database.
 * 
 * Safety: Refuses to restore into any production directory or any symlink/junction
 * pointing to it (failing closed on uncertain paths), and prevents overwriting existing files.
 * 
 * @param {Object} options
 * @param {string} options.backupDbPath - Path to backup database to restore from.
 * @param {string} options.referenceSourcePath - Path to reference database to compare against.
 * @param {string} options.targetScratchDir - Destination scratch directory for restored copy.
 * @param {string} [options.restoredFilename] - Optional filename for the restored database.
 * @returns {Object} Deep comparison and verification report.
 */
export function verifyRestoreSimulation(options = {}) {
  const {
    backupDbPath,
    referenceSourcePath,
    targetScratchDir,
    restoredFilename = 'restored_verification.db'
  } = options;

  if (!backupDbPath || !referenceSourcePath || !targetScratchDir) {
    throw new Error('backupDbPath, referenceSourcePath, and targetScratchDir are strictly required.');
  }

  const resolvedBackup = path.resolve(backupDbPath);
  const resolvedRef = path.resolve(referenceSourcePath);
  const resolvedScratchDir = path.resolve(targetScratchDir);

  if (!fs.existsSync(resolvedBackup)) {
    throw new Error(`Backup file does not exist: ${resolvedBackup}`);
  }
  if (!fs.existsSync(resolvedRef)) {
    throw new Error(`Reference source database does not exist: ${resolvedRef}`);
  }

  // Safety guard with fail-closed physical path dereferencing
  if (isProductionDataTarget(resolvedScratchDir)) {
    throw new Error('Safety violation: Restoration target must be an isolated scratch directory, not production data directory (or any symlink/junction pointing to it).');
  }

  const refPhysicalDir = path.dirname(resolvePhysicalPath(resolvedRef));
  const bakPhysicalDir = path.dirname(resolvePhysicalPath(resolvedBackup));
  const scratchPhysicalDir = resolvePhysicalPath(resolvedScratchDir);

  if (scratchPhysicalDir === refPhysicalDir || scratchPhysicalDir === bakPhysicalDir) {
    throw new Error('Safety violation: Restoration scratch directory cannot be the same directory as reference database or backup database.');
  }

  if (!fs.existsSync(resolvedScratchDir)) {
    fs.mkdirSync(resolvedScratchDir, { recursive: true });
  }

  const destinationPath = path.join(resolvedScratchDir, restoredFilename);
  if (fs.existsSync(destinationPath)) {
    throw new Error(`Restoration target already exists (overwrite protected): ${destinationPath}`);
  }

  // Copy backup to restored destination
  fs.copyFileSync(resolvedBackup, destinationPath);

  let restoredDb = null;
  let referenceDb = null;

  try {
    restoredDb = new DatabaseSync(destinationPath, { readOnly: true });
    referenceDb = new DatabaseSync(resolvedRef, { readOnly: true });

    // 1. Run integrity check on restored
    const integrityRow = restoredDb.prepare('PRAGMA integrity_check;').get();
    const integrityCheck = integrityRow ? integrityRow.integrity_check : 'failed';
    if (integrityCheck !== 'ok') {
      throw new Error(`Restored database failed integrity check: ${integrityCheck}`);
    }

    // 2. Run foreign key check on restored
    const fks = restoredDb.prepare('PRAGMA foreign_key_check;').all();
    if (fks.length > 0) {
      throw new Error(`Restored database failed foreign key check with ${fks.length} violations`);
    }

    // Comprehensive comparison of all sqlite_master objects (tables, indexes, views, triggers)
    const masterQuery = `
      SELECT type, name, tbl_name, sql 
      FROM sqlite_master 
      WHERE name NOT LIKE 'sqlite_%' 
        AND name NOT LIKE 'sqlite_autoindex_%'
        AND sql IS NOT NULL
      ORDER BY type, name;
    `;

    const refMaster = referenceDb.prepare(masterQuery).all();
    const resMaster = restoredDb.prepare(masterQuery).all();

    const categories = ['table', 'index', 'view', 'trigger'];
    const refByType = { table: new Map(), index: new Map(), view: new Map(), trigger: new Map() };
    const resByType = { table: new Map(), index: new Map(), view: new Map(), trigger: new Map() };

    for (const obj of refMaster) {
      if (refByType[obj.type]) refByType[obj.type].set(obj.name, obj);
    }
    for (const obj of resMaster) {
      if (resByType[obj.type]) resByType[obj.type].set(obj.name, obj);
    }

    const missing = { table: [], index: [], view: [], trigger: [] };
    const extra = { table: [], index: [], view: [], trigger: [] };
    const schemaMismatches = [];

    for (const cat of categories) {
      const refMap = refByType[cat];
      const resMap = resByType[cat];

      for (const [name, refObj] of refMap.entries()) {
        if (!resMap.has(name)) {
          missing[cat].push(name);
        } else {
          const resObj = resMap.get(name);
          if (normalizeSql(refObj.sql) !== normalizeSql(resObj.sql)) {
            schemaMismatches.push({
              type: cat,
              name,
              refSql: refObj.sql,
              resSql: resObj.sql
            });
          }
        }
      }

      for (const [name] of resMap.entries()) {
        if (!refMap.has(name)) {
          extra[cat].push(name);
        }
      }
    }

    // Compare row counts for each user table
    const refTables = Array.from(refByType.table.keys()).sort();
    const rowCounts = {};
    const countMismatches = [];

    for (const table of refTables) {
      const refCount = referenceDb.prepare(`SELECT COUNT(*) as c FROM "${table}";`).get().c;
      const resCount = resByType.table.has(table)
        ? restoredDb.prepare(`SELECT COUNT(*) as c FROM "${table}";`).get().c
        : null;
      rowCounts[table] = { reference: refCount, restored: resCount };
      if (refCount !== resCount) {
        countMismatches.push({ table, refCount, resCount });
      }
    }

    // Compare migrations if schema_migrations table exists
    let refMigrations = [];
    let resMigrations = [];
    if (refByType.table.has('schema_migrations')) {
      refMigrations = referenceDb.prepare('SELECT version FROM schema_migrations ORDER BY applied_at ASC;').all().map(r => r.version);
      if (resByType.table.has('schema_migrations')) {
        resMigrations = restoredDb.prepare('SELECT version FROM schema_migrations ORDER BY applied_at ASC;').all().map(r => r.version);
      }
    }

    const migrationsMatch = JSON.stringify(refMigrations) === JSON.stringify(resMigrations);

    const hasMissing = categories.some(cat => missing[cat].length > 0);
    const hasExtra = categories.some(cat => extra[cat].length > 0);

    const allMatched = (
      !hasMissing &&
      !hasExtra &&
      schemaMismatches.length === 0 &&
      countMismatches.length === 0 &&
      migrationsMatch
    );

    if (!allMatched) {
      const issues = [];
      if (missing.table.length) issues.push(`Missing tables: ${missing.table.join(', ')}`);
      if (extra.table.length) issues.push(`Extra tables: ${extra.table.join(', ')}`);
      if (missing.index.length) issues.push(`Missing indexes: ${missing.index.join(', ')}`);
      if (extra.index.length) issues.push(`Extra indexes: ${extra.index.join(', ')}`);
      if (missing.view.length) issues.push(`Missing views: ${missing.view.join(', ')}`);
      if (extra.view.length) issues.push(`Extra views: ${extra.view.join(', ')}`);
      if (missing.trigger.length) issues.push(`Missing triggers: ${missing.trigger.join(', ')}`);
      if (extra.trigger.length) issues.push(`Extra triggers: ${extra.trigger.join(', ')}`);
      if (schemaMismatches.length) issues.push(`Schema SQL differences in ${schemaMismatches.length} objects`);
      if (countMismatches.length) issues.push(`Row count differences in ${countMismatches.length} tables`);
      if (!migrationsMatch) issues.push(`Migration history mismatch`);
      throw new Error(`Restored database verification failed:\n- ${issues.join('\n- ')}`);
    }

    return {
      success: true,
      integrityCheck,
      foreignKeyViolations: fks.length,
      tablesCount: refTables.length,
      indexesCount: refByType.index.size,
      viewsCount: refByType.view.size,
      triggersCount: refByType.trigger.size,
      rowCounts,
      missingObjects: missing,
      extraObjects: extra,
      schemaMismatches,
      countMismatches,
      migrationsMatch,
      refMigrations,
      resMigrations,
      restoredDbPath: destinationPath
    };
  } finally {
    if (restoredDb) try { restoredDb.close(); } catch (e) {}
    if (referenceDb) try { referenceDb.close(); } catch (e) {}
  }
}
