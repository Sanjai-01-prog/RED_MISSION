import crypto from 'node:crypto';
import { getDatabase } from './connection.js';
import { config, validateSuperAdminConfig } from '../config/env.js';
import { hashPassword } from '../utils/crypto.js';

export function provisionInitialSuperAdmin() {
  const db = getDatabase();

  const existingSuperAdmin = db.prepare('SELECT id, email, username FROM admin_accounts WHERE role_id = ?').get('SUPER_ADMIN');
  if (existingSuperAdmin) {
    return {
      provisioned: false,
      message: `Super Admin account already provisioned (${existingSuperAdmin.username}). Existing credentials preserved.`
    };
  }

  // Validate provisioning configuration before creating initial account
  validateSuperAdminConfig({
    isProd: config.IS_PROD,
    password: config.INIT_SUPER_ADMIN_PASSWORD,
    hasExistingAdmin: false
  });

  const { hash, salt } = hashPassword(config.INIT_SUPER_ADMIN_PASSWORD);
  const adminId = `adm_${crypto.randomUUID()}`;

  const insertAdmin = db.prepare(`
    INSERT INTO admin_accounts (
      id, full_name, username, email, mobile_number, role_id,
      password_hash, password_salt, must_change_password, is_active, created_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'SYSTEM_INITIAL_PROVISION')
  `);

  insertAdmin.run(
    adminId,
    config.INIT_SUPER_ADMIN_NAME,
    config.INIT_SUPER_ADMIN_USERNAME,
    config.INIT_SUPER_ADMIN_EMAIL,
    config.INIT_SUPER_ADMIN_MOBILE,
    'SUPER_ADMIN',
    hash,
    salt,
    0 // Initial Super Admin setup from secure env
  );

  // Log in Security Audit Log
  const logAudit = db.prepare(`
    INSERT INTO security_audit_logs (id, actor_type, actor_id, action, details, ip_address)
    VALUES (?, 'SYSTEM', ?, 'SUPER_ADMIN_INITIAL_PROVISIONING', ?, '127.0.0.1')
  `);

  logAudit.run(
    `audit_${crypto.randomUUID()}`,
    adminId,
    JSON.stringify({
      username: config.INIT_SUPER_ADMIN_USERNAME,
      email: config.INIT_SUPER_ADMIN_EMAIL,
      timestamp: new Date().toISOString()
    })
  );

  console.log(`[SECURITY] Initial Super Admin account successfully provisioned: ${config.INIT_SUPER_ADMIN_USERNAME} (${config.INIT_SUPER_ADMIN_EMAIL})`);
  return {
    provisioned: true,
    adminId,
    username: config.INIT_SUPER_ADMIN_USERNAME,
    email: config.INIT_SUPER_ADMIN_EMAIL
  };
}
