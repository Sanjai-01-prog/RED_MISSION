/**
 * RED MISSION Database Migration — Stage 3.3
 * User Terms & Conditions and Privacy Policy Consent Tracking
 * 
 * Creates user_consents table to store legally defensible, versioned consent records,
 * and adds consent columns to pending_user_registrations for multi-step session tracking.
 */

export function applyStage33Migration(db) {
  // 1. Check if migration already recorded
  const migrationRow = db.prepare("SELECT version FROM schema_migrations WHERE version = 'stage_3_3'").get();
  if (migrationRow) {
    return {
      status: 'SKIPPED',
      version: 'stage_3_3',
      reason: 'Migration stage_3_3 has already been applied.'
    };
  }

  db.exec('BEGIN TRANSACTION;');
  try {
    // 2. Create user_consents table
    db.exec(`
      CREATE TABLE IF NOT EXISTS user_consents (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        terms_accepted INTEGER DEFAULT 0 NOT NULL CHECK(terms_accepted IN (0, 1)),
        terms_version TEXT NOT NULL,
        terms_accepted_at DATETIME NOT NULL,
        privacy_accepted INTEGER DEFAULT 0 NOT NULL CHECK(privacy_accepted IN (0, 1)),
        privacy_version TEXT NOT NULL,
        privacy_accepted_at DATETIME NOT NULL,
        ip_address TEXT NULL,
        user_agent TEXT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_user_consents_user ON user_consents(user_id);
    `);

    // 3. Add consent tracking columns to pending_user_registrations if the table exists
    const pendingTableExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='pending_user_registrations'").get();
    if (pendingTableExists) {
      const pendingTableInfo = db.prepare('PRAGMA table_info(pending_user_registrations)').all();
      const hasTermsCol = pendingTableInfo.some(col => col.name === 'terms_accepted');

      if (!hasTermsCol) {
        db.exec(`
          ALTER TABLE pending_user_registrations ADD COLUMN terms_accepted INTEGER DEFAULT 0 NOT NULL;
          ALTER TABLE pending_user_registrations ADD COLUMN terms_version TEXT NULL;
          ALTER TABLE pending_user_registrations ADD COLUMN terms_accepted_at DATETIME NULL;
          ALTER TABLE pending_user_registrations ADD COLUMN privacy_accepted INTEGER DEFAULT 0 NOT NULL;
          ALTER TABLE pending_user_registrations ADD COLUMN privacy_version TEXT NULL;
          ALTER TABLE pending_user_registrations ADD COLUMN privacy_accepted_at DATETIME NULL;
        `);
      }
    }

    // 4. Record migration in schema_migrations
    db.prepare(`
      INSERT INTO schema_migrations (version, description, applied_at)
      VALUES ('stage_3_3', 'Stage 3.3 User Terms & Conditions and Privacy Policy Consent Tracking', CURRENT_TIMESTAMP)
    `).run();

    db.exec('COMMIT;');

    return {
      status: 'APPLIED',
      version: 'stage_3_3',
      description: 'Stage 3.3 User Terms & Conditions and Privacy Policy Consent Tracking'
    };
  } catch (err) {
    db.exec('ROLLBACK;');
    throw err;
  }
}
