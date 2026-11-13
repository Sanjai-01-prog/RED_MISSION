/**
 * Stage 3.2 Migration: Rotaract College Members Directory Table
 * Prepared separately for official deployment maintenance window.
 * DO NOT auto-run against the production database without explicit approval.
 */

export function applyStage32Migration(db) {
  if (!db) {
    throw new Error('Database instance is required to apply Stage 3.2 migration.');
  }

  const migrationId = 'stage_3_2_rotaract_members';

  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      description TEXT NOT NULL,
      applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const alreadyApplied = db.prepare('SELECT version FROM schema_migrations WHERE version = ?').get(migrationId);
  if (alreadyApplied) {
    return { applied: false, alreadyApplied: true };
  }

  db.exec('BEGIN TRANSACTION;');
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS rotaract_members (
        id TEXT PRIMARY KEY,
        full_name TEXT NOT NULL,
        designation TEXT NOT NULL,
        photo_path TEXT NULL,
        photo_mime TEXT NULL,
        photo_size_bytes INTEGER NULL,
        is_public INTEGER NOT NULL DEFAULT 1 CHECK(is_public IN (0, 1)),
        display_order INTEGER NOT NULL DEFAULT 0,
        created_by_admin_id TEXT NULL,
        updated_by_admin_id TEXT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_rotaract_members_order
        ON rotaract_members(display_order ASC, created_at ASC);

      CREATE INDEX IF NOT EXISTS idx_rotaract_members_public
        ON rotaract_members(is_public, display_order ASC);
    `);

    db.prepare(`
      INSERT INTO schema_migrations (version, description, applied_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)
    `).run(migrationId, 'Stage 3.2 Rotaract College Members Directory Table');
    db.exec('COMMIT;');
    return { applied: true, alreadyApplied: false };
  } catch (err) {
    try {
      db.exec('ROLLBACK;');
    } catch (_) {
      // ignore rollback errors
    }
    throw err;
  }
}
