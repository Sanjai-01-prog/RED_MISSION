import crypto from 'node:crypto';
import { getDatabase } from '../database/connection.js';
import { config } from '../config/env.js';
import { 
  hashPassword, 
  verifyPassword, 
  generateOtp, 
  hashOtp, 
  verifyOtp, 
  generateSecureToken 
} from '../utils/crypto.js';
import { sendSms, verifyMobileOtp } from '../utils/sms.js';
import { sendEmail } from '../utils/mailer.js';
import { rateLimiter } from '../utils/rateLimiter.js';
import { logSecurityAudit } from '../utils/auditLogger.js';
import { authenticateAdmin, requirePermission } from '../middleware/authMiddleware.js';

export function setupAdminAuthRoutes(app) {

  // ==========================================
  // 1. ADMIN LOGIN STEP 1: CREDENTIALS CHECK & DUAL OTP DISPATCH
  // ==========================================

  app.post('/api/admin/login/step1', async (req, res) => {
    const { identifier, password } = req.body;
    const clientIp = req.ip || req.socket.remoteAddress || '127.0.0.1';
    const userAgent = req.headers['user-agent'] || 'Unknown Browser';

    if (!identifier || !password) {
      return res.status(400).json({
        success: false,
        error: 'Please enter your Admin username or email, and password.'
      });
    }

    // Rate limiting per IP for Admin endpoint
    const limit = rateLimiter.check(`admin_login_ip_${clientIp}`, 10, 5 * 60 * 1000);
    if (!limit.allowed) {
      return res.status(429).json({ success: false, error: limit.error });
    }

    const cleanIdentifier = identifier.trim().toLowerCase();
    const db = getDatabase();

    // Find admin by username or email
    const admin = db.prepare(`
      SELECT * FROM admin_accounts 
      WHERE LOWER(username) = ? OR LOWER(email) = ?
    `).get(cleanIdentifier, cleanIdentifier);

    if (!admin) {
      // Record failed login attempt
      db.prepare(`
        INSERT INTO login_attempts (id, identifier, account_type, ip_address, user_agent, success, failure_reason)
        VALUES (?, ?, 'ADMIN', ?, ?, 0, 'ADMIN_NOT_FOUND')
      `).run(`att_${crypto.randomUUID()}`, cleanIdentifier, clientIp, userAgent);

      return res.status(401).json({
        success: false,
        error: 'Invalid administrative credentials.'
      });
    }

    if (!admin.is_active || admin.is_suspended) {
      return res.status(403).json({
        success: false,
        error: 'This administrative account is inactive or suspended. Contact Super Admin.'
      });
    }

    // Check temporary lockout
    const now = new Date();
    if (admin.lockout_until) {
      const lockoutExpiry = new Date(admin.lockout_until);
      if (now < lockoutExpiry) {
        const remainingMinutes = Math.ceil((lockoutExpiry.getTime() - now.getTime()) / (60 * 1000));
        return res.status(423).json({
          success: false,
          code: 'ADMIN_ACCOUNT_LOCKED',
          error: `Account temporarily locked due to excessive failed attempts. Please try again in ${remainingMinutes} minutes.`
        });
      } else {
        db.prepare('UPDATE admin_accounts SET failed_login_attempts = 0, lockout_until = NULL WHERE id = ?').run(admin.id);
        admin.failed_login_attempts = 0;
      }
    }

    // Verify Password
    const passwordValid = verifyPassword(password, admin.password_salt, admin.password_hash);
    if (!passwordValid) {
      const updatedAttempts = (admin.failed_login_attempts || 0) + 1;
      let lockoutDate = null;
      let isNowLocked = false;

      if (updatedAttempts >= config.MAX_FAILED_LOGIN_ATTEMPTS) {
        lockoutDate = new Date(now.getTime() + config.LOCKOUT_DURATION_MINUTES * 60 * 1000).toISOString();
        isNowLocked = true;

        logSecurityAudit({
          actorType: 'ADMIN',
          actorId: admin.id,
          action: 'ADMIN_ACCOUNT_LOCKED_OUT',
          details: { ip: clientIp, attempts: updatedAttempts },
          ipAddress: clientIp
        });
      }

      db.prepare(`
        UPDATE admin_accounts 
        SET failed_login_attempts = ?, lockout_until = ?
        WHERE id = ?
      `).run(updatedAttempts, lockoutDate, admin.id);

      db.prepare(`
        INSERT INTO login_attempts (id, identifier, account_type, ip_address, user_agent, success, failure_reason)
        VALUES (?, ?, 'ADMIN', ?, ?, 0, 'INCORRECT_PASSWORD')
      `).run(`att_${crypto.randomUUID()}`, cleanIdentifier, clientIp, userAgent);

      if (isNowLocked) {
        return res.status(423).json({
          success: false,
          code: 'ADMIN_ACCOUNT_LOCKED',
          error: `Maximum incorrect attempts reached. Admin access temporarily locked for ${config.LOCKOUT_DURATION_MINUTES} minutes.`
        });
      }

      const remaining = config.MAX_FAILED_LOGIN_ATTEMPTS - updatedAttempts;
      return res.status(401).json({
        success: false,
        error: `Incorrect password. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`
      });
    }

    // Password verified!
    // If OTP_ENABLED is false, complete administrative authentication directly
    if (!config.OTP_ENABLED) {
      db.prepare('UPDATE admin_accounts SET failed_login_attempts = 0, lockout_until = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(admin.id);

      const sessionToken = generateSecureToken(32);
      const sessionTokenHash = crypto.createHmac('sha256', config.SESSION_SECRET).update(sessionToken).digest('hex');
      const sessionExpiresAt = new Date(Date.now() + config.ADMIN_SESSION_MAX_HOURS * 60 * 60 * 1000).toISOString();

      const nowIso = new Date().toISOString();
      db.prepare(`
        INSERT INTO admin_sessions (id, admin_id, session_token_hash, ip_address, user_agent, last_activity_at, expires_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(sessionToken, admin.id, sessionTokenHash, clientIp, userAgent, nowIso, sessionExpiresAt);

      db.prepare(`
        INSERT INTO login_attempts (id, identifier, account_type, ip_address, user_agent, success)
        VALUES (?, ?, 'ADMIN', ?, ?, 1)
      `).run(`att_${crypto.randomUUID()}`, admin.username, clientIp, userAgent);

      logSecurityAudit({
        actorType: 'ADMIN',
        actorId: admin.id,
        action: 'ADMIN_LOGIN_SUCCESS',
        details: { role: admin.role_id, username: admin.username, mode: 'DIRECT_AUTH_OTP_DISABLED' },
        ipAddress: clientIp
      });

      const permissions = db.prepare(`
        SELECT permission FROM role_permissions WHERE role_id = ?
      `).all(admin.role_id).map(r => r.permission);

      res.setHeader('Set-Cookie', [
        `red_mission_admin_session=${sessionToken}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${config.ADMIN_SESSION_MAX_HOURS * 3600}${config.IS_PROD ? '; Secure' : ''}`
      ]);

      return res.json({
        success: true,
        directAuth: true,
        message: 'Administrative authentication successful! Welcome to Medical Command.',
        token: sessionToken,
        admin: {
          id: admin.id,
          fullName: admin.full_name,
          username: admin.username,
          email: admin.email,
          mobileNumber: admin.mobile_number,
          roleId: admin.role_id,
          roleName: admin.role_name,
          mustChangePassword: Boolean(admin.must_change_password),
          permissions
        }
      });
    }

    // Password verified! Now generate TWO SEPARATE OTPs (when OTP_ENABLED is true):
    // 1. Mobile OTP
    const isCustomOrDemo = config.SMS_PROVIDER === 'DEMO' || Boolean(config.FAST2SMS_CUSTOM_OTP);
    const rawMobileOtp = isCustomOrDemo ? generateOtp() : null;
    const { hash: mobHash, salt: mobSalt } = rawMobileOtp ? hashOtp(rawMobileOtp) : { hash: 'FAST2SMS_MANAGED', salt: 'FAST2SMS_MANAGED' };

    // 2. Email OTP (Always independent)
    const rawEmailOtp = generateOtp();
    const { hash: emHash, salt: emSalt } = hashOtp(rawEmailOtp);

    const preAuthToken = generateSecureToken(32);
    const otpRecordId = `aotp_${crypto.randomUUID()}`;
    const expiresAt = new Date(Date.now() + config.OTP_EXPIRY_MINUTES * 60 * 1000).toISOString();

    db.prepare(`
      INSERT INTO admin_otp_records (
        id, admin_id, session_pre_auth_token,
        mobile_otp_hash, mobile_otp_salt, plain_demo_mobile_otp,
        email_otp_hash, email_otp_salt, plain_demo_email_otp,
        expires_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      otpRecordId,
      admin.id,
      preAuthToken,
      mobHash,
      mobSalt,
      (config.SMS_PROVIDER === 'DEMO' && !config.IS_PROD) ? rawMobileOtp : null,
      emHash,
      emSalt,
      config.IS_PROD ? null : rawEmailOtp,
      expiresAt
    );

    // Dispatch SMS to admin's registered mobile
    const smsRes = await sendSms({
      mobileNumber: admin.mobile_number,
      message: rawMobileOtp ? `RED MISSION Medical Command 2FA: Mobile verification code is: ${rawMobileOtp}. Valid for ${config.OTP_EXPIRY_MINUTES} mins.` : 'RED MISSION Medical Command 2FA verification code has been dispatched.',
      otp: rawMobileOtp
    });

    if (!smsRes.success) {
      db.prepare('DELETE FROM admin_otp_records WHERE id = ?').run(otpRecordId);
      return res.status(400).json({
        success: false,
        error: `SMS 2FA delivery failed: ${smsRes.error || 'Unable to deliver verification code.'}`
      });
    }

    // Dispatch Email to admin's registered email
    const emailRes = await sendEmail({
      to: admin.email,
      subject: 'RED MISSION Medical Command — 2FA Email Verification Code',
      text: `Hello ${admin.full_name},\n\nYour RED MISSION Admin login code is: ${rawEmailOtp}\n\nBoth Mobile and Email OTPs must be provided to complete authentication.`,
      otp: rawEmailOtp
    });

    // Mask phone & email for safe UI display
    const maskedPhone = admin.mobile_number.replace(/(\d{3})\d+(\d{4})/, '$1****$2');
    const [emailUser, emailDomain] = admin.email.split('@');
    const maskedEmail = `${emailUser.substring(0, 2)}****@${emailDomain}`;

    res.json({
      success: true,
      message: 'Dual 2FA initiated. Separate OTPs have been dispatched to your registered Mobile and Email.',
      preAuthToken,
      maskedPhone,
      maskedEmail,
      demoMobileOtp: (config.SMS_PROVIDER === 'DEMO' && !config.IS_PROD) ? smsRes.demoOtp : null,
      demoEmailOtp: emailRes.demoOtp  // only in development!
    });
  });

  // ==========================================
  // 2. ADMIN LOGIN STEP 2: VERIFY BOTH OTPS (MOBILE + EMAIL)
  // ==========================================

  app.post('/api/admin/login/verify-otps', async (req, res) => {
    const { preAuthToken, mobileOtp, emailOtp } = req.body;
    const clientIp = req.ip || req.socket.remoteAddress || '127.0.0.1';
    const userAgent = req.headers['user-agent'] || 'Unknown Browser';

    if (!preAuthToken || !mobileOtp || !emailOtp) {
      return res.status(400).json({
        success: false,
        error: 'Both Mobile OTP and Email OTP must be provided to complete Admin authentication.'
      });
    }

    const db = getDatabase();
    const otpRecord = db.prepare(`
      SELECT * FROM admin_otp_records 
      WHERE session_pre_auth_token = ? AND is_completed = 0
    `).get(preAuthToken);

    if (!otpRecord) {
      return res.status(400).json({
        success: false,
        error: 'Invalid or expired 2FA session. Please log in again.'
      });
    }

    if (new Date() > new Date(otpRecord.expires_at)) {
      return res.status(400).json({
        success: false,
        error: '2FA codes have expired. Please start login again.'
      });
    }

    const attempts = (otpRecord.attempts || 0) + 1;
    if (attempts > 3) {
      db.prepare('DELETE FROM admin_otp_records WHERE id = ?').run(otpRecord.id);
      return res.status(429).json({
        success: false,
        error: 'Too many incorrect 2FA attempts. Login aborted for security.'
      });
    }

    db.prepare('UPDATE admin_otp_records SET attempts = ? WHERE id = ?').run(attempts, otpRecord.id);

    // Fetch admin details and role
    const admin = db.prepare(`
      SELECT a.*, r.name as role_name, r.description as role_description 
      FROM admin_accounts a
      JOIN admin_roles r ON a.role_id = r.id
      WHERE a.id = ?
    `).get(otpRecord.admin_id);

    if (!admin) {
      return res.status(404).json({ success: false, error: 'Administrative account not found.' });
    }

    // Verify Mobile OTP (via Fast2SMS or Demo Gateway)
    const mobVerifyRes = await verifyMobileOtp({
      mobileNumber: admin.mobile_number,
      otp: mobileOtp,
      salt: otpRecord.mobile_otp_salt,
      hash: otpRecord.mobile_otp_hash
    });
    const isMobileValid = mobVerifyRes.success;

    // Verify Email OTP
    const isEmailValid = verifyOtp(emailOtp, otpRecord.email_otp_salt, otpRecord.email_otp_hash);

    if (!isMobileValid || !isEmailValid) {
      let specificError = 'Verification failed: ';
      if (!isMobileValid && !isEmailValid) specificError += 'Both Mobile OTP and Email OTP are incorrect.';
      else if (!isMobileValid) specificError += (mobVerifyRes.error || 'Mobile OTP is incorrect.');
      else specificError += 'Email OTP is incorrect.';

      return res.status(400).json({
        success: false,
        error: `${specificError} (${3 - attempts} attempt${3 - attempts === 1 ? '' : 's'} remaining).`
      });
    }

    // Mark completed
    db.prepare('UPDATE admin_otp_records SET is_completed = 1, mobile_verified = 1, email_verified = 1 WHERE id = ?').run(otpRecord.id);

    // Reset failed login attempts on admin account
    db.prepare('UPDATE admin_accounts SET failed_login_attempts = 0, lockout_until = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(admin.id);

    // Create Admin Session (8 hours max duration, 30 min inactivity)
    const sessionToken = generateSecureToken(32);
    const sessionTokenHash = crypto.createHmac('sha256', config.SESSION_SECRET).update(sessionToken).digest('hex');
    const sessionExpiresAt = new Date(Date.now() + config.ADMIN_SESSION_MAX_HOURS * 60 * 60 * 1000).toISOString();

    const nowIso = new Date().toISOString();
    db.prepare(`
      INSERT INTO admin_sessions (id, admin_id, session_token_hash, ip_address, user_agent, last_activity_at, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(sessionToken, admin.id, sessionTokenHash, clientIp, userAgent, nowIso, sessionExpiresAt);

    // Record successful admin login
    db.prepare(`
      INSERT INTO login_attempts (id, identifier, account_type, ip_address, user_agent, success)
      VALUES (?, ?, 'ADMIN', ?, ?, 1)
    `).run(`att_${crypto.randomUUID()}`, admin.username, clientIp, userAgent);

    // Log Security Audit
    logSecurityAudit({
      actorType: 'ADMIN',
      actorId: admin.id,
      action: 'ADMIN_LOGIN_SUCCESS',
      details: { role: admin.role_id, username: admin.username },
      ipAddress: clientIp
    });

    // Fetch permissions
    const permissions = db.prepare(`
      SELECT permission FROM role_permissions WHERE role_id = ?
    `).all(admin.role_id).map(r => r.permission);

    // Set HTTP-only Cookie
    res.setHeader('Set-Cookie', [
      `red_mission_admin_session=${sessionToken}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${config.ADMIN_SESSION_MAX_HOURS * 3600}${config.IS_PROD ? '; Secure' : ''}`
    ]);

    res.json({
      success: true,
      message: 'Dual 2FA successfully verified! Welcome to Medical Command.',
      token: sessionToken,
      admin: {
        id: admin.id,
        fullName: admin.full_name,
        username: admin.username,
        email: admin.email,
        mobileNumber: admin.mobile_number,
        roleId: admin.role_id,
        roleName: admin.role_name,
        mustChangePassword: Boolean(admin.must_change_password),
        permissions
      }
    });
  });

  // ==========================================
  // 3. ADMIN CURRENT SESSION & LOGOUT
  // ==========================================

  app.get('/api/admin/me', authenticateAdmin, (req, res) => {
    res.json({
      success: true,
      admin: req.admin
    });
  });

  app.post('/api/admin/logout', authenticateAdmin, (req, res) => {
    const db = getDatabase();
    db.prepare('UPDATE admin_sessions SET is_revoked = 1 WHERE id = ?').run(req.adminSession.id);

    logSecurityAudit({
      actorType: 'ADMIN',
      actorId: req.admin.id,
      action: 'ADMIN_LOGOUT',
      details: { username: req.admin.username },
      ipAddress: req.ip || '127.0.0.1'
    });

    res.setHeader('Set-Cookie', [
      'red_mission_admin_session=; Path=/; HttpOnly; Max-Age=0'
    ]);

    res.json({
      success: true,
      message: 'Admin session terminated.'
    });
  });

  // ==========================================
  // 4. ADMIN MANDATORY PASSWORD CHANGE
  // ==========================================

  app.post('/api/admin/change-password', authenticateAdmin, (req, res) => {
    const { currentPassword, newPassword, confirmPassword } = req.body;
    const clientIp = req.ip || req.socket.remoteAddress || '127.0.0.1';

    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({ success: false, error: 'New password must be at least 8 characters long.' });
    }
    if (newPassword !== confirmPassword) {
      return res.status(400).json({ success: false, error: 'New passwords do not match.' });
    }

    const db = getDatabase();
    const admin = db.prepare('SELECT * FROM admin_accounts WHERE id = ?').get(req.admin.id);

    // If voluntary, check current password; if must_change_password was set by Super Admin, verify current temporary password
    if (currentPassword && !verifyPassword(currentPassword, admin.password_salt, admin.password_hash)) {
      return res.status(401).json({ success: false, error: 'Current password is incorrect.' });
    }

    const { hash, salt } = hashPassword(newPassword);
    db.prepare(`
      UPDATE admin_accounts 
      SET password_hash = ?, password_salt = ?, must_change_password = 0, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(hash, salt, admin.id);

    logSecurityAudit({
      actorType: 'ADMIN',
      actorId: admin.id,
      action: 'ADMIN_PASSWORD_CHANGED',
      details: { username: admin.username },
      ipAddress: clientIp
    });

    res.json({
      success: true,
      message: 'Password successfully updated! Your account is fully secured.'
    });
  });

  // ==========================================
  // 5. ADMIN PASSWORD RECOVERY
  // ==========================================

  app.post('/api/admin/forgot-password/request', async (req, res) => {
    const { identifier, channel } = req.body; // channel: 'EMAIL' or 'MOBILE'
    const clientIp = req.ip || req.socket.remoteAddress || '127.0.0.1';

    if (!identifier) {
      return res.status(400).json({ success: false, error: 'Please enter your administrative username or email.' });
    }

    const cleanIdentifier = identifier.trim().toLowerCase();
    const db = getDatabase();
    const admin = db.prepare(`
      SELECT * FROM admin_accounts 
      WHERE LOWER(username) = ? OR LOWER(email) = ? OR mobile_number = ?
    `).get(cleanIdentifier, cleanIdentifier, cleanIdentifier);

    const standardSuccessMsg = 'If a matching administrative profile exists, secure recovery credentials have been dispatched.';

    if (!admin) {
      return res.json({ success: true, message: standardSuccessMsg });
    }

    const expiresAt = new Date(Date.now() + config.OTP_EXPIRY_MINUTES * 60 * 1000).toISOString();

    if (channel === 'MOBILE') {
      if (!config.OTP_ENABLED) {
        return res.status(400).json({
          success: false,
          code: 'SMS_OTP_DISABLED',
          error: 'SMS OTP recovery is temporarily disabled. Please select the "Email Link" recovery channel or contact Super Admin.'
        });
      }

      const isCustomOrDemo = config.SMS_PROVIDER === 'DEMO' || Boolean(config.FAST2SMS_CUSTOM_OTP);
      const rawOtp = isCustomOrDemo ? generateOtp() : null;
      const { hash, salt } = rawOtp ? hashOtp(rawOtp) : { hash: 'FAST2SMS_MANAGED', salt: 'FAST2SMS_MANAGED' };

      const smsRes = await sendSms({
        mobileNumber: admin.mobile_number,
        message: rawOtp ? `RED MISSION Admin Password Recovery OTP: ${rawOtp}. Valid for ${config.OTP_EXPIRY_MINUTES} mins.` : 'RED MISSION Admin Password Recovery OTP has been dispatched.',
        otp: rawOtp
      });

      if (!smsRes.success) {
        return res.status(400).json({
          success: false,
          error: smsRes.error || 'Failed to dispatch password recovery SMS. Please try again.'
        });
      }

      db.prepare(`
        INSERT INTO otp_records (id, identifier, type, otp_hash, otp_salt, plain_demo_otp, expires_at, ip_address)
        VALUES (?, ?, 'ADMIN_PASSWORD_RESET', ?, ?, ?, ?, ?)
      `).run(`otp_${crypto.randomUUID()}`, admin.mobile_number, hash, salt, (config.SMS_PROVIDER === 'DEMO' && !config.IS_PROD) ? rawOtp : null, expiresAt, clientIp);

      return res.json({
        success: true,
        message: standardSuccessMsg,
        channel: 'MOBILE',
        demoOtp: (config.SMS_PROVIDER === 'DEMO' && !config.IS_PROD) ? smsRes.demoOtp : null
      });
    } else {
      const resetToken = generateSecureToken(32);
      const tokenHash = crypto.createHmac('sha256', config.SESSION_SECRET).update(resetToken).digest('hex');

      db.prepare(`
        INSERT INTO password_reset_tokens (id, account_id, account_type, token_hash, identifier, delivery_channel, expires_at)
        VALUES (?, ?, 'ADMIN', ?, ?, 'EMAIL_LINK', ?)
      `).run(`prt_${crypto.randomUUID()}`, admin.id, tokenHash, admin.email, expiresAt);

      const resetLink = `https://redmission.org/admin/reset-password?token=${resetToken}`;
      const emailRes = await sendEmail({
        to: admin.email,
        subject: 'RED MISSION — Administrative Password Reset',
        text: `Hello ${admin.full_name},\n\nA password reset was requested for your RED MISSION administrative account. Use this secure single-use link:\n${resetLink}\n\nValid for ${config.OTP_EXPIRY_MINUTES} minutes.`,
        link: resetLink
      });

      return res.json({
        success: true,
        message: standardSuccessMsg,
        channel: 'EMAIL',
        demoLink: emailRes.demoLink
      });
    }
  });

  app.post('/api/admin/forgot-password/reset', async (req, res) => {
    const { identifier, resetToken, otp, newPassword, confirmPassword } = req.body;
    const clientIp = req.ip || req.socket.remoteAddress || '127.0.0.1';

    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({ success: false, error: 'Password must be at least 8 characters long.' });
    }
    if (newPassword !== confirmPassword) {
      return res.status(400).json({ success: false, error: 'Passwords do not match.' });
    }

    const db = getDatabase();
    let verifiedAdmin = null;

    if (resetToken) {
      const tokenHash = crypto.createHmac('sha256', config.SESSION_SECRET).update(resetToken).digest('hex');
      const resetRecord = db.prepare(`
        SELECT * FROM password_reset_tokens 
        WHERE token_hash = ? AND is_used = 0 AND account_type = 'ADMIN'
      `).get(tokenHash);

      if (!resetRecord || new Date() > new Date(resetRecord.expires_at)) {
        return res.status(400).json({ success: false, error: 'Reset link is invalid or has expired.' });
      }

      verifiedAdmin = db.prepare('SELECT * FROM admin_accounts WHERE id = ?').get(resetRecord.account_id);
      db.prepare('UPDATE password_reset_tokens SET is_used = 1, used_at = CURRENT_TIMESTAMP WHERE id = ?').run(resetRecord.id);
    } else if (otp && identifier) {
      const cleanMobile = identifier.replace(/\s+/g, '');
      const otpRecord = db.prepare(`
        SELECT * FROM otp_records 
        WHERE identifier = ? AND type = 'ADMIN_PASSWORD_RESET' AND is_used = 0
        ORDER BY created_at DESC LIMIT 1
      `).get(cleanMobile);

      if (!otpRecord || new Date() > new Date(otpRecord.expires_at)) {
        return res.status(400).json({ success: false, error: 'OTP is invalid or has expired.' });
      }

      const verifyRes = await verifyMobileOtp({
        mobileNumber: cleanMobile,
        otp,
        salt: otpRecord.otp_salt,
        hash: otpRecord.otp_hash
      });

      if (!verifyRes.success) {
        return res.status(400).json({ success: false, error: verifyRes.error || 'Incorrect verification code.' });
      }

      verifiedAdmin = db.prepare('SELECT * FROM admin_accounts WHERE mobile_number = ?').get(cleanMobile);
      db.prepare('UPDATE otp_records SET is_used = 1, used_at = CURRENT_TIMESTAMP WHERE id = ?').run(otpRecord.id);
    } else {
      return res.status(400).json({ success: false, error: 'Provide recovery token or mobile OTP.' });
    }

    if (!verifiedAdmin) {
      return res.status(404).json({ success: false, error: 'Admin account not found.' });
    }

    const { hash, salt } = hashPassword(newPassword);
    db.prepare(`
      UPDATE admin_accounts 
      SET password_hash = ?, password_salt = ?, failed_login_attempts = 0, lockout_until = NULL, must_change_password = 0, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(hash, salt, verifiedAdmin.id);

    // Revoke all existing sessions
    db.prepare('UPDATE admin_sessions SET is_revoked = 1 WHERE admin_id = ?').run(verifiedAdmin.id);

    logSecurityAudit({
      actorType: 'ADMIN',
      actorId: verifiedAdmin.id,
      action: 'ADMIN_PASSWORD_RESET_COMPLETED',
      ipAddress: clientIp
    });

    res.json({
      success: true,
      message: 'Admin password successfully updated! Please log in.'
    });
  });

}
