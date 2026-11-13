/**
 * Standalone Runner for Stage 2.6 Database Migration
 * Safely applies the Stage 2.6 persistent registration migration to red_mission.db and verifies integrity.
 */

import { getDatabase } from '../connection.js';
import { applyStage26Migration } from './stage_2_6_pending_registrations.js';

console.log('======================================================');
console.log('EXECUTING STAGE 2.6 GUARDED DATABASE MIGRATION');
console.log('======================================================');

const db = getDatabase();

try {
  const result = applyStage26Migration(db);
  console.log('Migration Result:', JSON.stringify(result, null, 2));

  // Verify integrity
  const integrity = db.prepare('PRAGMA integrity_check').get();
  const fks = db.prepare('PRAGMA foreign_key_check').all();
  console.log('Integrity check:', integrity.integrity_check);
  console.log('Foreign key check violations:', fks.length);

  if (integrity.integrity_check !== 'ok' || fks.length > 0) {
    throw new Error('Database verification failed after migration.');
  }

  // Print pending_user_registrations columns
  const cols = db.prepare('PRAGMA table_info(pending_user_registrations)').all();
  console.log('\npending_user_registrations columns:');
  console.log(cols.map(c => ` - ${c.name} (${c.type})`).join('\n'));

  console.log('\nStage 2.6 Migration execution and verification SUCCESSFUL.');
} catch (err) {
  console.error('\n[MIGRATION RUNNER FAILED]:', err);
  process.exit(1);
}
