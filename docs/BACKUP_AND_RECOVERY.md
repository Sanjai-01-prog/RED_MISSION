# RED MISSION — SQLite Backup & Disaster Recovery Guide

This document establishes the official backup, verification, and disaster recovery procedures for the RED MISSION relational database (`red_mission.db`).

---

## 1. Architecture & WAL Mode Safety

RED MISSION utilizes SQLite via Node.js native `node:sqlite` in **Write-Ahead Logging (WAL)** mode (`PRAGMA journal_mode = WAL;`).

### 1.1 The WAL-Mode Backup Hazard
In WAL mode, committed changes may temporarily reside in the `-wal` file (`red_mission.db-wal`) before being checkpointed back into the primary database file (`red_mission.db`).
- **Danger of Raw File Copying:** Performing a standard file copy (`cp`, `Copy-Item`) while the server is active can result in an incomplete or corrupt snapshot because newly committed pages in the WAL file are not captured atomically.

### 1.2 The Solution — `VACUUM INTO` with Atomic Staging
RED MISSION uses SQLite's native `VACUUM INTO` command with isolated staging:
- It opens the source database in strict read-only mode (`{ readOnly: true }`).
- It merges all committed pages from both the primary database and the active WAL log into a single, clean, fully-checkpointed, defragmented destination file.
- It stages the snapshot to an exclusively owned private temporary directory (`.staging_*`) created via atomic exclusive directory allocation with collision retry, verifying its integrity before promoting it to the final destination.
- **Individual Atomic No-Overwrite Publication:** Protects against publication collisions by publishing individual files using atomic no-overwrite filesystem operations (`publishFileAtomicNoOverwrite()`). It uses hard links (`fs.linkSync`) where supported on the same filesystem or atomic exclusive copy (`fs.copyFileSync` with `fs.constants.COPYFILE_EXCL`). If a destination exists beforehand or is created concurrently by another process between check and promotion, the OS atomically rejects that file's publication with `EEXIST`. It never falls back to ordinary `renameSync()`.
- **Publication Atomicity Boundaries:** While individual file publications use atomic no-overwrite operations where supported, publishing both a database file and its manifest is not one atomic multi-file transaction. Standard filesystems do not support atomic multi-file directory transactions.
- **Ownership-Safe Rollback:** Captures destination 64-bit device ID (`dev`) and inode / NTFS File Reference Number (`ino`) immediately upon publication. If publication fails before commit, rollback verifies ownership before unlinking. If another process replaced the file or if reliable filesystem identity is unsupported (`ino === 0n`), rollback fails closed, strictly preserving the file on disk and recording a diagnostic operator warning.
- **Sequential Best-Effort Rollback & Orphan Risk:** Two-file rollback across independent filesystem `unlink` operations is sequential best effort rather than an atomic transaction. If an error occurs after both files have been published to disk, the utility attempts to roll back both files sequentially. If one deletion succeeds and the other fails (e.g. due to file locks, permission errors, or foreign replacement), a partial rollback can leave an orphaned database or manifest file. Incomplete backup pairs must never be treated as valid backups or replicated as completed backups.
- **Mid-Flight Failure Cleanup:** If SQLite encounters an error during `VACUUM INTO` (e.g. `SQLITE_FULL`, `SQLITE_IOERR`), the uniquely owned private staging directory and its contents are immediately removed, leaving zero orphaned files. Pre-existing files in the destination directory are never touched.
- The resulting `.db` backup file has **zero dependency** on `.db-wal` or `.db-shm` and can be inspected or restored anywhere independently.
- It has built-in overwrite protection (fails if the destination file or manifest already exists).

### 1.3 Logical Snapshot Consistency vs. Physical Storage Durability

A critical distinction must be maintained between **SQLite logical snapshot consistency** and **physical storage durability**:

1. **Logical Consistency via `VACUUM INTO`:**
   - `VACUUM INTO` guarantees transactional and relational consistency at the SQLite database engine level.
   - It captures all committed pages from both the primary `.db` and the active `.db-wal` file into a single serializable snapshot.
   - It verifies B-tree structural integrity and defragments the destination database file.

2. **Physical Storage Durability Boundaries:**
   - Although the file is written to the destination filesystem, local OS file caches, disk controller buffers, or write-combining buffers may delay physical media writes.
   - A sudden power outage, hardware crash, or operating system panic immediately following backup creation could leave un-flushed pages corrupted on disk if hardware-level flush (`FlushFileBuffers` / `fsync`) is interrupted.
   - **Single Point of Failure (SPOF):** Storing backups on the same physical drive, partition, or host machine as the live database provides zero protection against disk failure, host corruption, accidental partition formatting, or storage media destruction.

3. **Mandatory Disaster Recovery Requirements:**
   - **Secondary Offsite Replication:** Production backup `.db` and `.manifest.json` files must be automatically copied to a physically isolated offsite storage tier (e.g. encrypted cloud bucket, isolated network storage) following generation.
   - **Immutability (WORM):** Backups should be transferred using append-only or Write Once Read Many (WORM) storage policies to prevent tampering or accidental deletion.
   - **Pre-Backup Disk Space Checks:** The utility performs pre-backup filesystem capacity checks (`fs.statfsSync`) requiring at least 2x source size + 10 MiB safety margin before initiating `VACUUM INTO`.

### 1.4 Filesystem Strategy & Platform Compatibility
The backup utility establishes rigorous filesystem guarantees while explicitly acknowledging operating system boundaries:
- **Hard-Link Publication (`fs.linkSync`):** Used when source and destination reside on the same filesystem and the host operating system/user privileges permit hard links.
- **Atomic Exclusive Copy (`fs.copyFileSync` with `fs.constants.COPYFILE_EXCL`):** Used on platforms or filesystems where hard links are unsupported, cross-device (`EXDEV`), or restricted by security policy (`EPERM`), such as standard unprivileged Windows user sessions. This maps directly to `COPY_FILE_FAIL_IF_EXISTS` on Windows and `O_CREAT | O_EXCL` on POSIX, guaranteeing atomic failure if the destination file exists.
- **Zero Fallback to `renameSync()`:** The utility strictly forbids ordinary `renameSync()`, preventing silent destination overwrites.
- **Fail-Closed File Identity (`verifyFileIdentity`):** Requires non-zero device ID (`dev`) and non-zero inode / NTFS File Reference Number (`ino`). If `ino === 0n` (e.g. FAT32, exFAT, or network shares without file ID support) or identity cannot be reliably established, verification returns `UNAVAILABLE`. Crucially, matching timestamps (`mtime`, `birthtime`) and file sizes alone are never treated as proof of ownership. If ownership cannot be established, rollback fails closed by preserving the file on disk and logging an operator warning.
- **Publication State Machine & Multi-File Atomicity Limits:** Publication proceeds through explicit state transitions (`INITIAL` -> `STAGING` -> `STAGED_AND_VERIFIED` -> `DATABASE_PUBLISHED` -> `MANIFEST_PUBLISHED` -> `COMMITTED`). A complete backup consists of an inseparable database and manifest pair. However, publishing a database and manifest is not one atomic multi-file transaction, as underlying operating systems provide no transactional multi-file publication primitive. Once `COMMITTED`, ordinary post-commit cleanup errors never delete either file.
- **Sequential Best-Effort Rollback & Partial Failure Handling:** If a failure occurs before commit, rollback is attempted sequentially (database first, manifest second). Two-file rollback is sequential best effort; if the database is unlinked but manifest rollback fails (e.g. file lock or permissions error), an orphaned manifest remains. Conversely, if manifest rollback succeeds but database rollback fails, an orphaned database remains. Incomplete backup pairs must not be treated as valid backups or replicated to offsite storage as completed backups.
- **Rollback TOCTOU Defense & Residual Window:** Path-based `stat` followed by `unlink` is not an atomic operation in user space. To prevent race replacements from causing the deletion of foreign files, `ownershipSafeRollback` performs an immediate pre-unlink identity verification re-check right before unlinking. If a replacement file is detected, deletion is aborted and the file is preserved. While this immediate pre-unlink verification reduces the TOCTOU window to microseconds, it does not mathematically eliminate it in user space.

---

## 2. How to Create a Backup

### Method A: Standalone CLI Runner
Run the official backup runner from the project root:

```bash
node server/database/run_backup.js --label pre_migration_stage_2_6
```

Output:
- Creates `backups/red_mission_backup_YYYYMMDD_HHMMSS.db`
- Generates `backups/red_mission_backup_YYYYMMDD_HHMMSS.manifest.json`
- Prints source size, backup size, integrity status, and detected migration history.

### Method B: Programmatic Usage (Node.js)
```javascript
import { createDatabaseBackup } from './server/database/backupManager.js';

const result = createDatabaseBackup({
  sourcePath: 'server/data/red_mission.db',
  targetDir: 'backups',
  label: 'pre_migration_stage_2_6'
});

console.log('Backup created at:', result.backupPath);
console.log('Manifest created at:', result.manifestPath);
```

---

## 3. How to Verify a Backup File

### Self-Verification on Creation
Every backup created with `createDatabaseBackup()` automatically performs an immediate, independent read-only verification:
1. `PRAGMA integrity_check;` — confirms the B-tree structure, pages, and indexes are intact (`ok`).
2. `PRAGMA foreign_key_check;` — confirms zero foreign key constraint violations.
3. Schema migration audit — checks that the `schema_migrations` table is intact.

### Manual Verification of Any Existing Backup File
To verify any existing backup file independently:
```javascript
import { verifyBackupFile } from './server/database/backupManager.js';

const status = verifyBackupFile('backups/red_mission_backup_20261110_194500.db');
console.log('Integrity:', status.integrityCheck); // 'ok'
console.log('Foreign key violations:', status.foreignKeyViolations); // 0
console.log('Tables present:', status.tables.join(', '));
console.log('Migrations present:', status.migrationsPresent.join(', '));
```

---

## 4. How to Verify a Restored Copy in Scratch

Before restoring into production, the backup's schema and data can be verified against a reference database in an isolated scratch environment:

```javascript
import { verifyRestoreSimulation } from './server/database/backupManager.js';

const report = verifyRestoreSimulation({
  backupDbPath: 'backups/red_mission_backup_20261110_194500.db',
  referenceSourcePath: 'server/data/red_mission.db',
  targetScratchDir: 'scratch/verification_restore',
  restoredFilename: 'restored_check.db'
});

console.log('Restore Verified:', report.success);
console.log('Table Row Counts:', report.rowCounts);
console.log('Indexes Verified:', report.indexesCount);
console.log('Views Verified:', report.viewsCount);
console.log('Triggers Verified:', report.triggersCount);
console.log('Schema Mismatches:', report.schemaMismatches.length);
```

**Built-in Safety & Verification Features:**
- **Fail-Closed Junction & Symlink Protection:** `verifyRestoreSimulation()` resolves physical filesystem paths using `resolvePhysicalPath()`. If path resolution is uncertain, broken, or encounters filesystem permission errors, it immediately fails closed by throwing a safety error, strictly preventing restores into `server/data/`, relative traversal paths (`../../server/data`), case variations (`SERVER/DATA`), or directory junctions pointing to production paths.
- **Comment-Aware & Literal-Preserving `sqlite_master` Verification:** Compares all database objects — tables, user indexes, views, and triggers — using a comment-aware lexical tokenizer. SQL comments (`--` line comments and `/* ... */` block comments) are safely ignored without treating apostrophes inside comments as string delimiters. Crucially, exact casing and escaped single quotes inside single-quoted string literals (`'...'`) and quoted identifiers (`"..."`) are preserved, ensuring case-sensitive CHECK constraints, DEFAULT expressions, and trigger bodies are verified without masking schema drift. SQLite internal autoindexes (`sqlite_autoindex_%`) are ignored.
- **Deep Row Count & Foreign Key Checks:** Compares row counts for every table between the reference and restored database, and confirms zero foreign key violations.

---

## 5. Manual Disaster Recovery / Restore Procedure

If a production database migration fails or data corruption occurs, follow this exact step-by-step procedure:

1. **Stop the Backend Application Server:**
   Terminate any running Node.js process using `server/index.js` to release database file locks.

2. **Select and Verify the Target Backup:**
   Inspect the manifest in `backups/` and verify the backup file using `verifyBackupFile()`:
   ```bash
   node -e "import('./server/database/backupManager.js').then(m => console.log(m.verifyBackupFile('backups/<backup_filename>.db')))"
   ```
   Confirm `integrityCheck: 'ok'` and `foreignKeyViolations: 0`.

3. **Archive the Current Corrupted/Failed Database:**
   Do not delete the existing database files immediately. Move them to a quarantine directory:
   ```bash
   mkdir server/data/quarantine_YYYYMMDD_HHMMSS
   mv server/data/red_mission.db* server/data/quarantine_YYYYMMDD_HHMMSS/
   ```

4. **Copy the Verified Backup into Place:**
   Copy the single `.db` backup file to `server/data/red_mission.db`:
   ```bash
   cp backups/<backup_filename>.db server/data/red_mission.db
   ```
   *(Note: Do NOT copy old `-wal` or `-shm` files; SQLite will regenerate clean ones upon the first connection).*

5. **Run Sanity Check:**
   Run a read-only integrity check on the newly restored database:
   ```bash
   node -e "import('./server/database/backupManager.js').then(m => console.log(m.verifyBackupFile('server/data/red_mission.db')))"
   ```

6. **Restart Backend Service:**
   Start the Node.js server (`npm start` or process manager) and monitor startup logs.

---

## 6. Pre-Migration Protocol Checklist

Before executing any database migration in production:
- [ ] Confirm active database file size and timestamp.
- [ ] Execute `createDatabaseBackup()` to capture an atomic snapshot.
- [ ] Confirm that `integrity_check` is `'ok'` in the generated manifest.
- [ ] Confirm the backup file size matches expected database contents.
- [ ] Verify that no uncheckpointed migrations or uncommitted transactions exist.
- [ ] Execute migrations in strict sequential order.
- [ ] Run a post-migration health check to verify integrity and foreign keys.
