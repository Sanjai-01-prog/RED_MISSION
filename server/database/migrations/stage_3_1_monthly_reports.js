/**
 * RED MISSION Database Migration — Stage 3.1
 * Monthly Activity Reports & Rotaract District Activity Submission Ledger
 * 
 * Creates monthly_reports table for persistent metadata storage of official
 * activity reports, summary metrics, and generated export dossiers.
 * 
 * NOTE: This migration file is created for future official database execution.
 * It is NOT executed against the live production database during Phase 6 Feature 1.
 */

export function applyStage31Migration(db) {
  // 1. Check if migration is already recorded
  const migrationRow = db.prepare("SELECT version FROM schema_migrations WHERE version = 'stage_3_1'").get();
  if (migrationRow) {
    return {
      status: 'SKIPPED',
      version: 'stage_3_1',
      reason: 'Migration stage_3_1 has already been applied.'
    };
  }

  db.exec('BEGIN TRANSACTION;');
  try {
    // 2. Create monthly_reports table
    db.exec(`
      CREATE TABLE IF NOT EXISTS monthly_reports (
        id TEXT PRIMARY KEY,
        month INTEGER NOT NULL CHECK(month BETWEEN 1 AND 12),
        year INTEGER NOT NULL CHECK(year BETWEEN 2000 AND 2100),
        month_name TEXT NOT NULL,
        period_label TEXT NOT NULL,
        total_donations INTEGER NOT NULL DEFAULT 0,
        total_units INTEGER NOT NULL DEFAULT 0,
        unique_donors_count INTEGER NOT NULL DEFAULT 0,
        unique_hospitals_count INTEGER NOT NULL DEFAULT 0,
        pdf_filename TEXT NOT NULL,
        excel_filename TEXT NOT NULL,
        generated_by_admin_id TEXT NOT NULL REFERENCES admin_accounts(id),
        generated_by_admin_name TEXT NOT NULL,
        generated_by_admin_role TEXT NOT NULL,
        generated_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
        metadata_json TEXT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_monthly_reports_period ON monthly_reports(year, month);
      CREATE INDEX IF NOT EXISTS idx_monthly_reports_admin ON monthly_reports(generated_by_admin_id);
      CREATE INDEX IF NOT EXISTS idx_monthly_reports_generated ON monthly_reports(generated_at);
    `);

    // 3. Record migration in schema_migrations
    db.prepare(`
      INSERT INTO schema_migrations (version, description, applied_at)
      VALUES ('stage_3_1', 'Stage 3.1 Monthly Activity Reports & Rotaract District Activity Submission Ledger', CURRENT_TIMESTAMP)
    `).run();

    db.exec('COMMIT;');

    return {
      status: 'APPLIED',
      version: 'stage_3_1',
      description: 'Stage 3.1 Monthly Activity Reports & Rotaract District Activity Submission Ledger'
    };
  } catch (err) {
    db.exec('ROLLBACK;');
    throw err;
  }
}
