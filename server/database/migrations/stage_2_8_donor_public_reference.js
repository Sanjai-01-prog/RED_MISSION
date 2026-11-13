/**
 * RED MISSION Database Migration — Stage 2.8
 * Persistent 128-bit Random Public Donor Reference and Direct Indexed Lookup
 * 
 * Adds public_reference column to donor_profiles table,
 * backfills existing records with cryptographically random 128-bit 'DNR-XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX' identifiers,
 * and creates a unique index on public_reference.
 */

import crypto from 'node:crypto';

export function generatePublicDonorReference() {
  return 'DNR-' + crypto.randomBytes(16).toString('hex').toUpperCase();
}

export function applyStage28Migration(db) {
  // 1. Check if migration is already recorded
  const migrationRow = db.prepare("SELECT version FROM schema_migrations WHERE version = 'stage_2_8'").get();
  if (migrationRow) {
    return {
      status: 'SKIPPED',
      version: 'stage_2_8',
      reason: 'Migration stage_2_8 has already been applied.'
    };
  }

  db.exec('BEGIN TRANSACTION;');
  try {
    // 2. Check if public_reference column already exists in donor_profiles
    const tableInfo = db.prepare('PRAGMA table_info(donor_profiles)').all();
    const hasColumn = tableInfo.some(col => col.name === 'public_reference');

    if (!hasColumn) {
      db.exec(`
        ALTER TABLE donor_profiles 
        ADD COLUMN public_reference TEXT;
      `);
    }

    // 3. Backfill any existing donor profiles missing a public_reference
    const unreferencedDonors = db.prepare(`
      SELECT user_id FROM donor_profiles WHERE public_reference IS NULL OR public_reference = ''
    `).all();

    if (unreferencedDonors.length > 0) {
      const existingRefs = new Set(
        db.prepare(`SELECT public_reference FROM donor_profiles WHERE public_reference IS NOT NULL AND public_reference != ''`)
          .all()
          .map(r => r.public_reference)
      );

      const updateStmt = db.prepare(`
        UPDATE donor_profiles 
        SET public_reference = ? 
        WHERE user_id = ?
      `);

      for (const donor of unreferencedDonors) {
        let newRef;
        do {
          newRef = generatePublicDonorReference();
        } while (existingRefs.has(newRef));
        existingRefs.add(newRef);
        updateStmt.run(newRef, donor.user_id);
      }
    }

    // 4. Create unique index for fast O(1) indexed lookups
    db.exec(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_donor_public_reference 
      ON donor_profiles (public_reference);
    `);

    // 5. Record migration in schema_migrations
    db.prepare(`
      INSERT INTO schema_migrations (version, description, applied_at)
      VALUES ('stage_2_8', 'Stage 2.8 Persistent 128-bit Random Public Donor Reference and Direct Indexed Lookup', CURRENT_TIMESTAMP)
    `).run();

    db.exec('COMMIT;');

    return {
      status: 'APPLIED',
      version: 'stage_2_8',
      description: 'Stage 2.8 Persistent 128-bit Random Public Donor Reference and Direct Indexed Lookup',
      backfilledCount: unreferencedDonors.length
    };
  } catch (err) {
    db.exec('ROLLBACK;');
    throw err;
  }
}
