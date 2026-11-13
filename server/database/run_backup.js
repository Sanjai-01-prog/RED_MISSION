/**
 * RED MISSION — Standalone Production Database Backup Runner
 * Creates a consistent, self-verifying, WAL-safe SQLite snapshot of the active database.
 * 
 * Usage:
 *   node server/database/run_backup.js [--label <label>]
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from '../config/env.js';
import { createDatabaseBackup } from './backupManager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '../..');

const labelArgIndex = process.argv.indexOf('--label');
const label = labelArgIndex !== -1 && process.argv[labelArgIndex + 1] ? process.argv[labelArgIndex + 1] : 'manual_backup';

const backupsDir = config.BACKUP_DIR || path.resolve(PROJECT_ROOT, 'backups');

console.log('======================================================');
console.log('  RED MISSION DATABASE BACKUP UTILITY');
console.log('======================================================');
console.log(`Source Database: ${path.basename(config.DB_PATH)}`);
console.log(`Backups Target:  ${backupsDir}`);
console.log(`Backup Label:    ${label}\n`);

try {
  const result = createDatabaseBackup({
    sourcePath: config.DB_PATH,
    targetDir: backupsDir,
    label
  });

  console.log('✓ Backup Snapshot Created Successfully!');
  console.log(`  Backup File:      ${result.backupPath}`);
  console.log(`  Manifest File:    ${result.manifestPath}`);
  console.log(`  Source Size:      ${result.sourceSizeBytes} bytes`);
  console.log(`  Backup Size:      ${result.backupSizeBytes} bytes`);
  console.log(`  Integrity Check:  ${result.integrityCheck}`);
  console.log(`  FK Violations:    ${result.foreignKeyViolations}`);
  console.log(`  Migrations:       ${result.migrationsPresent.join(', ')}`);
  if (result.diskSpaceCheck) {
    console.log(`  Disk Space Check: ${result.diskSpaceCheck.status}`);
  }
  console.log('\nBackup operation completed and verified.');
} catch (err) {
  console.error('\n[BACKUP FAILED]:', err.message);
  process.exit(1);
}
