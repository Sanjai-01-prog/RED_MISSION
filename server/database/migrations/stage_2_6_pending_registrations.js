/**
 * RED MISSION Database Migration — Stage 2.6
 * Persistent Multi-Step User Registration State
 * 
 * Creates pending_user_registrations table to persist multi-step registration
 * sessions across server restarts and prevent session loss.
 */

export function applyStage26Migration(db) {
  // 1. Check if migration is already recorded
  const migrationRow = db.prepare("SELECT version FROM schema_migrations WHERE version = 'stage_2_6'").get();
  if (migrationRow) {
    return {
      status: 'SKIPPED',
      version: 'stage_2_6',
      reason: 'Migration stage_2_6 has already been applied.'
    };
  }

  db.exec('BEGIN TRANSACTION;');
  try {
    // 2. Create pending_user_registrations table
    db.exec(`
      CREATE TABLE IF NOT EXISTS pending_user_registrations (
        token_hash TEXT PRIMARY KEY,
        full_name TEXT NOT NULL,
        mobile_number TEXT NOT NULL,
        email TEXT NOT NULL,
        age INTEGER NOT NULL,
        blood_group TEXT NOT NULL,
        city TEXT NOT NULL,
        mobile_verified INTEGER DEFAULT 0 NOT NULL CHECK(mobile_verified IN (0, 1)),
        email_verified INTEGER DEFAULT 0 NOT NULL CHECK(email_verified IN (0, 1)),
        mobile_otp_hash TEXT NOT NULL,
        mobile_otp_salt TEXT NOT NULL,
        mobile_otp_expires_at DATETIME NOT NULL,
        email_otp_hash TEXT NULL,
        email_otp_salt TEXT NULL,
        email_otp_expires_at DATETIME NULL,
        mobile_attempts INTEGER DEFAULT 0 NOT NULL,
        email_attempts INTEGER DEFAULT 0 NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
        expires_at DATETIME NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_pending_reg_mobile ON pending_user_registrations (mobile_number);
      CREATE INDEX IF NOT EXISTS idx_pending_reg_email ON pending_user_registrations (email);
      CREATE INDEX IF NOT EXISTS idx_pending_reg_expires ON pending_user_registrations (expires_at);
    `);

    // 3. Record migration in schema_migrations
    db.prepare(`
      INSERT INTO schema_migrations (version, description, applied_at)
      VALUES ('stage_2_6', 'Stage 2.6 Persistent Multi-Step User Registration Table', CURRENT_TIMESTAMP)
    `).run();

    db.exec('COMMIT;');

    return {
      status: 'APPLIED',
      version: 'stage_2_6',
      description: 'Stage 2.6 Persistent Multi-Step User Registration Table'
    };
  } catch (err) {
    db.exec('ROLLBACK;');
    throw err;
  }
}
