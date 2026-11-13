import { getDatabase } from '../database/connection.js';
import { config } from '../config/env.js';

function parseDbDate(str) {
  if (!str) return new Date();
  if (typeof str === 'number') return new Date(str);
  if (str.endsWith('Z')) return new Date(str);
  if (str.includes('T')) return new Date(str + 'Z');
  return new Date(str.replace(' ', 'T') + 'Z');
}

export function authenticateUser(req, res, next) {
  const token = extractToken(req, 'red_mission_user_session');
  if (!token) {
    return res.status(401).json({
      success: false,
      code: 'AUTH_REQUIRED',
      error: 'Authentication required. Please log in.'
    });
  }

  const db = getDatabase();
  const session = db.prepare(`
    SELECT * FROM user_sessions 
    WHERE id = ? AND is_revoked = 0
  `).get(token);

  if (!session) {
    return res.status(401).json({
      success: false,
      code: 'INVALID_SESSION',
      error: 'Invalid or revoked session. Please log in again.'
    });
  }

  const now = new Date();
  const expiresAt = parseDbDate(session.expires_at);
  const lastActivity = parseDbDate(session.last_activity_at);
  
  // Check maximum session duration (24 hours)
  if (now > expiresAt) {
    db.prepare('UPDATE user_sessions SET is_revoked = 1 WHERE id = ?').run(token);
    return res.status(401).json({
      success: false,
      code: 'SESSION_EXPIRED_MAX_DURATION',
      error: 'Session expired (maximum 24 hours reached). Please log in again.'
    });
  }

  // Check inactivity timeout (30 minutes)
  const inactivityMinutes = (now.getTime() - lastActivity.getTime()) / (1000 * 60);
  if (inactivityMinutes > config.USER_SESSION_INACTIVITY_MINUTES) {
    db.prepare('UPDATE user_sessions SET is_revoked = 1 WHERE id = ?').run(token);
    return res.status(401).json({
      success: false,
      code: 'SESSION_EXPIRED_INACTIVITY',
      error: `Session expired due to ${config.USER_SESSION_INACTIVITY_MINUTES} minutes of inactivity. Please log in again.`
    });
  }

  // Fetch user
  const user = db.prepare(`
    SELECT id, full_name, mobile_number, email, age, blood_group, city, 
           is_active, is_suspended, created_at 
    FROM users WHERE id = ?
  `).get(session.user_id);

  if (!user || user.is_suspended) {
    return res.status(403).json({
      success: false,
      code: 'ACCOUNT_SUSPENDED',
      error: 'Your account is suspended or no longer accessible. Please contact support.'
    });
  }

  // Refresh last activity timestamp with ISO string
  const currentIso = new Date().toISOString();
  db.prepare('UPDATE user_sessions SET last_activity_at = ? WHERE id = ?').run(currentIso, token);

  req.user = user;
  req.session = session;
  next();
}

export function authenticateAdmin(req, res, next) {
  const token = extractToken(req, 'red_mission_admin_session');
  if (!token) {
    return res.status(401).json({
      success: false,
      code: 'ADMIN_AUTH_REQUIRED',
      error: 'Admin authentication required.'
    });
  }

  const db = getDatabase();
  const session = db.prepare(`
    SELECT * FROM admin_sessions 
    WHERE id = ? AND is_revoked = 0
  `).get(token);

  if (!session) {
    return res.status(401).json({
      success: false,
      code: 'INVALID_ADMIN_SESSION',
      error: 'Invalid or revoked admin session.'
    });
  }

  const now = new Date();
  const expiresAt = parseDbDate(session.expires_at);
  const lastActivity = parseDbDate(session.last_activity_at);

  // Check maximum admin session duration (8 hours)
  if (now > expiresAt) {
    db.prepare('UPDATE admin_sessions SET is_revoked = 1 WHERE id = ?').run(token);
    return res.status(401).json({
      success: false,
      code: 'ADMIN_SESSION_EXPIRED_MAX',
      error: 'Admin session expired (maximum 8 hours reached).'
    });
  }

  // Check admin inactivity timeout (30 minutes)
  const inactivityMinutes = (now.getTime() - lastActivity.getTime()) / (1000 * 60);
  if (inactivityMinutes > config.ADMIN_SESSION_INACTIVITY_MINUTES) {
    db.prepare('UPDATE admin_sessions SET is_revoked = 1 WHERE id = ?').run(token);
    return res.status(401).json({
      success: false,
      code: 'ADMIN_SESSION_EXPIRED_INACTIVITY',
      error: 'Admin session timed out due to 30 minutes of inactivity.'
    });
  }

  // Fetch admin account and permissions
  const admin = db.prepare(`
    SELECT a.id, a.full_name, a.username, a.email, a.mobile_number, 
           a.role_id, a.must_change_password, a.is_active, a.is_suspended,
           r.name as role_name
    FROM admin_accounts a
    JOIN admin_roles r ON a.role_id = r.id
    WHERE a.id = ?
  `).get(session.admin_id);

  if (!admin || !admin.is_active || admin.is_suspended) {
    return res.status(403).json({
      success: false,
      code: 'ADMIN_SUSPENDED',
      error: 'Admin account is inactive or suspended.'
    });
  }

  // Fetch assigned permissions
  const permissions = db.prepare(`
    SELECT permission FROM role_permissions WHERE role_id = ?
  `).all(admin.role_id).map(r => r.permission);

  // Refresh admin last activity
  const currentIso = new Date().toISOString();
  db.prepare('UPDATE admin_sessions SET last_activity_at = ? WHERE id = ?').run(currentIso, token);

  req.admin = {
    ...admin,
    permissions
  };
  req.adminSession = session;
  next();
}

/**
 * Role-Based Access Control middleware to guard endpoints by permission
 */
export function requirePermission(requiredPermission) {
  return (req, res, next) => {
    if (!req.admin) {
      return res.status(401).json({ success: false, error: 'Admin authentication required.' });
    }

    if (req.admin.role_id === 'SUPER_ADMIN' || req.admin.permissions.includes(requiredPermission)) {
      return next();
    }

    return res.status(403).json({
      success: false,
      code: 'FORBIDDEN_INSUFFICIENT_PERMISSIONS',
      error: `Access Denied: You do not possess the required permission [${requiredPermission}] for this administrative action.`
    });
  };
}

function extractToken(req, cookieName) {
  // Check Authorization Bearer header
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7).trim();
  }

  // Check Cookie header
  const cookieHeader = req.headers['cookie'];
  if (cookieHeader) {
    const cookies = cookieHeader.split(';').map(c => c.trim());
    for (const cookie of cookies) {
      if (cookie.startsWith(`${cookieName}=`)) {
        return cookie.substring(cookieName.length + 1).trim();
      }
    }
  }

  return null;
}

/**
 * Unified authentication middleware for endpoints accessible by either
 * an authenticated User or an Admin (e.g. donor photograph streaming).
 *
 * Resolves both:
 * - Authorization: Bearer <token> (User or Admin token)
 * - Cookie: red_mission_user_session=<token>
 * - Cookie: red_mission_admin_session=<token>
 *
 * Unlike sequential middleware wrapping, this resolver does not terminate
 * early on a token type mismatch, allowing admin Bearer tokens to be verified
 * against admin_sessions even if they do not exist in user_sessions.
 */
export function authenticateAny(req, res, next) {
  // Extract candidate tokens
  const authHeader = req.headers['authorization'];
  let bearerToken = null;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    bearerToken = authHeader.substring(7).trim();
  } else if (req.query && req.query.token) {
    bearerToken = String(req.query.token).trim();
  }

  const cookieHeader = req.headers['cookie'] || '';
  const cookies = Object.fromEntries(
    cookieHeader.split(';').map(c => c.trim().split('=').map(decodeURIComponent)).filter(p => p.length === 2)
  );

  const candidateUserToken = cookies['red_mission_user_session'] || bearerToken;
  const candidateAdminToken = cookies['red_mission_admin_session'] || bearerToken;

  if (!candidateUserToken && !candidateAdminToken) {
    return res.status(401).json({
      success: false,
      code: 'AUTH_REQUIRED',
      error: 'Authentication required to access donor photographs.'
    });
  }

  const db = getDatabase();
  const now = new Date();

  // 1. Check User Session
  if (candidateUserToken) {
    const userSession = db.prepare(`
      SELECT * FROM user_sessions 
      WHERE id = ? AND is_revoked = 0
    `).get(candidateUserToken);

    if (userSession) {
      const expiresAt = parseDbDate(userSession.expires_at);
      const lastActivity = parseDbDate(userSession.last_activity_at);

      // Check max duration (24 hours)
      if (now > expiresAt) {
        db.prepare('UPDATE user_sessions SET is_revoked = 1 WHERE id = ?').run(candidateUserToken);
        return res.status(401).json({
          success: false,
          code: 'SESSION_EXPIRED_MAX_DURATION',
          error: 'Session expired (maximum 24 hours reached). Please log in again.'
        });
      }

      // Check inactivity timeout (30 minutes)
      const inactivityMinutes = (now.getTime() - lastActivity.getTime()) / (1000 * 60);
      if (inactivityMinutes > config.USER_SESSION_INACTIVITY_MINUTES) {
        db.prepare('UPDATE user_sessions SET is_revoked = 1 WHERE id = ?').run(candidateUserToken);
        return res.status(401).json({
          success: false,
          code: 'SESSION_EXPIRED_INACTIVITY',
          error: `Session expired due to ${config.USER_SESSION_INACTIVITY_MINUTES} minutes of inactivity. Please log in again.`
        });
      }

      // Fetch user account
      const user = db.prepare(`
        SELECT id, full_name, mobile_number, email, age, blood_group, city, 
               is_active, is_suspended, created_at 
        FROM users WHERE id = ?
      `).get(userSession.user_id);

      if (!user) {
        return res.status(401).json({
          success: false,
          code: 'USER_NOT_FOUND',
          error: 'User account not found.'
        });
      }

      if (!user.is_active || user.is_suspended) {
        return res.status(403).json({
          success: false,
          code: 'ACCOUNT_INACTIVE',
          error: 'Account is inactive or suspended. Contact support.'
        });
      }

      // Update activity
      db.prepare('UPDATE user_sessions SET last_activity_at = CURRENT_TIMESTAMP WHERE id = ?').run(candidateUserToken);

      req.user = user;
      req.userSession = userSession;
      return next();
    }
  }

  // 2. Check Admin Session (either from admin cookie or fallback from Bearer token)
  if (candidateAdminToken) {
    const adminSession = db.prepare(`
      SELECT * FROM admin_sessions 
      WHERE id = ? AND is_revoked = 0
    `).get(candidateAdminToken);

    if (adminSession) {
      const expiresAt = parseDbDate(adminSession.expires_at);
      const lastActivity = parseDbDate(adminSession.last_activity_at);

      // Check max duration (8 hours)
      if (now > expiresAt) {
        db.prepare('UPDATE admin_sessions SET is_revoked = 1 WHERE id = ?').run(candidateAdminToken);
        return res.status(401).json({
          success: false,
          code: 'ADMIN_SESSION_EXPIRED_MAX',
          error: 'Admin session expired (maximum 8 hours reached).'
        });
      }

      // Check inactivity timeout (30 minutes)
      const inactivityMinutes = (now.getTime() - lastActivity.getTime()) / (1000 * 60);
      if (inactivityMinutes > config.ADMIN_SESSION_INACTIVITY_MINUTES) {
        db.prepare('UPDATE admin_sessions SET is_revoked = 1 WHERE id = ?').run(candidateAdminToken);
        return res.status(401).json({
          success: false,
          code: 'ADMIN_SESSION_EXPIRED_INACTIVITY',
          error: 'Admin session timed out due to 30 minutes of inactivity.'
        });
      }

      // Fetch admin account and permissions
      const admin = db.prepare(`
        SELECT a.id, a.full_name, a.username, a.email, a.mobile_number, 
               a.role_id, a.must_change_password, a.is_active, a.is_suspended,
               r.name as role_name
        FROM admin_accounts a
        JOIN admin_roles r ON a.role_id = r.id
        WHERE a.id = ?
      `).get(adminSession.admin_id);

      if (!admin || !admin.is_active || admin.is_suspended) {
        return res.status(403).json({
          success: false,
          code: 'ADMIN_ACCOUNT_INACTIVE',
          error: 'Admin account is inactive or suspended.'
        });
      }

      // Fetch permissions
      const permissions = db.prepare(`
        SELECT permission FROM role_permissions WHERE role_id = ?
      `).all(admin.role_id).map(r => r.permission);

      // Update activity
      db.prepare('UPDATE admin_sessions SET last_activity_at = CURRENT_TIMESTAMP WHERE id = ?').run(candidateAdminToken);

      req.admin = {
        ...admin,
        permissions
      };
      req.adminSession = adminSession;
      return next();
    }
  }

  // 3. Neither session was found in active sessions
  return res.status(401).json({
    success: false,
    code: 'AUTH_REQUIRED',
    error: 'Authentication required to access donor photographs.'
  });
}
