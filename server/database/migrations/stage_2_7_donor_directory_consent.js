/**
 * RED MISSION Database Migration — Stage 2.7
 * Donor Directory Listing Consent and Public Discovery Safeguards
 * 
 * Adds consent_directory_listing column to donor_profiles table
 * with 0 (opt-out / private) default, and creates a performance index.
 */

export function applyStage27Migration(db) {
  // 1. Check if migration is already recorded
  const migrationRow = db.prepare("SELECT version FROM schema_migrations WHERE version = 'stage_2_7'").get();
  if (migrationRow) {
    return {
      status: 'SKIPPED',
      version: 'stage_2_7',
      reason: 'Migration stage_2_7 has already been applied.'
    };
  }

  db.exec('BEGIN TRANSACTION;');
  try {
    // 2. Check if column already exists in donor_profiles
    const tableInfo = db.prepare('PRAGMA table_info(donor_profiles)').all();
    const hasColumn = tableInfo.some(col => col.name === 'consent_directory_listing');

    if (!hasColumn) {
      db.exec(`
        ALTER TABLE donor_profiles 
        ADD COLUMN consent_directory_listing INTEGER DEFAULT 0 NOT NULL CHECK(consent_directory_listing IN (0, 1));
      `);
    }

    // 3. Create index for directory filtering
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_donor_directory_listing 
      ON donor_profiles (consent_directory_listing, is_available_for_emergency);
    `);

    // 4. Record migration in schema_migrations
    db.prepare(`
      INSERT INTO schema_migrations (version, description, applied_at)
      VALUES ('stage_2_7', 'Stage 2.7 Donor Directory Listing Explicit Consent Flag and Public Discovery Safeguards', CURRENT_TIMESTAMP)
    `).run();

    db.exec('COMMIT;');

    return {
      status: 'APPLIED',
      version: 'stage_2_7',
      description: 'Stage 2.7 Donor Directory Listing Explicit Consent Flag and Public Discovery Safeguards'
    };
  } catch (err) {
    db.exec('ROLLBACK;');
    throw err;
  }
}
