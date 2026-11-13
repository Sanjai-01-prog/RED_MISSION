/**
 * RED MISSION Database Migration — Stage 2.2
 * Authenticated Donor Registration and Visual Selfie Profile Architecture
 * 
 * Idempotently adds visual selfie, consent, and profile metadata columns
 * to the existing donor_profiles table while preserving all foreign keys and data.
 */

export function applyStage22Migration(db) {
  // 1. Check if migration is already recorded
  const migrationRow = db.prepare("SELECT version FROM schema_migrations WHERE version = 'stage_2_2'").get();
  if (migrationRow) {
    return {
      status: 'SKIPPED',
      version: 'stage_2_2',
      reason: 'Migration stage_2_2 has already been applied.'
    };
  }

  // 2. Inspect existing columns in donor_profiles
  const existingCols = db.prepare("PRAGMA table_info(donor_profiles)").all();
  const colNames = new Set(existingCols.map(c => c.name));

  db.exec('BEGIN TRANSACTION;');
  try {
    if (!colNames.has('profile_photo_path')) {
      db.exec('ALTER TABLE donor_profiles ADD COLUMN profile_photo_path TEXT NULL;');
    }
    if (!colNames.has('profile_photo_mime')) {
      db.exec('ALTER TABLE donor_profiles ADD COLUMN profile_photo_mime TEXT NULL;');
    }
    if (!colNames.has('profile_photo_size_bytes')) {
      db.exec('ALTER TABLE donor_profiles ADD COLUMN profile_photo_size_bytes INTEGER NULL;');
    }
    if (!colNames.has('profile_photo_updated_at')) {
      db.exec('ALTER TABLE donor_profiles ADD COLUMN profile_photo_updated_at DATETIME NULL;');
    }
    if (!colNames.has('selfie_consent_given')) {
      db.exec('ALTER TABLE donor_profiles ADD COLUMN selfie_consent_given INTEGER DEFAULT 0 NOT NULL CHECK(selfie_consent_given IN (0, 1));');
    }
    if (!colNames.has('selfie_consent_at')) {
      db.exec('ALTER TABLE donor_profiles ADD COLUMN selfie_consent_at DATETIME NULL;');
    }
    if (!colNames.has('is_photo_public')) {
      db.exec('ALTER TABLE donor_profiles ADD COLUMN is_photo_public INTEGER DEFAULT 1 NOT NULL CHECK(is_photo_public IN (0, 1));');
    }

    // Record migration in schema_migrations
    db.prepare(`
      INSERT INTO schema_migrations (version, description, applied_at)
      VALUES ('stage_2_2', 'Stage 2.2 Authenticated Donor Registration and Visual Selfie Profile Architecture', CURRENT_TIMESTAMP)
    `).run();

    db.exec('COMMIT;');

    return {
      status: 'APPLIED',
      version: 'stage_2_2',
      description: 'Stage 2.2 Authenticated Donor Registration and Visual Selfie Profile Architecture'
    };
  } catch (err) {
    db.exec('ROLLBACK;');
    throw err;
  }
}
