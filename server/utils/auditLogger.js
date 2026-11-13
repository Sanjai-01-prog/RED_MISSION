import crypto from 'node:crypto';
import { getDatabase } from '../database/connection.js';

export function logSecurityAudit({ actorType, actorId, action, details, ipAddress }) {
  try {
    const db = getDatabase();
    const id = `audit_${crypto.randomUUID()}`;
    const stmt = db.prepare(`
      INSERT INTO security_audit_logs (id, actor_type, actor_id, action, details, ip_address)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      id,
      actorType || 'SYSTEM',
      actorId || null,
      action,
      typeof details === 'object' ? JSON.stringify(details) : details || null,
      ipAddress || '127.0.0.1'
    );
  } catch (err) {
    console.error('[AUDIT LOG ERROR]', err);
  }
}

export function logUserActivity({ userId, eventType, description, ipAddress, userAgent, location }) {
  try {
    const db = getDatabase();
    const id = `act_${crypto.randomUUID()}`;
    const stmt = db.prepare(`
      INSERT INTO user_security_activities (id, user_id, event_type, description, ip_address, user_agent, location)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      id,
      userId,
      eventType,
      description,
      ipAddress || '127.0.0.1',
      userAgent || 'Unknown Browser',
      location || 'Mumbai, IN'
    );
  } catch (err) {
    console.error('[USER ACTIVITY LOG ERROR]', err);
  }
}
