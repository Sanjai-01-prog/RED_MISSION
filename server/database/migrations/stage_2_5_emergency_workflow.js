/**
 * RED MISSION Database Migration — Stage 2.5
 * Emergency Blood Request Lifecycle, WhatsApp Sharing, Atomic Pledges, Proof Review & Certificates
 */

export function applyStage25Migration(db) {
  // 1. Check if migration is already recorded
  const migrationRow = db.prepare("SELECT version FROM schema_migrations WHERE version = 'stage_2_5'").get();
  if (migrationRow) {
    return {
      status: 'SKIPPED',
      version: 'stage_2_5',
      reason: 'Migration stage_2_5 has already been applied.'
    };
  }

  db.exec('BEGIN TRANSACTION;');
  try {
    // 2. Safely recreate emergency_requests table with admin creator & contact fields
    // First preserve any existing rows if present
    db.exec(`
      CREATE TABLE IF NOT EXISTS emergency_requests_temp (
        id TEXT PRIMARY KEY,
        created_by_admin_id TEXT REFERENCES admin_accounts(id),
        requester_user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
        patient_name TEXT NOT NULL,
        hospital_name TEXT NOT NULL,
        hospital_city TEXT NOT NULL,
        hospital_address TEXT NOT NULL,
        blood_group TEXT NOT NULL,
        units_requested INTEGER NOT NULL CHECK(units_requested > 0),
        units_reserved INTEGER DEFAULT 0 NOT NULL CHECK(units_reserved >= 0),
        units_fulfilled INTEGER DEFAULT 0 NOT NULL CHECK(units_fulfilled >= 0),
        urgency_level TEXT NOT NULL CHECK(urgency_level IN ('CRITICAL', 'URGENT', 'STANDARD')),
        status TEXT NOT NULL DEFAULT 'OPEN' CHECK(status IN ('OPEN', 'FULFILLED', 'CANCELLED', 'EXPIRED')),
        required_by DATETIME NOT NULL,
        contact_person TEXT NOT NULL DEFAULT 'Blood Bank Desk',
        contact_phone TEXT NOT NULL DEFAULT '+91 9999999999',
        clinical_condition TEXT,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Check if emergency_requests table exists
    const hasEmergencyTable = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='emergency_requests'").get();
    if (hasEmergencyTable) {
      // Check if table has rows
      const count = db.prepare('SELECT COUNT(*) as c FROM emergency_requests').get().c;
      if (count > 0) {
        // Copy existing data across
        db.exec(`
          INSERT INTO emergency_requests_temp (
            id, requester_user_id, patient_name, hospital_name, hospital_city, hospital_address,
            blood_group, units_requested, units_reserved, units_fulfilled, urgency_level,
            status, required_by, created_at, updated_at
          )
          SELECT 
            id, requester_user_id, patient_name, hospital_name, hospital_city, hospital_address,
            blood_group, units_requested, units_reserved, units_fulfilled, urgency_level,
            status, required_by, created_at, updated_at
          FROM emergency_requests;
        `);
      }
      db.exec('DROP TABLE emergency_requests;');
    }
    db.exec('ALTER TABLE emergency_requests_temp RENAME TO emergency_requests;');

    // 3. Recreate request_pledges with full Stage 2.5 lifecycle status and unique index
    db.exec(`
      CREATE TABLE IF NOT EXISTS request_pledges_temp (
        id TEXT PRIMARY KEY,
        request_id TEXT NOT NULL,
        donor_user_id TEXT NOT NULL,
        units_pledged INTEGER NOT NULL DEFAULT 1 CHECK(units_pledged > 0),
        status TEXT NOT NULL DEFAULT 'PLEDGED' CHECK(status IN ('PLEDGED', 'PROOF_PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'CANCELLED', 'EXPIRED')),
        cancel_reason TEXT,
        proof_submitted_at DATETIME,
        reserved_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        expires_at DATETIME NOT NULL,
        completed_at DATETIME NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (request_id) REFERENCES emergency_requests(id) ON DELETE CASCADE,
        FOREIGN KEY (donor_user_id) REFERENCES users(id) ON DELETE CASCADE
      );
    `);

    const hasPledgesTable = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='request_pledges'").get();
    if (hasPledgesTable) {
      const pledgeCount = db.prepare('SELECT COUNT(*) as c FROM request_pledges').get().c;
      if (pledgeCount > 0) {
        db.exec(`
          INSERT INTO request_pledges_temp (
            id, request_id, donor_user_id, units_pledged, status, reserved_at, expires_at, completed_at, created_at, updated_at
          )
          SELECT 
            id, request_id, donor_user_id, units_pledged, 
            CASE 
              WHEN status = 'ACTIVE_RESERVATION' THEN 'PLEDGED'
              WHEN status = 'VERIFIED_DONATED' THEN 'APPROVED'
              ELSE status 
            END,
            reserved_at, expires_at, completed_at, created_at, updated_at
          FROM request_pledges;
        `);
      }
      db.exec('DROP TABLE request_pledges;');
    }
    db.exec('ALTER TABLE request_pledges_temp RENAME TO request_pledges;');

    // 4. Create donation_proofs table
    db.exec(`
      CREATE TABLE IF NOT EXISTS donation_proofs (
        id TEXT PRIMARY KEY,
        pledge_id TEXT NOT NULL,
        donor_user_id TEXT NOT NULL,
        request_id TEXT NOT NULL,
        proof_photo_path TEXT NOT NULL,
        proof_photo_mime TEXT NOT NULL,
        proof_photo_size INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING', 'APPROVED', 'REJECTED')),
        rejection_reason TEXT NULL,
        reviewed_by_admin_id TEXT NULL,
        reviewed_at DATETIME NULL,
        submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (pledge_id) REFERENCES request_pledges(id) ON DELETE CASCADE,
        FOREIGN KEY (donor_user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (request_id) REFERENCES emergency_requests(id) ON DELETE CASCADE,
        FOREIGN KEY (reviewed_by_admin_id) REFERENCES admin_accounts(id)
      );
    `);

    // 5. Create donation_certificates table
    db.exec(`
      CREATE TABLE IF NOT EXISTS donation_certificates (
        id TEXT PRIMARY KEY,
        proof_id TEXT NOT NULL UNIQUE,
        pledge_id TEXT NOT NULL UNIQUE,
        donor_user_id TEXT NOT NULL,
        donor_name TEXT NOT NULL,
        blood_group TEXT NOT NULL,
        hospital_name TEXT NOT NULL,
        donation_date DATE NOT NULL,
        units_donated INTEGER DEFAULT 1 NOT NULL,
        qr_verification_token TEXT UNIQUE NOT NULL,
        issued_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (proof_id) REFERENCES donation_proofs(id) ON DELETE CASCADE,
        FOREIGN KEY (pledge_id) REFERENCES request_pledges(id) ON DELETE CASCADE,
        FOREIGN KEY (donor_user_id) REFERENCES users(id) ON DELETE CASCADE
      );
    `);

    // 6. Create performance and constraint indexes
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_emergency_requests_status ON emergency_requests(status);
      CREATE INDEX IF NOT EXISTS idx_emergency_requests_blood ON emergency_requests(blood_group);
      CREATE INDEX IF NOT EXISTS idx_emergency_requests_city ON emergency_requests(hospital_city);
      CREATE INDEX IF NOT EXISTS idx_emergency_requests_urgency ON emergency_requests(urgency_level);
      CREATE INDEX IF NOT EXISTS idx_emergency_requests_admin ON emergency_requests(created_by_admin_id);

      CREATE UNIQUE INDEX IF NOT EXISTS idx_pledges_active_unique 
      ON request_pledges(request_id, donor_user_id) 
      WHERE status NOT IN ('CANCELLED', 'REJECTED');

      CREATE INDEX IF NOT EXISTS idx_pledges_donor ON request_pledges(donor_user_id);
      CREATE INDEX IF NOT EXISTS idx_pledges_request ON request_pledges(request_id);
      CREATE INDEX IF NOT EXISTS idx_pledges_status ON request_pledges(status);

      CREATE INDEX IF NOT EXISTS idx_donation_proofs_pledge ON donation_proofs(pledge_id);
      CREATE INDEX IF NOT EXISTS idx_donation_proofs_status ON donation_proofs(status);
      CREATE INDEX IF NOT EXISTS idx_donation_proofs_donor ON donation_proofs(donor_user_id);

      CREATE INDEX IF NOT EXISTS idx_certificates_donor ON donation_certificates(donor_user_id);
      CREATE INDEX IF NOT EXISTS idx_certificates_pledge ON donation_certificates(pledge_id);
      CREATE INDEX IF NOT EXISTS idx_certificates_token ON donation_certificates(qr_verification_token);
    `);

    // 7. Record migration in schema_migrations
    db.prepare(`
      INSERT INTO schema_migrations (version, description, applied_at)
      VALUES ('stage_2_5', 'Stage 2.5 Emergency Blood Requests, WhatsApp Sharing, Atomic Pledges, Proof Review & Certificates', CURRENT_TIMESTAMP)
    `).run();

    db.exec('COMMIT;');

    return {
      status: 'APPLIED',
      version: 'stage_2_5',
      description: 'Stage 2.5 Emergency Blood Requests, WhatsApp Sharing, Atomic Pledges, Proof Review & Certificates'
    };
  } catch (err) {
    db.exec('ROLLBACK;');
    throw err;
  }
}
