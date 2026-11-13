/**
 * RED MISSION — Rotaract College Members Directory Service
 * Phase 6, Feature 4: Persistent storage & public-safe DTO projection.
 *
 * Dual-mode architecture:
 * - When the `rotaract_members` SQLite table is present (post Stage 3.2 migration),
 *   records are read/written atomically in SQLite while photos reside on disk.
 * - While the Stage 3.2 migration has NOT yet been applied to the production database,
 *   records are stored cleanly in an atomic JSON ledger alongside disk photos inside
 *   ROTARACT_STORAGE_DIR, guaranteeing zero writes or schema modifications to red_mission.db.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { config } from '../config/env.js';
import { validateImagePayload } from '../utils/imageValidator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export const REPO_SEED_DIR = path.resolve(__dirname, '../storage/rotaract');
export const REPO_SEED_PHOTOS_DIR = path.join(REPO_SEED_DIR, 'photos');
export const REPO_SEED_LEDGER_PATH = path.join(REPO_SEED_DIR, 'members.json');

const PHOTO_EXT_MIME = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp'
};

export function resolveStoragePaths(opts = {}) {
  const baseDir = path.resolve(
    opts.storageDir || process.env.ROTARACT_STORAGE_DIR || config.ROTARACT_STORAGE_DIR || path.resolve(process.cwd(), 'server/storage/rotaract')
  );
  const photosDir = path.join(baseDir, 'photos');
  const ledgerPath = path.join(baseDir, 'members.json');
  return { baseDir, photosDir, ledgerPath };
}

/**
 * Verifies that the repository contains all required original seed files:
 * - members.json exists and contains a valid array of members (at least 1, expected 28)
 * - Each member record contains id, fullName, and photoPath
 * - Each corresponding photograph exists on disk in photos/ and is non-empty
 */
export function verifyRotaractSeedSource(seedDir = REPO_SEED_DIR) {
  const seedLedgerPath = path.join(seedDir, 'members.json');
  const seedPhotosDir = path.join(seedDir, 'photos');

  if (!fs.existsSync(seedLedgerPath)) {
    return {
      valid: false,
      error: `Seed ledger not found at '${seedLedgerPath}'`,
      memberCount: 0,
      photoCount: 0
    };
  }

  if (!fs.existsSync(seedPhotosDir)) {
    return {
      valid: false,
      error: `Seed photos directory not found at '${seedPhotosDir}'`,
      memberCount: 0,
      photoCount: 0
    };
  }

  let members = [];
  try {
    const raw = fs.readFileSync(seedLedgerPath, 'utf8');
    const parsed = JSON.parse(raw);
    members = Array.isArray(parsed) ? parsed : (parsed?.members || []);
  } catch (err) {
    return {
      valid: false,
      error: `Failed to parse seed ledger JSON: ${err.message}`,
      memberCount: 0,
      photoCount: 0
    };
  }

  if (!Array.isArray(members) || members.length === 0) {
    return {
      valid: false,
      error: `Seed ledger is empty or has invalid format`,
      memberCount: 0,
      photoCount: 0
    };
  }

  const missingPhotos = [];
  let validPhotoCount = 0;

  for (const member of members) {
    if (!member.id || !member.fullName || !member.photoPath) {
      return {
        valid: false,
        error: `Member record '${member.id || 'unknown'}' is missing required fields (id, fullName, photoPath)`,
        memberCount: members.length,
        photoCount: validPhotoCount
      };
    }
    const photoFile = path.join(seedPhotosDir, member.photoPath);
    if (!fs.existsSync(photoFile)) {
      missingPhotos.push({ id: member.id, photoPath: member.photoPath });
    } else {
      try {
        const stat = fs.statSync(photoFile);
        if (stat.isFile() && stat.size > 0) {
          validPhotoCount++;
        } else {
          missingPhotos.push({ id: member.id, photoPath: member.photoPath, reason: 'empty file' });
        }
      } catch (err) {
        missingPhotos.push({ id: member.id, photoPath: member.photoPath, reason: err.message });
      }
    }
  }

  if (missingPhotos.length > 0) {
    return {
      valid: false,
      error: `Missing or invalid photos for ${missingPhotos.length} seed member(s): ${missingPhotos.map(m => m.photoPath).join(', ')}`,
      memberCount: members.length,
      photoCount: validPhotoCount,
      missingPhotos
    };
  }

  return {
    valid: true,
    memberCount: members.length,
    photoCount: validPhotoCount,
    members
  };
}

/**
 * Safely initializes a persistent volume with repository Rotaract seed data.
 * Adheres strictly to safety rules:
 * 1. Never overwrite an existing members.json.
 * 2. Never overwrite an existing photograph.
 * 3. Never replace a non-empty persistent Rotaract directory.
 * 4. First verify that repository contains all required original seed files.
 * 5. If target members.json is absent and verified seed exists, copy safely.
 * 6. Copy only the corresponding Rotaract photographs.
 * 7. Use safe, atomic file creation where practical.
 * 8. Verify member count and photograph count after initialization.
 * 9. If source files are missing, incomplete, or untracked, STOP and report. Do not create an empty members.json.
 * 10. Do not include donor selfies, medical proofs, or other private uploads.
 * 11. Preserve current local development behavior exactly.
 */
export function initializeRotaractPersistentVolume(opts = {}) {
  const { baseDir, photosDir, ledgerPath } = resolveStoragePaths(opts);

  // Rule 11: If target directory is the repository seed directory itself (e.g. local development),
  // do not copy anything — local files are already authoritative.
  if (path.resolve(baseDir) === REPO_SEED_DIR) {
    return {
      initialized: false,
      reason: 'TARGET_IS_SEED_SOURCE',
      message: 'Target directory is the local repository seed source. Initialization not needed.',
      baseDir,
      memberCount: 28,
      photoCount: 28
    };
  }

  // Rule 1: Never overwrite an existing members.json.
  if (fs.existsSync(ledgerPath)) {
    const existing = readLedger(ledgerPath);
    return {
      initialized: false,
      reason: 'LEDGER_ALREADY_EXISTS',
      message: `Target ledger already exists at '${ledgerPath}' (${existing.length} members). Overwrite forbidden.`,
      baseDir,
      memberCount: existing.length,
      photoCount: fs.existsSync(photosDir) ? fs.readdirSync(photosDir).length : 0
    };
  }

  // Rule 3: Never replace a non-empty persistent Rotaract directory containing foreign entries.
  if (fs.existsSync(baseDir)) {
    const foreignEntries = fs.readdirSync(baseDir).filter(name => name !== 'photos' && name !== '.gitkeep');
    if (foreignEntries.length > 0) {
      throw new Error(
        `[ROTARACT PERSISTENT STORAGE] Target directory '${baseDir}' is non-empty (contains foreign entries: ${foreignEntries.join(', ')}), but 'members.json' is absent. Refusing to overwrite or replace non-empty directory.`
      );
    }
  }

  // Rule 4 & 9: Verify repository seed source before touching the target.
  const seedVerification = verifyRotaractSeedSource(REPO_SEED_DIR);
  if (!seedVerification.valid) {
    throw new Error(
      `[ROTARACT PERSISTENT STORAGE] Refusing to initialize volume: Repository seed data is incomplete or invalid: ${seedVerification.error}. Empty members.json creation blocked.`
    );
  }

  // Ensure target directories exist safely
  if (!fs.existsSync(baseDir)) {
    fs.mkdirSync(baseDir, { recursive: true });
  }
  if (!fs.existsSync(photosDir)) {
    fs.mkdirSync(photosDir, { recursive: true });
  }

  // Rule 6 & 2: Copy ONLY the corresponding Rotaract photographs, never overwriting existing files.
  let copiedPhotos = 0;
  let skippedPhotos = 0;
  for (const member of seedVerification.members) {
    const srcPhoto = path.join(REPO_SEED_PHOTOS_DIR, member.photoPath);
    const dstPhoto = path.join(photosDir, member.photoPath);

    if (fs.existsSync(dstPhoto)) {
      skippedPhotos++;
      continue;
    }

    // Atomic / safe copy
    const tmpDstPhoto = `${dstPhoto}.${process.pid}.${Date.now()}.tmp`;
    fs.copyFileSync(srcPhoto, tmpDstPhoto);
    fs.renameSync(tmpDstPhoto, dstPhoto);
    copiedPhotos++;
  }

  // Rule 5 & 7: Write target members.json atomically.
  writeLedgerAtomic(ledgerPath, seedVerification.members);

  // Rule 8: Verify member count and photograph count after initialization.
  const targetMembers = readLedger(ledgerPath);
  if (targetMembers.length !== seedVerification.memberCount) {
    throw new Error(
      `[ROTARACT PERSISTENT STORAGE] Verification mismatch after initialization: expected ${seedVerification.memberCount} members, found ${targetMembers.length}.`
    );
  }

  let verifiedTargetPhotos = 0;
  for (const m of targetMembers) {
    const p = path.join(photosDir, m.photoPath);
    if (!fs.existsSync(p) || fs.statSync(p).size === 0) {
      throw new Error(
        `[ROTARACT PERSISTENT STORAGE] Photograph verification failed for member '${m.id}' at '${p}'.`
      );
    }
    verifiedTargetPhotos++;
  }

  console.log(
    `[ROTARACT PERSISTENT STORAGE] Volume initialized successfully: ${targetMembers.length} members and ${verifiedTargetPhotos} photographs copied to '${baseDir}' (${skippedPhotos} photos preserved).`
  );

  return {
    initialized: true,
    baseDir,
    memberCount: targetMembers.length,
    photoCount: verifiedTargetPhotos,
    copiedPhotos,
    skippedPhotos
  };
}

function ensureStorageDirs(opts = {}) {
  const { baseDir, photosDir, ledgerPath } = resolveStoragePaths(opts);
  if (!fs.existsSync(baseDir)) {
    fs.mkdirSync(baseDir, { recursive: true });
  }
  if (!fs.existsSync(photosDir)) {
    fs.mkdirSync(photosDir, { recursive: true });
  }
  if (!fs.existsSync(ledgerPath)) {
    const isPersistentOrConfigured = Boolean(
      config.PERSISTENT_DATA_DIR ||
      (config.ROTARACT_STORAGE_DIR && path.resolve(config.ROTARACT_STORAGE_DIR) !== REPO_SEED_DIR) ||
      opts.seedIfEmpty
    );
    if (isPersistentOrConfigured && !opts.skipSeed) {
      initializeRotaractPersistentVolume(opts);
    } else {
      writeLedgerAtomic(ledgerPath, []);
    }
  }
  return { baseDir, photosDir, ledgerPath };
}

function writeLedgerAtomic(ledgerPath, members) {
  const uniqueSuffix = crypto.randomBytes(4).toString('hex');
  const tmpPath = `${ledgerPath}.${process.pid}.${Date.now()}.${uniqueSuffix}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify({ version: 1, members }, null, 2), 'utf8');
  fs.renameSync(tmpPath, ledgerPath);
}

function readLedger(ledgerPath) {
  if (!fs.existsSync(ledgerPath)) {
    return [];
  }
  try {
    const raw = fs.readFileSync(ledgerPath, 'utf8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
    if (parsed && Array.isArray(parsed.members)) return parsed.members;
  } catch (err) {
    console.error('[ROTARACT LEDGER READ ERROR]', err);
  }
  return [];
}

function hasRotaractTable(db) {
  if (!db) return false;
  try {
    const row = db.prepare(
      "SELECT 1 AS ok FROM sqlite_master WHERE type = 'table' AND name = 'rotaract_members' LIMIT 1"
    ).get();
    return Boolean(row && row.ok === 1);
  } catch (_) {
    return false;
  }
}

function normalizeText(value, fieldLabel, maxLength = 120) {
  if (typeof value !== 'string') {
    return { valid: false, error: `${fieldLabel} must be a non-empty text string.` };
  }
  const clean = value.replace(/\s+/g, ' ').trim();
  if (clean.length < 2) {
    return { valid: false, error: `${fieldLabel} must be at least 2 characters long.` };
  }
  if (clean.length > maxLength) {
    return { valid: false, error: `${fieldLabel} must not exceed ${maxLength} characters.` };
  }
  return { valid: true, value: clean };
}

function normalizeBoolean(val, fallback = true) {
  if (val === undefined || val === null) return fallback;
  if (typeof val === 'boolean') return val;
  if (val === 1 || val === '1' || val === 'true') return true;
  if (val === 0 || val === '0' || val === 'false') return false;
  return fallback;
}

export function resolveSafePhotoFile(photoFilename, opts = {}) {
  if (!photoFilename || typeof photoFilename !== 'string') return null;
  // Block directory separators, null bytes, or traversal tokens
  if (photoFilename.includes('/') || photoFilename.includes('\\') || photoFilename.includes('..') || photoFilename.includes('\0')) {
    return null;
  }
  const { photosDir } = ensureStorageDirs(opts);
  const resolved = path.resolve(photosDir, photoFilename);
  const rel = path.relative(photosDir, resolved);
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) {
    return null;
  }
  if (!fs.existsSync(resolved)) {
    return null;
  }
  const stat = fs.statSync(resolved);
  if (!stat.isFile()) return null;
  const ext = path.extname(resolved).toLowerCase();
  const inferredMime = PHOTO_EXT_MIME[ext] || 'application/octet-stream';
  return {
    fullPath: resolved,
    sizeBytes: stat.size,
    mime: inferredMime
  };
}

function savePhotoBuffer(memberId, imgValidation, opts = {}) {
  const { photosDir } = ensureStorageDirs(opts);
  const safeId = String(memberId).replace(/[^a-zA-Z0-9_-]/g, '');
  const randomSuffix = crypto.randomBytes(6).toString('hex');
  const filename = `${safeId}_${randomSuffix}${imgValidation.ext}`;
  const fullPath = path.join(photosDir, filename);
  const tmpPath = `${fullPath}.${process.pid}.tmp`;
  fs.writeFileSync(tmpPath, imgValidation.buffer);
  fs.renameSync(tmpPath, fullPath);
  return {
    filename,
    mime: imgValidation.mime,
    sizeBytes: imgValidation.sizeBytes
  };
}

function removePhotoFileSilently(photoFilename, opts = {}) {
  const resolved = resolveSafePhotoFile(photoFilename, opts);
  if (resolved) {
    try {
      fs.unlinkSync(resolved.fullPath);
    } catch (err) {
      console.warn('[ROTARACT PHOTO CLEANUP WARNING]', err.message);
    }
  }
}

function sortMembers(rows) {
  return [...rows].sort((a, b) => {
    const ordA = Number.isFinite(Number(a.displayOrder)) ? Number(a.displayOrder) : 0;
    const ordB = Number.isFinite(Number(b.displayOrder)) ? Number(b.displayOrder) : 0;
    if (ordA !== ordB) return ordA - ordB;
    return String(a.createdAt || '').localeCompare(String(b.createdAt || ''));
  });
}

function normalizeRecord(raw) {
  if (!raw) return null;
  return {
    id: raw.id,
    fullName: raw.full_name ?? raw.fullName,
    designation: raw.designation,
    photoPath: raw.photo_path ?? raw.photoPath ?? null,
    photoMime: raw.photo_mime ?? raw.photoMime ?? null,
    photoSizeBytes: raw.photo_size_bytes ?? raw.photoSizeBytes ?? null,
    isPublic: raw.is_public !== undefined ? Boolean(raw.is_public) : Boolean(raw.isPublic),
    displayOrder: Number(raw.display_order ?? raw.displayOrder ?? 0),
    createdByAdminId: raw.created_by_admin_id ?? raw.createdByAdminId ?? null,
    updatedByAdminId: raw.updated_by_admin_id ?? raw.updatedByAdminId ?? null,
    createdAt: raw.created_at ?? raw.createdAt ?? null,
    updatedAt: raw.updated_at ?? raw.updatedAt ?? null
  };
}

/**
 * Strictly sanitized Public DTO: contains ONLY fields approved for public directory display.
 * Never returns admin audit IDs, raw file paths, or private personal information.
 */
export function toPublicMemberDto(record) {
  const norm = normalizeRecord(record);
  if (!norm || !norm.isPublic) return null;
  const hasPhoto = Boolean(norm.photoPath);
  const cacheBust = norm.updatedAt ? `?v=${encodeURIComponent(norm.updatedAt)}` : '';
  return {
    id: norm.id,
    fullName: norm.fullName,
    designation: norm.designation,
    hasPhoto,
    photoUrl: hasPhoto ? `/api/rotaract/members/${encodeURIComponent(norm.id)}/photo${cacheBust}` : null,
    displayOrder: norm.displayOrder
  };
}

/**
 * Sanitized Admin DTO: hides raw server disk path (`photoPath`) while exposing full management metadata.
 */
export function toAdminMemberDto(record) {
  const norm = normalizeRecord(record);
  if (!norm) return null;
  const hasPhoto = Boolean(norm.photoPath);
  const cacheBust = norm.updatedAt ? `?v=${encodeURIComponent(norm.updatedAt)}` : '';
  return {
    id: norm.id,
    fullName: norm.fullName,
    designation: norm.designation,
    isPublic: norm.isPublic,
    displayOrder: norm.displayOrder,
    hasPhoto,
    photoUrl: norm.isPublic && hasPhoto ? `/api/rotaract/members/${encodeURIComponent(norm.id)}/photo${cacheBust}` : null,
    adminPhotoUrl: hasPhoto ? `/api/admin/rotaract/members/${encodeURIComponent(norm.id)}/photo${cacheBust}` : null,
    photoMime: norm.photoMime,
    photoSizeBytes: norm.photoSizeBytes,
    createdByAdminId: norm.createdByAdminId,
    updatedByAdminId: norm.updatedByAdminId,
    createdAt: norm.createdAt,
    updatedAt: norm.updatedAt
  };
}

function readAllRawMembers(opts = {}) {
  const { db } = opts;
  if (hasRotaractTable(db)) {
    const rows = db.prepare(`
      SELECT * FROM rotaract_members
      ORDER BY display_order ASC, created_at ASC
    `).all();
    return sortMembers(rows.map(normalizeRecord));
  }
  const { ledgerPath } = ensureStorageDirs(opts);
  return sortMembers(readLedger(ledgerPath).map(normalizeRecord).filter(Boolean));
}

function getRawMemberById(id, opts = {}) {
  if (!id || typeof id !== 'string') return null;
  const { db } = opts;
  if (hasRotaractTable(db)) {
    const row = db.prepare('SELECT * FROM rotaract_members WHERE id = ?').get(id);
    return normalizeRecord(row);
  }
  const members = readAllRawMembers(opts);
  return members.find((m) => m.id === id) || null;
}

export function listPublicMembers({ search = '', designation = '' } = {}, opts = {}) {
  const all = readAllRawMembers(opts);
  const publicMembers = all.filter((m) => m.isPublic);

  const designations = [...new Set(publicMembers.map((m) => m.designation).filter(Boolean))];
  const cleanSearch = String(search || '').trim().toLowerCase();
  const cleanDesignation = String(designation || '').trim().toLowerCase();

  const filtered = publicMembers.filter((m) => {
    if (cleanDesignation && cleanDesignation !== 'all') {
      if (m.designation.toLowerCase() !== cleanDesignation) return false;
    }
    if (cleanSearch) {
      const matchesName = m.fullName.toLowerCase().includes(cleanSearch);
      const matchesDesig = m.designation.toLowerCase().includes(cleanSearch);
      if (!matchesName && !matchesDesig) return false;
    }
    return true;
  });

  return {
    members: filtered.map(toPublicMemberDto),
    totalPublic: publicMembers.length,
    filteredCount: filtered.length,
    designations
  };
}

export function listAllMembersAdmin(opts = {}) {
  const all = readAllRawMembers(opts);
  const dtos = all.map(toAdminMemberDto);
  const designations = [...new Set(dtos.map((m) => m.designation).filter(Boolean))];
  return {
    members: dtos,
    storageMode: hasRotaractTable(opts.db) ? 'sqlite' : 'filesystem-ledger',
    stats: {
      total: dtos.length,
      publishedCount: dtos.filter((m) => m.isPublic).length,
      hiddenCount: dtos.filter((m) => !m.isPublic).length,
      withPhotoCount: dtos.filter((m) => m.hasPhoto).length
    },
    designations
  };
}

export function getPublicMemberPhoto(id, opts = {}) {
  const member = getRawMemberById(id, opts);
  if (!member || !member.isPublic || !member.photoPath) {
    return null;
  }
  const safeFile = resolveSafePhotoFile(member.photoPath, opts);
  if (!safeFile) return null;
  return {
    ...safeFile,
    mime: member.photoMime || safeFile.mime
  };
}

export function getAdminMemberPhoto(id, opts = {}) {
  const member = getRawMemberById(id, opts);
  if (!member || !member.photoPath) {
    return null;
  }
  const safeFile = resolveSafePhotoFile(member.photoPath, opts);
  if (!safeFile) return null;
  return {
    ...safeFile,
    mime: member.photoMime || safeFile.mime
  };
}

export function createMember({ fullName, designation, photoPayload, isPublic = true, adminId = null }, opts = {}) {
  const nameCheck = normalizeText(fullName, 'Full name', 120);
  if (!nameCheck.valid) {
    return { success: false, status: 400, code: 'INVALID_FULL_NAME', error: nameCheck.error };
  }

  const desigCheck = normalizeText(designation, 'Designation', 120);
  if (!desigCheck.valid) {
    return { success: false, status: 400, code: 'INVALID_DESIGNATION', error: desigCheck.error };
  }

  let imgValidation = null;
  if (photoPayload) {
    imgValidation = validateImagePayload(photoPayload, {
      maxSize: config.MAX_ROTARACT_PHOTO_SIZE_BYTES || 3 * 1024 * 1024,
      minDim: 16,
      maxDim: 8192
    });
    if (!imgValidation.valid) {
      return { success: false, status: 400, code: 'INVALID_MEMBER_PHOTO', error: imgValidation.error };
    }
  }

  const id = `rtr_${crypto.randomUUID()}`;
  const nowIso = new Date().toISOString();
  const publicFlag = normalizeBoolean(isPublic, true);

  let savedPhoto = null;
  if (imgValidation) {
    savedPhoto = savePhotoBuffer(id, imgValidation, opts);
  }

  const existing = readAllRawMembers(opts);
  const nextOrder = existing.length > 0
    ? Math.max(...existing.map((m) => Number(m.displayOrder) || 0)) + 1
    : 1;

  const newRecord = {
    id,
    fullName: nameCheck.value,
    designation: desigCheck.value,
    photoPath: savedPhoto ? savedPhoto.filename : null,
    photoMime: savedPhoto ? savedPhoto.mime : null,
    photoSizeBytes: savedPhoto ? savedPhoto.sizeBytes : null,
    isPublic: publicFlag,
    displayOrder: nextOrder,
    createdByAdminId: adminId || null,
    updatedByAdminId: adminId || null,
    createdAt: nowIso,
    updatedAt: nowIso
  };

  try {
    if (hasRotaractTable(opts.db)) {
      opts.db.prepare(`
        INSERT INTO rotaract_members (
          id, full_name, designation, photo_path, photo_mime, photo_size_bytes,
          is_public, display_order, created_by_admin_id, updated_by_admin_id, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        newRecord.id,
        newRecord.fullName,
        newRecord.designation,
        newRecord.photoPath,
        newRecord.photoMime,
        newRecord.photoSizeBytes,
        newRecord.isPublic ? 1 : 0,
        newRecord.displayOrder,
        newRecord.createdByAdminId,
        newRecord.updatedByAdminId,
        newRecord.createdAt,
        newRecord.updatedAt
      );
    } else {
      const { ledgerPath } = ensureStorageDirs(opts);
      const nextList = [...existing, newRecord];
      writeLedgerAtomic(ledgerPath, nextList);
    }
  } catch (err) {
    if (savedPhoto) {
      removePhotoFileSilently(savedPhoto.filename, opts);
    }
    throw err;
  }

  return {
    success: true,
    status: 201,
    member: toAdminMemberDto(newRecord)
  };
}

export function updateMember(id, { fullName, designation, photoPayload, removePhoto = false, isPublic }, adminId = null, opts = {}) {
  const existingMember = getRawMemberById(id, opts);
  if (!existingMember) {
    return { success: false, status: 404, code: 'MEMBER_NOT_FOUND', error: `Rotaract member '${id}' was not found.` };
  }

  let updatedName = existingMember.fullName;
  if (fullName !== undefined) {
    const nameCheck = normalizeText(fullName, 'Full name', 120);
    if (!nameCheck.valid) {
      return { success: false, status: 400, code: 'INVALID_FULL_NAME', error: nameCheck.error };
    }
    updatedName = nameCheck.value;
  }

  let updatedDesig = existingMember.designation;
  if (designation !== undefined) {
    const desigCheck = normalizeText(designation, 'Designation', 120);
    if (!desigCheck.valid) {
      return { success: false, status: 400, code: 'INVALID_DESIGNATION', error: desigCheck.error };
    }
    updatedDesig = desigCheck.value;
  }

  let newPhoto = null;
  if (photoPayload) {
    const imgValidation = validateImagePayload(photoPayload, {
      maxSize: config.MAX_ROTARACT_PHOTO_SIZE_BYTES || 3 * 1024 * 1024,
      minDim: 16,
      maxDim: 8192
    });
    if (!imgValidation.valid) {
      return { success: false, status: 400, code: 'INVALID_MEMBER_PHOTO', error: imgValidation.error };
    }
    newPhoto = savePhotoBuffer(id, imgValidation, opts);
  }

  const shouldRemovePhoto = normalizeBoolean(removePhoto, false) && !newPhoto;
  const oldPhotoToUnlink = (newPhoto || shouldRemovePhoto) ? existingMember.photoPath : null;

  const updatedRecord = {
    ...existingMember,
    fullName: updatedName,
    designation: updatedDesig,
    photoPath: newPhoto ? newPhoto.filename : (shouldRemovePhoto ? null : existingMember.photoPath),
    photoMime: newPhoto ? newPhoto.mime : (shouldRemovePhoto ? null : existingMember.photoMime),
    photoSizeBytes: newPhoto ? newPhoto.sizeBytes : (shouldRemovePhoto ? null : existingMember.photoSizeBytes),
    isPublic: isPublic !== undefined ? normalizeBoolean(isPublic, existingMember.isPublic) : existingMember.isPublic,
    updatedByAdminId: adminId || existingMember.updatedByAdminId,
    updatedAt: new Date().toISOString()
  };

  try {
    if (hasRotaractTable(opts.db)) {
      opts.db.prepare(`
        UPDATE rotaract_members
        SET full_name = ?, designation = ?, photo_path = ?, photo_mime = ?, photo_size_bytes = ?,
            is_public = ?, updated_by_admin_id = ?, updated_at = ?
        WHERE id = ?
      `).run(
        updatedRecord.fullName,
        updatedRecord.designation,
        updatedRecord.photoPath,
        updatedRecord.photoMime,
        updatedRecord.photoSizeBytes,
        updatedRecord.isPublic ? 1 : 0,
        updatedRecord.updatedByAdminId,
        updatedRecord.updatedAt,
        id
      );
    } else {
      const { ledgerPath } = ensureStorageDirs(opts);
      const currentList = readAllRawMembers(opts);
      const updatedList = currentList.map((m) => (m.id === id ? updatedRecord : m));
      writeLedgerAtomic(ledgerPath, updatedList);
    }
  } catch (err) {
    if (newPhoto) {
      removePhotoFileSilently(newPhoto.filename, opts);
    }
    throw err;
  }

  if (oldPhotoToUnlink && oldPhotoToUnlink !== updatedRecord.photoPath) {
    removePhotoFileSilently(oldPhotoToUnlink, opts);
  }

  return {
    success: true,
    status: 200,
    member: toAdminMemberDto(updatedRecord)
  };
}

export function reorderMembers(orderedIds, adminId = null, opts = {}) {
  if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
    return {
      success: false,
      status: 400,
      code: 'INVALID_REORDER_PAYLOAD',
      error: 'orderedIds must be a non-empty array of member IDs.'
    };
  }

  const cleanedIds = [];
  const seen = new Set();
  for (const rawId of orderedIds) {
    if (typeof rawId !== 'string' || !rawId.trim()) {
      return { success: false, status: 400, code: 'INVALID_REORDER_PAYLOAD', error: 'Each orderedIds entry must be a valid member ID string.' };
    }
    const clean = rawId.trim();
    if (!seen.has(clean)) {
      seen.add(clean);
      cleanedIds.push(clean);
    }
  }

  const currentMembers = readAllRawMembers(opts);
  const byId = new Map(currentMembers.map((m) => [m.id, m]));

  for (const id of cleanedIds) {
    if (!byId.has(id)) {
      return {
        success: false,
        status: 404,
        code: 'MEMBER_NOT_FOUND',
        error: `Cannot reorder: member ID '${id}' does not exist.`
      };
    }
  }

  const remainingMembers = currentMembers.filter((m) => !seen.has(m.id));
  const finalSequence = [
    ...cleanedIds.map((id) => byId.get(id)),
    ...remainingMembers
  ];

  const nowIso = new Date().toISOString();
  const reordered = finalSequence.map((member, index) => ({
    ...member,
    displayOrder: index + 1,
    updatedByAdminId: adminId || member.updatedByAdminId,
    updatedAt: nowIso
  }));

  if (hasRotaractTable(opts.db)) {
    const stmt = opts.db.prepare(`
      UPDATE rotaract_members
      SET display_order = ?, updated_by_admin_id = ?, updated_at = ?
      WHERE id = ?
    `);
    opts.db.exec('BEGIN TRANSACTION;');
    try {
      for (const m of reordered) {
        stmt.run(m.displayOrder, m.updatedByAdminId, m.updatedAt, m.id);
      }
      opts.db.exec('COMMIT;');
    } catch (err) {
      try {
        opts.db.exec('ROLLBACK;');
      } catch (_) {}
      throw err;
    }
  } else {
    const { ledgerPath } = ensureStorageDirs(opts);
    writeLedgerAtomic(ledgerPath, reordered);
  }

  return {
    success: true,
    status: 200,
    members: reordered.map(toAdminMemberDto)
  };
}

export function deleteMember(id, opts = {}) {
  const existingMember = getRawMemberById(id, opts);
  if (!existingMember) {
    return { success: false, status: 404, code: 'MEMBER_NOT_FOUND', error: `Rotaract member '${id}' was not found.` };
  }

  if (hasRotaractTable(opts.db)) {
    opts.db.prepare('DELETE FROM rotaract_members WHERE id = ?').run(id);
  } else {
    const { ledgerPath } = ensureStorageDirs(opts);
    const currentList = readAllRawMembers(opts);
    const remaining = currentList.filter((m) => m.id !== id).map((m, idx) => ({
      ...m,
      displayOrder: idx + 1
    }));
    writeLedgerAtomic(ledgerPath, remaining);
  }

  if (existingMember.photoPath) {
    removePhotoFileSilently(existingMember.photoPath, opts);
  }

  return {
    success: true,
    status: 200,
    deletedId: id,
    deletedName: existingMember.fullName
  };
}
