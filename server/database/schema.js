import { getDatabase } from './connection.js';
import { applyStage22Migration } from './migrations/stage_2_2_donor_selfie.js';
import { applyStage24Migration } from './migrations/stage_2_4_photo_privacy.js';
import { applyStage25Migration } from './migrations/stage_2_5_emergency_workflow.js';
import { applyStage26Migration } from './migrations/stage_2_6_pending_registrations.js';
import { applyStage33Migration } from './migrations/stage_3_3_user_consents.js';
import { applyStage34Migration } from './migrations/stage_3_4_emergency_lifecycle.js';
import { applyStage35Migration } from './migrations/stage_3_5_dob_and_gender.js';

export function initializeDatabaseSchema() {
  const db = getDatabase();

  db.exec(`
    -- 1. Users table (Donors & Patients)
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      full_name TEXT NOT NULL,
      mobile_number TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      age INTEGER NOT NULL,
      date_of_birth TEXT NULL,
      gender TEXT NULL,
      blood_group TEXT NOT NULL,
      city TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      password_salt TEXT NOT NULL,
      is_active INTEGER DEFAULT 0,
      is_suspended INTEGER DEFAULT 0,
      failed_login_attempts INTEGER DEFAULT 0,
      lockout_until DATETIME NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 2. User Verification Status table
    CREATE TABLE IF NOT EXISTS user_verifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      mobile_verified INTEGER DEFAULT 0,
      mobile_verified_at DATETIME NULL,
      email_verified INTEGER DEFAULT 0,
      email_verified_at DATETIME NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- 3. OTP verification records
    CREATE TABLE IF NOT EXISTS otp_records (
      id TEXT PRIMARY KEY,
      identifier TEXT NOT NULL,
      type TEXT NOT NULL,
      otp_hash TEXT NOT NULL,
      otp_salt TEXT NOT NULL,
      plain_demo_otp TEXT NULL,
      expires_at DATETIME NOT NULL,
      attempts INTEGER DEFAULT 0,
      max_attempts INTEGER DEFAULT 3,
      is_used INTEGER DEFAULT 0,
      used_at DATETIME NULL,
      ip_address TEXT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 4. Password reset tokens
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL,
      account_type TEXT NOT NULL, -- 'USER' or 'ADMIN'
      token_hash TEXT NOT NULL,
      identifier TEXT NOT NULL,
      delivery_channel TEXT NOT NULL, -- 'EMAIL_LINK' or 'MOBILE_OTP'
      expires_at DATETIME NOT NULL,
      is_used INTEGER DEFAULT 0,
      used_at DATETIME NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 5. User sessions
    CREATE TABLE IF NOT EXISTS user_sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      session_token_hash TEXT NOT NULL,
      ip_address TEXT NULL,
      user_agent TEXT NULL,
      device_info TEXT NULL,
      remember_me INTEGER DEFAULT 0,
      last_activity_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME NOT NULL,
      is_revoked INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- 6. Login attempts tracker (for security, analytics, and lockouts)
    CREATE TABLE IF NOT EXISTS login_attempts (
      id TEXT PRIMARY KEY,
      identifier TEXT NOT NULL,
      account_type TEXT NOT NULL, -- 'USER' or 'ADMIN'
      ip_address TEXT NULL,
      user_agent TEXT NULL,
      success INTEGER NOT NULL,
      failure_reason TEXT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 7. User security activity logs
    CREATE TABLE IF NOT EXISTS user_security_activities (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      description TEXT NOT NULL,
      ip_address TEXT NULL,
      user_agent TEXT NULL,
      location TEXT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- 8. Admin roles
    CREATE TABLE IF NOT EXISTS admin_roles (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 9. Role permissions
    CREATE TABLE IF NOT EXISTS role_permissions (
      id TEXT PRIMARY KEY,
      role_id TEXT NOT NULL,
      permission TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (role_id) REFERENCES admin_roles(id) ON DELETE CASCADE
    );

    -- 10. Admin accounts
    CREATE TABLE IF NOT EXISTS admin_accounts (
      id TEXT PRIMARY KEY,
      full_name TEXT NOT NULL,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      mobile_number TEXT UNIQUE NOT NULL,
      role_id TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      password_salt TEXT NOT NULL,
      must_change_password INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      is_suspended INTEGER DEFAULT 0,
      failed_login_attempts INTEGER DEFAULT 0,
      lockout_until DATETIME NULL,
      created_by TEXT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (role_id) REFERENCES admin_roles(id)
    );

    -- 11. Admin invitations
    CREATE TABLE IF NOT EXISTS admin_invitations (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      role_id TEXT NOT NULL,
      token_hash TEXT NOT NULL,
      invited_by TEXT NOT NULL,
      expires_at DATETIME NOT NULL,
      is_accepted INTEGER DEFAULT 0,
      accepted_at DATETIME NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (role_id) REFERENCES admin_roles(id),
      FOREIGN KEY (invited_by) REFERENCES admin_accounts(id)
    );

    -- 12. Admin Dual OTP records (Both Mobile OTP + Email OTP must be verified)
    CREATE TABLE IF NOT EXISTS admin_otp_records (
      id TEXT PRIMARY KEY,
      admin_id TEXT NOT NULL,
      session_pre_auth_token TEXT NOT NULL,
      mobile_otp_hash TEXT NOT NULL,
      mobile_otp_salt TEXT NOT NULL,
      plain_demo_mobile_otp TEXT NULL,
      mobile_verified INTEGER DEFAULT 0,
      email_otp_hash TEXT NOT NULL,
      email_otp_salt TEXT NOT NULL,
      plain_demo_email_otp TEXT NULL,
      email_verified INTEGER DEFAULT 0,
      expires_at DATETIME NOT NULL,
      attempts INTEGER DEFAULT 0,
      max_attempts INTEGER DEFAULT 3,
      is_completed INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (admin_id) REFERENCES admin_accounts(id) ON DELETE CASCADE
    );

    -- 13. Admin sessions
    CREATE TABLE IF NOT EXISTS admin_sessions (
      id TEXT PRIMARY KEY,
      admin_id TEXT NOT NULL,
      session_token_hash TEXT NOT NULL,
      ip_address TEXT NULL,
      user_agent TEXT NULL,
      last_activity_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME NOT NULL,
      is_revoked INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (admin_id) REFERENCES admin_accounts(id) ON DELETE CASCADE
    );

    -- 14. Security audit logs
    CREATE TABLE IF NOT EXISTS security_audit_logs (
      id TEXT PRIMARY KEY,
      actor_type TEXT NOT NULL, -- 'SYSTEM', 'USER', 'ADMIN'
      actor_id TEXT NULL,
      action TEXT NOT NULL,
      details TEXT NULL,
      ip_address TEXT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 15. Account deletion records
    CREATE TABLE IF NOT EXISTS account_deletion_records (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      reason TEXT NULL,
      deletion_method TEXT NOT NULL,
      retained_anonymized_id TEXT NOT NULL,
      anonymized_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 16. Anonymized donation records (Permanent statistics retention)
    CREATE TABLE IF NOT EXISTS anonymized_donation_records (
      id TEXT PRIMARY KEY,
      anonymized_donor_ref TEXT NOT NULL,
      blood_group TEXT NOT NULL,
      city TEXT NOT NULL,
      donation_date TEXT NOT NULL,
      units_donated INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 17. Retained donation proof metadata (Restricted to Admin access only)
    CREATE TABLE IF NOT EXISTS retained_donation_proof_metadata (
      id TEXT PRIMARY KEY,
      anonymized_ref TEXT NOT NULL,
      document_hash TEXT NOT NULL,
      verification_date DATETIME NOT NULL,
      verified_by_admin_id TEXT NULL,
      access_restricted_to_admin INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 18. Donor Profiles table (Clinical metadata & Stage 2.2 visual selfie profile)
    CREATE TABLE IF NOT EXISTS donor_profiles (
      user_id TEXT PRIMARY KEY,
      blood_group TEXT NOT NULL,
      city TEXT NOT NULL,
      pincode TEXT NULL,
      latitude REAL NULL,
      longitude REAL NULL,
      is_available_for_emergency INTEGER DEFAULT 0 CHECK(is_available_for_emergency IN (0, 1)),
      consent_emergency_alerts INTEGER DEFAULT 0 NOT NULL CHECK(consent_emergency_alerts IN (0, 1)),
      last_donation_date DATE NULL,
      total_donations_count INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      profile_photo_path TEXT NULL,
      profile_photo_mime TEXT NULL,
      profile_photo_size_bytes INTEGER NULL,
      profile_photo_updated_at DATETIME NULL,
      selfie_consent_given INTEGER DEFAULT 0 NOT NULL CHECK(selfie_consent_given IN (0, 1)),
      selfie_consent_at DATETIME NULL,
      is_photo_public INTEGER DEFAULT 0 NOT NULL CHECK(is_photo_public IN (0, 1)),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- 19. Persistent Site Configuration (e.g. fixed official launch timestamp)
    CREATE TABLE IF NOT EXISTS site_config (
      key TEXT PRIMARY KEY,
      value TEXT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Relational Indexes for ultra-fast lookups and unique enforcement
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_users_mobile ON users(mobile_number);
    CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions(session_token_hash);
    CREATE INDEX IF NOT EXISTS idx_admin_accounts_email ON admin_accounts(email);
    CREATE INDEX IF NOT EXISTS idx_admin_accounts_username ON admin_accounts(username);
    CREATE INDEX IF NOT EXISTS idx_admin_sessions_token ON admin_sessions(session_token_hash);
    CREATE INDEX IF NOT EXISTS idx_otp_identifier ON otp_records(identifier);
    CREATE INDEX IF NOT EXISTS idx_audit_created ON security_audit_logs(created_at);
    CREATE INDEX IF NOT EXISTS idx_donor_profiles_blood_city ON donor_profiles(blood_group, city);
    CREATE INDEX IF NOT EXISTS idx_donor_profiles_emergency ON donor_profiles(is_available_for_emergency);
  `);

  // Ensure migration tracking table exists before any migration is evaluated
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      description TEXT NOT NULL,
      applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Apply Stage 2.2 migration idempotently
  applyStage22Migration(db);

  // Apply Stage 2.4 migration idempotently
  applyStage24Migration(db);

  // Apply Stage 2.5 migration idempotently
  applyStage25Migration(db);

  // Apply Stage 2.6 migration idempotently
  applyStage26Migration(db);

  // Apply Stage 3.3 migration idempotently
  applyStage33Migration(db);

  // Apply Stage 3.4 migration idempotently
  applyStage34Migration(db);

  // Apply Stage 3.5 migration idempotently
  applyStage35Migration(db);

  // Seed default admin roles if not yet seeded
  seedAdminRoles(db);
}

function seedAdminRoles(db) {
  const roles = [
    {
      id: 'SUPER_ADMIN',
      name: 'Super Administrator',
      description: 'Highest administrative authority with full platform governance and admin creation powers.'
    },
    {
      id: 'ADMIN',
      name: 'Hospital & Network Administrator',
      description: 'Manages donors, hospital blood requests, donation drives, and medical operations.'
    },
    {
      id: 'MODERATOR',
      name: 'Verification Officer & Moderator',
      description: 'Verifies donation slips, monitors requests, and handles user inquiries and reports.'
    }
  ];

  const checkRole = db.prepare('SELECT id FROM admin_roles WHERE id = ?');
  const insertRole = db.prepare('INSERT INTO admin_roles (id, name, description) VALUES (?, ?, ?)');

  for (const role of roles) {
    if (!checkRole.get(role.id)) {
      insertRole.run(role.id, role.name, role.description);
    }
  }

  // Seed role permissions
  const permissions = [
    // Super Admin Permissions (All)
    { role: 'SUPER_ADMIN', perm: 'FULL_ADMINISTRATION' },
    { role: 'SUPER_ADMIN', perm: 'MANAGE_ADMINS' },
    { role: 'SUPER_ADMIN', perm: 'MANAGE_MODERATORS' },
    { role: 'SUPER_ADMIN', perm: 'ASSIGN_ROLES' },
    { role: 'SUPER_ADMIN', perm: 'VIEW_AUDIT_LOGS' },
    { role: 'SUPER_ADMIN', perm: 'MANAGE_SETTINGS' },
    { role: 'SUPER_ADMIN', perm: 'MANAGE_USERS' },
    { role: 'SUPER_ADMIN', perm: 'MANAGE_REQUESTS' },
    { role: 'SUPER_ADMIN', perm: 'MANAGE_CAMPS' },
    { role: 'SUPER_ADMIN', perm: 'VERIFY_PROOFS' },
    { role: 'SUPER_ADMIN', perm: 'VIEW_CERTIFICATES' },
    
    // Admin Permissions
    { role: 'ADMIN', perm: 'MANAGE_USERS' },
    { role: 'ADMIN', perm: 'MANAGE_REQUESTS' },
    { role: 'ADMIN', perm: 'MANAGE_CAMPS' },
    { role: 'ADMIN', perm: 'VERIFY_PROOFS' },
    { role: 'ADMIN', perm: 'MONITOR_REQUESTS' },
    { role: 'ADMIN', perm: 'VIEW_CERTIFICATES' },

    // Moderator Permissions
    { role: 'MODERATOR', perm: 'VERIFY_PROOFS' },
    { role: 'MODERATOR', perm: 'MONITOR_REQUESTS' },
    { role: 'MODERATOR', perm: 'VIEW_REPORTS' }
  ];

  const checkPerm = db.prepare('SELECT id FROM role_permissions WHERE role_id = ? AND permission = ?');
  const insertPerm = db.prepare('INSERT INTO role_permissions (id, role_id, permission) VALUES (?, ?, ?)');

  for (const p of permissions) {
    if (!checkPerm.get(p.role, p.perm)) {
      insertPerm.run(`perm_${p.role}_${p.perm}`, p.role, p.perm);
    }
  }
}
