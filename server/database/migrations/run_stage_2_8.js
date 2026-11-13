/**
 * Standalone Runner for Stage 2.8 Database Migration
 * Safely applies the Stage 2.8 persistent 128-bit donor reference migration to red_mission.db and verifies integrity.
 */

import { getDatabase } from '../connection.js';
import { applyStage28Migration } from './stage_2_8_donor_public_reference.js';

console.log('======================================================');
console.log('EXECUTING STAGE 2.8 GUARDED DATABASE MIGRATION');
console.log('======================================================');

const db = getDatabase();

try {
  const result = applyStage28Migration(db);
  console.log('Migration Result:', JSON.stringify(result, null, 2));

  // Verify integrity
  const integrity = db.prepare('PRAGMA integrity_check').get();
  const fks = db.prepare('PRAGMA foreign_key_check').all();
  console.log('Integrity check:', integrity.integrity_check);
  console.log('Foreign key check violations:', fks.length);

  if (integrity.integrity_check !== 'ok' || fks.length > 0) {
    throw new Error('Database verification failed after migration.');
  }

  // Print updated donor_profiles columns
  const cols = db.prepare('PRAGMA table_info(donor_profiles)').all();
  console.log('\nUpdated donor_profiles columns:');
  console.log(cols.map(c => ` - ${c.name} (${c.type})`).join('\n'));

  console.log('\nStage 2.8 Migration execution and verification SUCCESSFUL.');
} catch (err) {
  console.error('\n[MIGRATION RUNNER FAILED]:', err);
  process.exit(1);
}
