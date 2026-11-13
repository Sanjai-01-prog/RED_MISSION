/**
 * RED MISSION Database Migration — Stage 2.4
 * Donor Photo Privacy by Default and Admin Session Authorization
 * 
 * Idempotently aligns existing donor profiles to private-by-default (0)
 * and records the stage_2_4 migration in schema_migrations.
 */

export function applyStage24Migration(db) {
  // 1. Check if migration is already recorded
  const migrationRow = db.prepare("SELECT version FROM schema_migrations WHERE version = 'stage_2_4'").get();
  if (migrationRow) {
    return {
      status: 'SKIPPED',
      version: 'stage_2_4',
      reason: 'Migration stage_2_4 has already been applied.'
    };
  }

  db.exec('BEGIN TRANSACTION;');
  try {
    // 2. Ensure any null or uninitialized values in donor_profiles are set to 0 (private by default)
    db.prepare(`
      UPDATE donor_profiles 
      SET is_photo_public = 0 
      WHERE is_photo_public IS NULL;
    `).run();

    // 3. Record migration in schema_migrations
    db.prepare(`
      INSERT INTO schema_migrations (version, description, applied_at)
      VALUES ('stage_2_4', 'Stage 2.4 Donor Photo Privacy by Default and Admin Session Authorization', CURRENT_TIMESTAMP)
    `).run();

    db.exec('COMMIT;');

    return {
      status: 'APPLIED',
      version: 'stage_2_4',
      description: 'Stage 2.4 Donor Photo Privacy by Default and Admin Session Authorization'
    };
  } catch (err) {
    db.exec('ROLLBACK;');
    throw err;
  }
}
