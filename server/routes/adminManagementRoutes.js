import crypto from 'node:crypto';
import { getDatabase } from '../database/connection.js';
import { config } from '../config/env.js';
import { hashPassword, generateSecureToken } from '../utils/crypto.js';
import { sendEmail } from '../utils/mailer.js';
import { logSecurityAudit } from '../utils/auditLogger.js';
import { authenticateAdmin, requirePermission } from '../middleware/authMiddleware.js';

export function setupAdminManagementRoutes(app) {

  // ==========================================
  // 1. LIST ADMIN TEAM & MODERATORS
  // ==========================================
  app.get('/api/admin/team', authenticateAdmin, requirePermission('MANAGE_ADMINS'), (req, res) => {
    const db = getDatabase();

    const team = db.prepare(`
      SELECT a.id, a.full_name, a.username, a.email, a.mobile_number, 
             a.role_id, a.must_change_password, a.is_active, a.created_by, a.created_at,
             r.name as role_name, r.description as role_description
      FROM admin_accounts a
      JOIN admin_roles r ON a.role_id = r.id
      ORDER BY 
        CASE a.role_id 
          WHEN 'SUPER_ADMIN' THEN 1 
          WHEN 'ADMIN' THEN 2 
          WHEN 'MODERATOR' THEN 3 
          ELSE 4 
        END, a.created_at ASC
    `).all();

    const invitations = db.prepare(`
      SELECT i.id, i.email, i.role_id, i.expires_at, i.is_accepted, i.created_at,
             r.name as role_name, a.username as invited_by_username
      FROM admin_invitations i
      JOIN admin_roles r ON i.role_id = r.id
      JOIN admin_accounts a ON i.invited_by = a.id
      WHERE i.is_accepted = 0 AND i.expires_at > CURRENT_TIMESTAMP
      ORDER BY i.created_at DESC
    `).all();

    res.json({
      success: true,
      team,
      invitations
    });
  });

  // ==========================================
  // 2. METHOD 1: MANUAL ADMIN/MODERATOR CREATION (SUPER ADMIN ONLY)
  // ==========================================
  app.post('/api/admin/create-account', authenticateAdmin, requirePermission('MANAGE_ADMINS'), async (req, res) => {
    const { fullName, username, email, mobileNumber, roleId } = req.body;
    const clientIp = req.ip || req.socket.remoteAddress || '127.0.0.1';

    if (!fullName || !username || !email || !mobileNumber || !roleId) {
      return res.status(400).json({
        success: false,
        error: 'All fields are required: Full Name, Username, Email, Mobile Number, and Role.'
      });
    }

    const cleanUsername = username.trim().toLowerCase();
    const cleanEmail = email.trim().toLowerCase();
    const cleanMobile = mobileNumber.replace(/\s+/g, '');

    // Prevent creating additional Super Admins through standard creation
    if (roleId === 'SUPER_ADMIN' && req.admin.role_id !== 'SUPER_ADMIN') {
      return res.status(403).json({
        success: false,
        error: 'Only the existing Super Administrator can provision another Super Admin.'
      });
    }

    const db = getDatabase();

    // Check unique constraints
    const existing = db.prepare(`
      SELECT username, email, mobile_number FROM admin_accounts 
      WHERE LOWER(username) = ? OR LOWER(email) = ? OR mobile_number = ?
    `).get(cleanUsername, cleanEmail, cleanMobile);

    if (existing) {
      if (existing.username.toLowerCase() === cleanUsername) {
        return res.status(409).json({ success: false, error: 'Username is already in use.' });
      }
      if (existing.email.toLowerCase() === cleanEmail) {
        return res.status(409).json({ success: false, error: 'Email address is already in use.' });
      }
      if (existing.mobile_number === cleanMobile) {
        return res.status(409).json({ success: false, error: 'Mobile number is already registered.' });
      }
    }

    // Generate secure temporary password
    const tempPassword = `RedMission#${crypto.randomInt(1000, 9999)}!`;
    const { hash, salt } = hashPassword(tempPassword);
    const newAdminId = `adm_${crypto.randomUUID()}`;

    db.prepare(`
      INSERT INTO admin_accounts (
        id, full_name, username, email, mobile_number, role_id,
        password_hash, password_salt, must_change_password, is_active, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 1, ?)
    `).run(
      newAdminId,
      fullName.trim(),
      cleanUsername,
      cleanEmail,
      cleanMobile,
      roleId,
      hash,
      salt,
      req.admin.username
    );

    logSecurityAudit({
      actorType: 'ADMIN',
      actorId: req.admin.id,
      action: 'ADMIN_ACCOUNT_CREATED_MANUALLY',
      details: {
        createdAdminId: newAdminId,
        username: cleanUsername,
        roleId,
        createdBy: req.admin.username
      },
      ipAddress: clientIp
    });

    // Notify new admin by email with temporary credentials instructions
    sendEmail({
      to: cleanEmail,
      subject: 'RED MISSION — Administrative Account Provisioned',
      text: `Hello ${fullName},\n\nAn administrative account (${roleId}) has been created for you on RED MISSION by ${req.admin.full_name}.\n\nUsername: ${cleanUsername}\nTemporary Password: ${tempPassword}\n\nYou must change your password immediately upon your first login.\n\nLogin URL: https://redmission.org/#admin-login`
    }).catch(() => {});

    res.status(201).json({
      success: true,
      message: `Account created for ${fullName} with role ${roleId}. Temporary password generated.`,
      account: {
        id: newAdminId,
        fullName: fullName.trim(),
        username: cleanUsername,
        email: cleanEmail,
        roleId,
        temporaryPassword: tempPassword // Communicated to Super Admin for initial handoff
      }
    });
  });

  // ==========================================
  // 3. METHOD 2: EMAIL INVITATION (SUPER ADMIN ONLY)
  // ==========================================
  app.post('/api/admin/invite', authenticateAdmin, requirePermission('MANAGE_ADMINS'), async (req, res) => {
    const { email, roleId } = req.body;
    const clientIp = req.ip || req.socket.remoteAddress || '127.0.0.1';

    if (!email || !roleId) {
      return res.status(400).json({ success: false, error: 'Email and Role are required to send an invitation.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const db = getDatabase();

    const existingAdmin = db.prepare('SELECT id FROM admin_accounts WHERE LOWER(email) = ?').get(cleanEmail);
    if (existingAdmin) {
      return res.status(409).json({ success: false, error: 'An admin account with this email already exists.' });
    }

    // Generate secure single-use invitation token valid for 7 days
    const rawToken = generateSecureToken(32);
    const tokenHash = crypto.createHmac('sha256', config.SESSION_SECRET).update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + config.INVITATION_EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const inviteId = `inv_${crypto.randomUUID()}`;

    db.prepare(`
      INSERT INTO admin_invitations (id, email, role_id, token_hash, invited_by, expires_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(inviteId, cleanEmail, roleId, tokenHash, req.admin.id, expiresAt);

    const inviteLink = `https://redmission.org/admin/accept-invite?token=${rawToken}`;

    const emailRes = await sendEmail({
      to: cleanEmail,
      subject: `RED MISSION — Invitation to join Medical Command as ${roleId}`,
      text: `Hello,\n\nYou have been invited by ${req.admin.full_name} to join RED MISSION Medical Command as a ${roleId}.\n\nPlease click the secure single-use invitation link below to set your account details and password:\n${inviteLink}\n\nThis invitation expires in ${config.INVITATION_EXPIRY_DAYS} days.`,
      link: inviteLink
    });

    logSecurityAudit({
      actorType: 'ADMIN',
      actorId: req.admin.id,
      action: 'ADMIN_INVITATION_DISPATCHED',
      details: { invitedEmail: cleanEmail, roleId, invitedBy: req.admin.username },
      ipAddress: clientIp
    });

    res.json({
      success: true,
      message: `Invitation successfully sent to ${cleanEmail}.`,
      invitation: {
        id: inviteId,
        email: cleanEmail,
        roleId,
        expiresAt,
        demoLink: emailRes.demoLink // populated in development for instant testing
      }
    });
  });

  // ==========================================
  // 4. ACCEPT INVITATION & COMPLETE ACCOUNT REGISTRATION (PUBLIC)
  // ==========================================
  app.post('/api/admin/accept-invite', async (req, res) => {
    const { inviteToken, fullName, username, mobileNumber, password, confirmPassword } = req.body;
    const clientIp = req.ip || req.socket.remoteAddress || '127.0.0.1';

    if (!inviteToken || !fullName || !username || !mobileNumber || !password) {
      return res.status(400).json({ success: false, error: 'All fields are required to complete your registration.' });
    }

    if (password.length < 8) {
      return res.status(400).json({ success: false, error: 'Password must be at least 8 characters long.' });
    }
    if (password !== confirmPassword) {
      return res.status(400).json({ success: false, error: 'Passwords do not match.' });
    }

    const tokenHash = crypto.createHmac('sha256', config.SESSION_SECRET).update(inviteToken).digest('hex');
    const db = getDatabase();

    const invitation = db.prepare(`
      SELECT * FROM admin_invitations 
      WHERE token_hash = ? AND is_accepted = 0
    `).get(tokenHash);

    if (!invitation) {
      return res.status(400).json({ success: false, error: 'Invitation link is invalid, already used, or expired.' });
    }

    if (new Date() > new Date(invitation.expires_at)) {
      return res.status(400).json({ success: false, error: 'This invitation has expired. Contact Super Admin for a new link.' });
    }

    const cleanUsername = username.trim().toLowerCase();
    const cleanMobile = mobileNumber.replace(/\s+/g, '');

    // Check unique constraints
    const existing = db.prepare(`
      SELECT username, email, mobile_number FROM admin_accounts 
      WHERE LOWER(username) = ? OR LOWER(email) = ? OR mobile_number = ?
    `).get(cleanUsername, invitation.email.toLowerCase(), cleanMobile);

    if (existing) {
      return res.status(409).json({ success: false, error: 'Username or mobile number is already taken.' });
    }

    const { hash, salt } = hashPassword(password);
    const newAdminId = `adm_${crypto.randomUUID()}`;

    try {
      db.exec('BEGIN TRANSACTION;');

      // Insert new Admin account
      db.prepare(`
        INSERT INTO admin_accounts (
          id, full_name, username, email, mobile_number, role_id,
          password_hash, password_salt, must_change_password, is_active, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 1, ?)
      `).run(
        newAdminId,
        fullName.trim(),
        cleanUsername,
        invitation.email,
        cleanMobile,
        invitation.role_id,
        hash,
        salt,
        `INVITATION_${invitation.id}`
      );

      // Mark invitation accepted
      db.prepare('UPDATE admin_invitations SET is_accepted = 1, accepted_at = CURRENT_TIMESTAMP WHERE id = ?').run(invitation.id);

      db.exec('COMMIT;');

      logSecurityAudit({
        actorType: 'ADMIN',
        actorId: newAdminId,
        action: 'ADMIN_INVITATION_ACCEPTED',
        details: { username: cleanUsername, email: invitation.email, roleId: invitation.role_id },
        ipAddress: clientIp
      });

      res.status(201).json({
        success: true,
        message: 'Administrative account successfully created! You may now proceed to Admin Login with dual OTP verification.'
      });
    } catch (err) {
      db.exec('ROLLBACK;');
      console.error('[ACCEPT INVITE ERROR]', err);
      res.status(500).json({ success: false, error: 'Failed to complete registration.' });
    }
  });

  // ==========================================
  // 5. SECURITY AUDIT LOGS (SUPER ADMIN / VIEW_AUDIT_LOGS)
  // ==========================================
  app.get('/api/admin/audit-logs', authenticateAdmin, requirePermission('VIEW_AUDIT_LOGS'), (req, res) => {
    try {
      const db = getDatabase();
      const limit = Math.min(Math.max(parseInt(req.query?.limit, 10) || 50, 1), 200);
      const action = req.query?.action ? req.query.action.trim() : null;
      const search = req.query?.search ? req.query.search.trim().toLowerCase() : null;

      let sql = `
        SELECT id, actor_type, actor_id, action, details, ip_address, created_at
        FROM security_audit_logs
      `;
      const params = [];
      const conditions = [];

      if (action && action !== 'ALL') {
        conditions.push(`action = ?`);
        params.push(action);
      }

      if (search) {
        conditions.push(`(LOWER(action) LIKE ? OR LOWER(details) LIKE ? OR LOWER(actor_id) LIKE ? OR LOWER(ip_address) LIKE ?)`);
        const searchPattern = `%${search}%`;
        params.push(searchPattern, searchPattern, searchPattern, searchPattern);
      }

      if (conditions.length > 0) {
        sql += ` WHERE ` + conditions.join(' AND ');
      }

      sql += ` ORDER BY created_at DESC LIMIT ?`;
      params.push(limit);

      const logs = db.prepare(sql).all(...params);

      return res.status(200).json({
        success: true,
        logs
      });
    } catch (err) {
      console.error('[AUDIT LOGS ERROR]', err);
      return res.status(500).json({
        success: false,
        error: 'Failed to retrieve security audit logs.'
      });
    }
  });

  // ==========================================
  // 6. PLATFORM OVERVIEW AGGREGATE STATS (SUPER ADMIN ONLY)
  // ==========================================
  app.get('/api/admin/stats', authenticateAdmin, requirePermission('FULL_ADMINISTRATION'), (req, res) => {
    try {
      const db = getDatabase();

      const totalUsers = db.prepare('SELECT COUNT(*) as count FROM users').get()?.count || 0;
      const totalDonors = db.prepare('SELECT COUNT(*) as count FROM donor_profiles').get()?.count || 0;
      const activeAdmins = db.prepare("SELECT COUNT(*) as count FROM admin_accounts WHERE role_id = 'ADMIN' AND is_active = 1").get()?.count || 0;
      const activeModerators = db.prepare("SELECT COUNT(*) as count FROM admin_accounts WHERE role_id = 'MODERATOR' AND is_active = 1").get()?.count || 0;
      const activeSuperAdmins = db.prepare("SELECT COUNT(*) as count FROM admin_accounts WHERE role_id = 'SUPER_ADMIN' AND is_active = 1").get()?.count || 0;
      const pendingProofs = db.prepare("SELECT COUNT(*) as count FROM donation_proofs WHERE status = 'PENDING'").get()?.count || 0;
      const approvedProofs = db.prepare("SELECT COUNT(*) as count FROM donation_proofs WHERE status = 'APPROVED'").get()?.count || 0;
      const rejectedProofs = db.prepare("SELECT COUNT(*) as count FROM donation_proofs WHERE status = 'REJECTED'").get()?.count || 0;
      const activeRequests = db.prepare(`
        SELECT COUNT(*) as count FROM emergency_requests 
        WHERE status = 'OPEN' 
          AND approval_status = 'APPROVED'
          AND (required_by IS NULL OR required_by > datetime('now'))
      `).get()?.count || 0;
      const pendingRequests = db.prepare(`
        SELECT COUNT(*) as count FROM emergency_requests 
        WHERE status = 'OPEN' 
          AND approval_status = 'PENDING'
          AND (required_by IS NULL OR required_by > datetime('now'))
      `).get()?.count || 0;
      const expiredRequests = db.prepare(`
        SELECT COUNT(*) as count FROM emergency_requests 
        WHERE status NOT IN ('FULFILLED', 'CANCELLED')
          AND units_fulfilled < units_requested
          AND required_by IS NOT NULL 
          AND required_by <= datetime('now')
      `).get()?.count || 0;
      const fulfilledRequests = db.prepare("SELECT COUNT(*) as count FROM emergency_requests WHERE status = 'FULFILLED' OR (units_requested > 0 AND units_fulfilled >= units_requested)").get()?.count || 0;
      const issuedCertificates = db.prepare('SELECT COUNT(*) as count FROM donation_certificates').get()?.count || 0;

      const recentActivities = db.prepare(`
        SELECT id, actor_type, actor_id, action, details, ip_address, created_at
        FROM security_audit_logs 
        ORDER BY created_at DESC LIMIT 6
      `).all();

      return res.status(200).json({
        success: true,
        stats: {
          totalUsers,
          totalDonors,
          activeAdmins,
          activeModerators,
          activeSuperAdmins,
          pendingProofs,
          approvedProofs,
          rejectedProofs,
          activeRequests,
          pendingRequests,
          expiredRequests,
          fulfilledRequests,
          issuedCertificates,
          recentActivities
        }
      });
    } catch (err) {
      console.error('[ADMIN STATS ERROR]', err);
      return res.status(500).json({
        success: false,
        error: 'Failed to retrieve administrative platform stats.'
      });
    }
  });

  // ==========================================
  // 7. GOVERNANCE: LIST ACTIVE ADMIN SESSIONS (SUPER ADMIN ONLY)
  // ==========================================
  app.get('/api/admin/governance/sessions', authenticateAdmin, requirePermission('FULL_ADMINISTRATION'), (req, res) => {
    try {
      const db = getDatabase();

      const sessions = db.prepare(`
        SELECT 
          s.id,
          s.admin_id,
          a.username,
          a.full_name,
          a.role_id,
          s.ip_address,
          s.user_agent,
          s.last_activity_at,
          s.expires_at,
          s.created_at
        FROM admin_sessions s
        JOIN admin_accounts a ON s.admin_id = a.id
        WHERE s.is_revoked = 0
        ORDER BY s.last_activity_at DESC
      `).all();

      return res.status(200).json({
        success: true,
        sessions: sessions.map(s => ({
          ...s,
          isCurrentSession: s.id === req.adminSession?.id
        }))
      });
    } catch (err) {
      console.error('[ADMIN SESSIONS ERROR]', err);
      return res.status(500).json({
        success: false,
        error: 'Failed to retrieve active administrative sessions.'
      });
    }
  });

  // ==========================================
  // 8. GOVERNANCE: REVOKE AN ADMIN SESSION (SUPER ADMIN ONLY)
  // ==========================================
  app.post('/api/admin/governance/sessions/:id/revoke', authenticateAdmin, requirePermission('FULL_ADMINISTRATION'), (req, res) => {
    try {
      const db = getDatabase();
      const targetSessionId = req.params.id;

      if (!targetSessionId) {
        return res.status(400).json({ success: false, error: 'Session ID is required.' });
      }

      if (req.adminSession && req.adminSession.id === targetSessionId) {
        return res.status(400).json({
          success: false,
          error: 'Cannot revoke your own active session via this endpoint. Please use standard logout.'
        });
      }

      const session = db.prepare(`
        SELECT s.*, a.username, a.role_id 
        FROM admin_sessions s 
        JOIN admin_accounts a ON s.admin_id = a.id 
        WHERE s.id = ?
      `).get(targetSessionId);

      if (!session) {
        return res.status(404).json({ success: false, error: 'Session not found.' });
      }

      if (session.is_revoked === 1) {
        return res.status(200).json({ success: true, message: 'Session was already revoked.' });
      }

      db.prepare('UPDATE admin_sessions SET is_revoked = 1 WHERE id = ?').run(targetSessionId);

      logSecurityAudit({
        actorType: 'ADMIN',
        actorId: req.admin.id,
        action: 'ADMIN_SESSION_REVOKED_BY_SUPER_ADMIN',
        details: {
          revokedSessionId: targetSessionId,
          targetAdminId: session.admin_id,
          targetUsername: session.username,
          targetRole: session.role_id,
          revokedBy: req.admin.username
        },
        ipAddress: req.ip || req.socket.remoteAddress || '127.0.0.1'
      });

      return res.status(200).json({
        success: true,
        message: `Administrative session for ${session.username} successfully revoked.`
      });
    } catch (err) {
      console.error('[REVOKE SESSION ERROR]', err);
      return res.status(500).json({
        success: false,
        error: 'Failed to revoke administrative session.'
      });
    }
  });

}
