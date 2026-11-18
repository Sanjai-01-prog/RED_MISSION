/**
 * RED MISSION Database Migration — Stage 3.5
 * Date of Birth (DOB) and Gender Demographic Support:
 * Adds nullable date_of_birth and gender columns to both users and
 * pending_user_registrations tables, strictly preserving existing legacy records.
 */

export function applyStage35Migration(db) {
  // 1. Check if migration is already recorded
  const migrationRow = db.prepare("SELECT version FROM schema_migrations WHERE version = 'stage_3_5'").get();
  if (migrationRow) {
    return {
      status: 'SKIPPED',
      version: 'stage_3_5',
      reason: 'Migration stage_3_5 has already been applied.'
    };
  }

  db.exec('BEGIN TRANSACTION;');
  try {
    // 2. Add columns to users table
    const userTableInfo = db.prepare("PRAGMA table_info(users)").all();
    const existingUserCols = new Set(userTableInfo.map(c => c.name));

    if (!existingUserCols.has('date_of_birth')) {
      db.exec("ALTER TABLE users ADD COLUMN date_of_birth TEXT NULL;");
    }
    if (!existingUserCols.has('gender')) {
      db.exec("ALTER TABLE users ADD COLUMN gender TEXT NULL;");
    }

    // 3. Add columns to pending_user_registrations table if it exists
    const pendingTableCheck = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='pending_user_registrations'").get();
    if (pendingTableCheck) {
      const pendingTableInfo = db.prepare("PRAGMA table_info(pending_user_registrations)").all();
      const existingPendingCols = new Set(pendingTableInfo.map(c => c.name));

      if (!existingPendingCols.has('date_of_birth')) {
        db.exec("ALTER TABLE pending_user_registrations ADD COLUMN date_of_birth TEXT NULL;");
      }
      if (!existingPendingCols.has('gender')) {
        db.exec("ALTER TABLE pending_user_registrations ADD COLUMN gender TEXT NULL;");
      }
    }

    // 4. Performance index for date_of_birth
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_users_dob ON users(date_of_birth);
    `);

    // 5. Record migration in schema_migrations
    db.prepare(`
      INSERT INTO schema_migrations (version, description, applied_at)
      VALUES ('stage_3_5', 'Stage 3.5 Date of Birth and Gender Demographic Support', CURRENT_TIMESTAMP)
    `).run();

    db.exec('COMMIT;');

    return {
      status: 'APPLIED',
      version: 'stage_3_5',
      description: 'Stage 3.5 Date of Birth and Gender Demographic Support'
    };
  } catch (err) {
    try {
      db.exec('ROLLBACK;');
    } catch {}
    throw err;
  }
}
