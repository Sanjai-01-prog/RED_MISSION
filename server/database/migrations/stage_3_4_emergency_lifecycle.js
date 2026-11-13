/**
 * RED MISSION Database Migration — Stage 3.4
 * Emergency Blood Request Lifecycle:
 * Explicit Admin Approval Tracking (approval_status, approved_by_admin_id, approved_at,
 * rejected_by_admin_id, rejected_at, rejection_reason), Preserving Citizen Pending Status
 * and Supporting Automatic Past-Deadline Expiration Tracking.
 */

export function applyStage34Migration(db) {
  // 1. Check if migration is already recorded
  const migrationRow = db.prepare("SELECT version FROM schema_migrations WHERE version = 'stage_3_4'").get();
  if (migrationRow) {
    return {
      status: 'SKIPPED',
      version: 'stage_3_4',
      reason: 'Migration stage_3_4 has already been applied.'
    };
  }

  db.exec('BEGIN TRANSACTION;');
  try {
    // 2. Inspect existing columns in emergency_requests
    const tableInfo = db.prepare("PRAGMA table_info(emergency_requests)").all();
    const existingCols = new Set(tableInfo.map(c => c.name));

    // Safe additive column additions
    if (!existingCols.has('approval_status')) {
      db.exec("ALTER TABLE emergency_requests ADD COLUMN approval_status TEXT NOT NULL DEFAULT 'PENDING';");
    }
    if (!existingCols.has('approved_by_admin_id')) {
      db.exec("ALTER TABLE emergency_requests ADD COLUMN approved_by_admin_id TEXT;");
    }
    if (!existingCols.has('approved_at')) {
      db.exec("ALTER TABLE emergency_requests ADD COLUMN approved_at DATETIME;");
    }
    if (!existingCols.has('rejected_by_admin_id')) {
      db.exec("ALTER TABLE emergency_requests ADD COLUMN rejected_by_admin_id TEXT;");
    }
    if (!existingCols.has('rejected_at')) {
      db.exec("ALTER TABLE emergency_requests ADD COLUMN rejected_at DATETIME;");
    }
    if (!existingCols.has('rejection_reason')) {
      db.exec("ALTER TABLE emergency_requests ADD COLUMN rejection_reason TEXT;");
    }

    // 3. Historical Data Alignment:
    // Only requests explicitly created and published by administrators are back-filled as APPROVED.
    // Citizen-submitted requests without admin review remain truthfully PENDING.
    db.prepare(`
      UPDATE emergency_requests
      SET approval_status = 'APPROVED',
          approved_by_admin_id = created_by_admin_id,
          approved_at = created_at
      WHERE created_by_admin_id IS NOT NULL
        AND (approved_by_admin_id IS NULL OR approval_status = 'PENDING')
    `).run();

    // 4. Create performance indexes
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_emergency_requests_approval 
      ON emergency_requests(approval_status);

      CREATE INDEX IF NOT EXISTS idx_emergency_requests_deadline 
      ON emergency_requests(required_by);
    `);

    // 5. Record migration in schema_migrations
    db.prepare(`
      INSERT INTO schema_migrations (version, description, applied_at)
      VALUES ('stage_3_4', 'Stage 3.4 Emergency Blood Request Approval Tracking and Expiration Lifecycle', CURRENT_TIMESTAMP)
    `).run();

    db.exec('COMMIT;');

    return {
      status: 'APPLIED',
      version: 'stage_3_4',
      description: 'Stage 3.4 Emergency Blood Request Approval Tracking and Expiration Lifecycle'
    };
  } catch (err) {
    try {
      db.exec('ROLLBACK;');
    } catch {}
    throw err;
  }
}
