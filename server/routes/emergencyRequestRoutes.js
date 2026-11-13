/**
 * RED MISSION — Emergency Blood Request API Routes
 * Stage 2.5: Admin Blood Request Creation, Directory Listing & Status Management
 * Strict zero-dependency native Node.js implementation.
 */

import crypto from 'node:crypto';
import { getDatabase } from '../database/connection.js';
import { authenticateAdmin, authenticateUser, authenticateAny, requirePermission } from '../middleware/authMiddleware.js';
import { logSecurityAudit } from '../utils/auditLogger.js';
import {
  getBulkDonorAvailability,
  getDonorAvailabilityStatus,
  getDonorProfileColumns,
  isBloodGroupCompatible,
  MEDICAL_ELIGIBILITY_DISCLAIMER
} from '../services/donorAvailabilityService.js';

const VALID_BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const VALID_URGENCY_LEVELS = ['CRITICAL', 'URGENT', 'STANDARD'];
const VALID_STATUSES = ['OPEN', 'FULFILLED', 'CANCELLED'];
const ALLOWED_ADMIN_REQUEST_CREATOR_ROLES = ['ADMIN', 'SUPER_ADMIN'];

export function evaluateRequestLifecycleStatus(r, nowMs = Date.now()) {
  const rawStatus = String(r.status || '').toUpperCase();
  const rawApproval = String(r.approval_status || (r.approved_by_admin_id ? 'APPROVED' : 'PENDING')).toUpperCase();
  const reserved = Number(r.units_reserved || 0);
  const fulfilled = Number(r.units_fulfilled || 0);
  const requested = Number(r.units_requested || 0);

  // 1. Cancelled requests preserve cancelled outcome and do not expire
  if (rawStatus === 'CANCELLED') {
    return {
      statusCategory: 'Cancelled',
      mappedStatus: 'Cancelled',
      isExpired: false,
      isFulfilled: false,
      isCancelled: true,
      isPending: false,
      isApproved: false,
      isInProgress: false
    };
  }

  // 2. Successfully fulfilled requests preserve completed outcome and do not expire
  if (rawStatus === 'FULFILLED' || (requested > 0 && fulfilled >= requested)) {
    return {
      statusCategory: 'Successfully Completed',
      mappedStatus: 'Successfully Completed',
      isExpired: false,
      isFulfilled: true,
      isCancelled: false,
      isPending: false,
      isApproved: false,
      isInProgress: false
    };
  }

  // 3. Evaluate past-deadline expiration for active (non-completed, non-cancelled) requests
  let isExpired = false;
  if (rawStatus === 'EXPIRED') {
    isExpired = true;
  } else if (r.required_by) {
    const deadlineMs = new Date(r.required_by).getTime();
    if (!isNaN(deadlineMs) && deadlineMs < nowMs) {
      isExpired = true;
    }
  }

  if (isExpired) {
    return {
      statusCategory: 'Expired',
      mappedStatus: 'Expired',
      isExpired: true,
      isFulfilled: false,
      isCancelled: false,
      isPending: false,
      isApproved: false,
      isInProgress: false
    };
  }

  // 4. Admin Rejection
  if (rawApproval === 'REJECTED') {
    return {
      statusCategory: 'Rejected',
      mappedStatus: 'Rejected',
      isExpired: false,
      isFulfilled: false,
      isCancelled: false,
      isPending: false,
      isApproved: false,
      isInProgress: false
    };
  }

  // 5. Pending Administrative Review
  if (rawApproval === 'PENDING') {
    return {
      statusCategory: 'Pending Request',
      mappedStatus: 'Pending Request',
      isExpired: false,
      isFulfilled: false,
      isCancelled: false,
      isPending: true,
      isApproved: false,
      isInProgress: false
    };
  }

  // 6. Genuine Admin Approval
  if (rawApproval === 'APPROVED') {
    const hasPledges = reserved > 0 || (r.pledges_count && r.pledges_count > 0);
    const isPartiallyFulfilled = fulfilled > 0 && fulfilled < requested;
    if (hasPledges || isPartiallyFulfilled) {
      return {
        statusCategory: 'In Progress',
        mappedStatus: 'In Progress',
        isExpired: false,
        isFulfilled: false,
        isCancelled: false,
        isPending: false,
        isApproved: true,
        isInProgress: true
      };
    }

    return {
      statusCategory: 'Approved',
      mappedStatus: 'Approved',
      isExpired: false,
      isFulfilled: false,
      isCancelled: false,
      isPending: false,
      isApproved: true,
      isInProgress: false
    };
  }

  return {
    statusCategory: 'Pending Request',
    mappedStatus: 'Pending Request',
    isExpired: false,
    isFulfilled: false,
    isCancelled: false,
    isPending: true,
    isApproved: false,
    isInProgress: false
  };
}

export function formatEnrichedRequest(r, nowMs = Date.now()) {
  if (!r) return null;
  const lifecycle = evaluateRequestLifecycleStatus(r, nowMs);
  const unitsRequested = Number(r.units_requested || 0);
  const unitsReserved = Number(r.units_reserved || 0);
  const unitsFulfilled = Number(r.units_fulfilled || 0);
  const unitsRemaining = Math.max(0, unitsRequested - unitsReserved - unitsFulfilled);

  return {
    ...r,
    approval_status: r.approval_status || (r.approved_by_admin_id ? 'APPROVED' : 'PENDING'),
    lifecycle_status: lifecycle.mappedStatus,
    mapped_status: lifecycle.mappedStatus,
    status_category: lifecycle.statusCategory,
    is_expired: lifecycle.isExpired,
    is_fulfilled: lifecycle.isFulfilled,
    is_cancelled: lifecycle.isCancelled,
    is_pending: lifecycle.isPending,
    is_approved: lifecycle.isApproved,
    is_in_progress: lifecycle.isInProgress,
    units_remaining: unitsRemaining
  };
}

function buildSafeRequestSelectColumns() {
  return `
    er.id, er.created_by_admin_id, er.requester_user_id,
    CASE
      WHEN er.created_by_admin_id IS NOT NULL THEN COALESCE(a.role_id, 'ADMIN')
      WHEN er.requester_user_id IS NOT NULL THEN 'USER'
      ELSE 'SYSTEM'
    END AS created_by_role,
    er.patient_name, er.hospital_name, er.hospital_city, er.hospital_address, er.blood_group,
    er.units_requested, er.units_reserved, er.units_fulfilled,
    er.urgency_level, er.status, er.required_by, er.contact_person, er.contact_phone,
    er.clinical_condition, er.notes, er.created_at, er.updated_at,
    er.approval_status, er.approved_by_admin_id, er.approved_at,
    er.rejected_by_admin_id, er.rejected_at, er.rejection_reason,
    (SELECT COUNT(*) FROM request_pledges rp WHERE rp.request_id = er.id AND rp.status NOT IN ('CANCELLED', 'REJECTED')) AS active_pledges_count,
    (SELECT COUNT(*) FROM request_pledges rp WHERE rp.request_id = er.id) AS pledges_count
  `;
}

/**
 * Unified request validation shared across USER, ADMIN, and SUPER_ADMIN request creation.
 * Never consumes frontend creator IDs, creator roles, statuses, or unit reservation counters.
 */
function validateAndNormalizeCreateRequest(body = {}, defaultUrgency = 'URGENT') {
  const {
    patientName,
    patient_name,
    hospitalName,
    hospital_name,
    hospitalCity,
    hospital_city,
    city,
    hospitalAddress,
    hospital_address,
    bloodGroup,
    blood_group,
    unitsRequested,
    units_requested,
    units,
    urgencyLevel,
    urgency_level,
    urgency,
    requiredBy,
    required_by,
    requiredDate,
    contactPerson,
    contact_person,
    contactPhone,
    contact_phone,
    clinicalCondition,
    clinical_condition,
    notes
  } = body || {};

  const pName = typeof (patientName ?? patient_name) === 'string' ? String(patientName ?? patient_name).trim() : '';
  const hName = typeof (hospitalName ?? hospital_name) === 'string' ? String(hospitalName ?? hospital_name).trim() : '';
  const hCity = typeof (hospitalCity ?? hospital_city ?? city) === 'string' ? String(hospitalCity ?? hospital_city ?? city).trim() : '';
  const hAddr = typeof (hospitalAddress ?? hospital_address) === 'string' ? String(hospitalAddress ?? hospital_address).trim() : '';
  const bGroup = typeof (bloodGroup ?? blood_group) === 'string' ? String(bloodGroup ?? blood_group).trim().toUpperCase() : '';

  const rawUnitsVal = unitsRequested ?? units_requested ?? units;
  const parsedUnits = rawUnitsVal === '' || rawUnitsVal === null || rawUnitsVal === undefined ? NaN : Number(rawUnitsVal);

  const rawUrgencyVal = urgencyLevel ?? urgency_level ?? urgency ?? defaultUrgency;
  const rawUrgency = typeof rawUrgencyVal === 'string' ? rawUrgencyVal.trim().toUpperCase() : defaultUrgency;
  const uLevel = rawUrgency === 'NORMAL' ? 'STANDARD' : rawUrgency;

  const rBy = requiredBy ?? required_by ?? requiredDate;
  const cPerson = typeof (contactPerson ?? contact_person) === 'string' ? String(contactPerson ?? contact_person).trim() : '';
  const cPhone = typeof (contactPhone ?? contact_phone) === 'string' ? String(contactPhone ?? contact_phone).trim() : '';
  const cCondition = typeof (clinicalCondition ?? clinical_condition) === 'string' ? String(clinicalCondition ?? clinical_condition).trim() : '';
  const cNotes = typeof notes === 'string' ? notes.trim() : '';

  if (!pName || pName.length > 120) {
    return { valid: false, error: 'Enter a valid patient name (maximum 120 characters).' };
  }
  if (!hName || hName.length > 180) {
    return { valid: false, error: 'Enter a valid hospital name (maximum 180 characters).' };
  }
  if (!hCity || hCity.length > 100) {
    return { valid: false, error: 'Enter a valid hospital city.' };
  }
  if (!hAddr || hAddr.length > 300) {
    return { valid: false, error: 'Enter a valid hospital address.' };
  }
  if (!VALID_BLOOD_GROUPS.includes(bGroup)) {
    return { valid: false, error: 'Select a valid blood group.' };
  }
  if (!Number.isInteger(parsedUnits) || parsedUnits < 1 || parsedUnits > 10) {
    return { valid: false, error: 'Units requested must be a whole number between 1 and 10.' };
  }
  if (!VALID_URGENCY_LEVELS.includes(uLevel)) {
    return { valid: false, error: 'Select a valid urgency level (CRITICAL, URGENT, or STANDARD).' };
  }
  const requiredByMs = rBy ? new Date(rBy).getTime() : NaN;
  if (!rBy || isNaN(requiredByMs) || requiredByMs <= Date.now()) {
    return { valid: false, error: 'Required-by date must be a valid future date and time.' };
  }
  if (!cPerson || cPerson.length > 120) {
    return { valid: false, error: 'Enter a valid contact person name.' };
  }
  if (!/^[+]?[\d\s()-]{7,20}$/.test(cPhone) || cPhone.replace(/\D/g, '').length < 10) {
    return { valid: false, error: 'Enter a valid contact phone number.' };
  }
  if (cCondition.length > 500 || cNotes.length > 1000) {
    return { valid: false, error: 'Clinical condition or notes exceed the allowed length.' };
  }

  return {
    valid: true,
    data: {
      pName,
      hName,
      hCity,
      hAddr,
      bGroup,
      uRequested: parsedUnits,
      uLevel,
      requiredByIso: new Date(requiredByMs).toISOString(),
      cPerson,
      cPhone,
      cCondition,
      cNotes
    }
  };
}

function createEmergencyBloodRequestRecord(db, {
  actorType,
  actorId,
  creatorRole,
  validated,
  clientIp,
  auditFn
}) {
  const isAdminActor = actorType === 'ADMIN';
  const creatorColumn = isAdminActor ? 'created_by_admin_id' : 'requester_user_id';
  const requestId = `REQ-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

  db.exec('BEGIN IMMEDIATE;');
  try {
    const duplicateRow = db.prepare(`
      SELECT id FROM emergency_requests
      WHERE ${creatorColumn} = ?
        AND status = 'OPEN'
        AND LOWER(patient_name) = LOWER(?)
        AND LOWER(hospital_name) = LOWER(?)
        AND LOWER(hospital_city) = LOWER(?)
        AND blood_group = ?
        AND created_at >= datetime('now', '-60 seconds')
      LIMIT 1
    `).get(actorId, validated.pName, validated.hName, validated.hCity, validated.bGroup);

    if (duplicateRow) {
      db.exec('ROLLBACK;');
      return { duplicate: true, existingId: duplicateRow.id };
    }

    db.prepare(`
      INSERT INTO emergency_requests (
        id, ${creatorColumn}, patient_name, hospital_name, hospital_city,
        hospital_address, blood_group, units_requested, units_reserved,
        units_fulfilled, urgency_level, status, required_by, contact_person,
        contact_phone, clinical_condition, notes,
        approval_status, approved_by_admin_id, approved_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, 'OPEN', ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      requestId,
      actorId,
      validated.pName,
      validated.hName,
      validated.hCity,
      validated.hAddr,
      validated.bGroup,
      validated.uRequested,
      validated.uLevel,
      validated.requiredByIso,
      validated.cPerson,
      validated.cPhone,
      validated.cCondition || null,
      validated.cNotes || null,
      isAdminActor ? 'APPROVED' : 'PENDING',
      isAdminActor ? actorId : null,
      isAdminActor ? new Date().toISOString() : null
    );

    db.exec('COMMIT;');
  } catch (err) {
    try { db.exec('ROLLBACK;'); } catch {}
    throw err;
  }

  auditFn({
    actorType: isAdminActor ? 'ADMIN' : 'USER',
    actorId,
    action: isAdminActor ? 'ADMIN_CREATE_BLOOD_REQUEST' : 'USER_CREATE_BLOOD_REQUEST',
    details: isAdminActor
      ? `[Role: ${creatorRole}] Published blood request ${requestId} for ${validated.uRequested} unit(s) of ${validated.bGroup} at ${validated.hName}, ${validated.hCity}. Urgency: ${validated.uLevel}.`
      : `User created blood request ${requestId} for ${validated.uRequested} unit(s) of ${validated.bGroup} at ${validated.hName}, ${validated.hCity}. Urgency: ${validated.uLevel}.`,
    ipAddress: clientIp
  });

  const created = db.prepare(`
    SELECT ${buildSafeRequestSelectColumns()}
    FROM emergency_requests er
    LEFT JOIN admin_accounts a ON er.created_by_admin_id = a.id
    WHERE er.id = ?
  `).get(requestId);

  const enriched = formatEnrichedRequest(created);

  return {
    duplicate: false,
    request: {
      ...enriched,
      created_by_role: created?.created_by_role || creatorRole
    }
  };
}

export function setupEmergencyRequestRoutes(app, deps = {}) {
  const getDb = deps.getDatabase || getDatabase;
  const authAdmin = deps.authenticateAdmin || authenticateAdmin;
  const authUser = deps.authenticateUser || authenticateUser;
  const authAny = deps.authenticateAny || authenticateAny;
  const reqPermission = deps.requirePermission || requirePermission;
  const auditFn = deps.logSecurityAudit || logSecurityAudit;

  // ==========================================
  // 1. PUBLIC / USER: GET ACTIVE BLOOD REQUESTS
  // ==========================================
  app.get('/api/requests', (req, res) => {
    try {
      const db = getDb();
      const { status = 'OPEN', bloodGroup, city, urgency, approvalStatus } = req.query;

      let query = `
        SELECT ${buildSafeRequestSelectColumns()}
        FROM emergency_requests er
        LEFT JOIN admin_accounts a ON er.created_by_admin_id = a.id
        WHERE 1=1
      `;
      const params = [];

      if (bloodGroup && VALID_BLOOD_GROUPS.includes(bloodGroup.trim())) {
        query += ' AND er.blood_group = ?';
        params.push(bloodGroup.trim());
      }

      if (city && city.trim()) {
        query += ' AND LOWER(er.hospital_city) LIKE ?';
        params.push(`%${city.trim().toLowerCase()}%`);
      }

      if (urgency) {
        const normalizedUrgency = urgency.trim().toUpperCase() === 'NORMAL' ? 'STANDARD' : urgency.trim().toUpperCase();
        if (VALID_URGENCY_LEVELS.includes(normalizedUrgency)) {
          query += ' AND er.urgency_level = ?';
          params.push(normalizedUrgency);
        }
      }

      // Order by urgency (CRITICAL first, then URGENT, then STANDARD) and created_at DESC
      query += `
        ORDER BY 
          CASE er.urgency_level
            WHEN 'CRITICAL' THEN 1
            WHEN 'URGENT' THEN 2
            WHEN 'STANDARD' THEN 3
            ELSE 4
          END,
          er.created_at DESC
      `;

      const rows = db.prepare(query).all(...params);
      const allEnriched = rows.map(r => formatEnrichedRequest(r));

      let requests = allEnriched;
      const statusParam = String(status || '').toUpperCase();
      const approvalParam = String(approvalStatus || '').toUpperCase();

      if (statusParam === 'ALL') {
        requests = allEnriched;
      } else if (statusParam === 'PENDING' || approvalParam === 'PENDING') {
        requests = allEnriched.filter(r => r.approval_status === 'PENDING');
      } else if (statusParam === 'EXPIRED') {
        requests = allEnriched.filter(r => r.is_expired);
      } else if (statusParam === 'FULFILLED') {
        requests = allEnriched.filter(r => r.is_fulfilled);
      } else if (statusParam === 'CANCELLED') {
        requests = allEnriched.filter(r => r.is_cancelled);
      } else {
        // Default: Active public requests must be verified APPROVED and NOT expired
        requests = allEnriched.filter(r => r.approval_status === 'APPROVED' && !r.is_expired && r.status === 'OPEN');
      }

      return res.status(200).json({
        success: true,
        count: requests.length,
        requests
      });
    } catch (err) {
      console.error('[EMERGENCY REQUESTS GET ERROR]', err);
      return res.status(500).json({
        success: false,
        error: 'Failed to retrieve emergency blood requests.'
      });
    }
  });

  // ==========================================
  // 2. GET SINGLE BLOOD REQUEST DETAILS
  // ==========================================
  app.get('/api/requests/:id', (req, res) => {
    try {
      const db = getDb();
      const requestId = req.params.id;

      const r = db.prepare(`
        SELECT ${buildSafeRequestSelectColumns()}
        FROM emergency_requests er
        LEFT JOIN admin_accounts a ON er.created_by_admin_id = a.id
        WHERE er.id = ?
      `).get(requestId);

      if (!r) {
        return res.status(404).json({
          success: false,
          code: 'REQUEST_NOT_FOUND',
          error: `Emergency blood request [${requestId}] was not found.`
        });
      }

      const request = formatEnrichedRequest(r);

      return res.status(200).json({
        success: true,
        request
      });
    } catch (err) {
      console.error('[EMERGENCY REQUEST DETAILS ERROR]', err);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch request details.'
      });
    }
  });

  // ==========================================
  // 2B. CITIZEN: CREATE BLOOD REQUEST
  // ==========================================
  app.post('/api/user/requests', authUser, (req, res) => {
    try {
      const db = getDb();
      const userId = req.user.id;
      const clientIp = req.ip || req.socket.remoteAddress || '127.0.0.1';

      const parsed = validateAndNormalizeCreateRequest(req.body, 'URGENT');
      if (!parsed.valid) {
        return res.status(400).json({ success: false, error: parsed.error });
      }

      const result = createEmergencyBloodRequestRecord(db, {
        actorType: 'USER',
        actorId: userId,
        creatorRole: 'USER',
        validated: parsed.data,
        clientIp,
        auditFn
      });

      if (result.duplicate) {
        return res.status(409).json({
          success: false,
          code: 'DUPLICATE_REQUEST',
          existingRequestId: result.existingId,
          error: 'A matching open blood request was just submitted. Please refresh instead of submitting twice.'
        });
      }

      return res.status(201).json({
        success: true,
        message: 'Blood request submitted successfully.',
        request: result.request
      });
    } catch (err) {
      console.error('[USER CREATE REQUEST ERROR]', err);
      return res.status(500).json({
        success: false,
        error: 'Failed to submit blood request.'
      });
    }
  });

  // ==========================================
  // 2C. CITIZEN: GET MY BLOOD REQUESTS
  // ==========================================
  app.get('/api/user/my-requests', authUser, (req, res) => {
    try {
      const db = getDb();
      const userId = req.user.id;

      const rows = db.prepare(`
        SELECT 
          er.id, er.requester_user_id, er.patient_name, er.hospital_name,
          er.hospital_city, er.hospital_address, er.blood_group,
          er.units_requested, er.units_reserved, er.units_fulfilled,
          er.urgency_level, er.status, er.required_by, er.contact_person,
          er.contact_phone, er.clinical_condition, er.notes,
          er.created_at, er.updated_at,
          er.approval_status, er.approved_by_admin_id, er.approved_at,
          er.rejected_by_admin_id, er.rejected_at, er.rejection_reason,
          (SELECT COUNT(*) FROM request_pledges rp WHERE rp.request_id = er.id) AS pledges_count
        FROM emergency_requests er
        WHERE er.requester_user_id = ?
        ORDER BY er.created_at DESC
      `).all(userId);

      const requests = rows.map(r => formatEnrichedRequest(r));

      const counts = {
        all: requests.length,
        pending: requests.filter(r => r.mapped_status === 'Pending Request').length,
        approved: requests.filter(r => r.mapped_status === 'Approved').length,
        inProgress: requests.filter(r => r.mapped_status === 'In Progress').length,
        completed: requests.filter(r => r.mapped_status === 'Successfully Completed').length,
        rejected: requests.filter(r => r.mapped_status === 'Rejected').length,
        cancelled: requests.filter(r => r.mapped_status === 'Cancelled').length,
        expired: requests.filter(r => r.mapped_status === 'Expired').length
      };

      return res.status(200).json({
        success: true,
        count: requests.length,
        requests,
        counts
      });
    } catch (err) {
      console.error('[USER GET MY REQUESTS ERROR]', err);
      return res.status(500).json({
        success: false,
        error: 'Failed to retrieve your blood requests.'
      });
    }
  });

  // Cancel My Request
  app.post('/api/user/my-requests/:id/cancel', authUser, (req, res) => {
    try {
      const db = getDb();
      const userId = req.user.id;
      const requestId = req.params.id;
      const clientIp = req.ip || req.socket.remoteAddress || '127.0.0.1';

      const existing = db.prepare(`
        SELECT * FROM emergency_requests 
        WHERE id = ? AND requester_user_id = ?
      `).get(requestId, userId);

      if (!existing) {
        return res.status(404).json({
          success: false,
          error: 'Blood request not found or you are not authorized to cancel it.'
        });
      }

      if (existing.status === 'CANCELLED') {
        return res.status(400).json({
          success: false,
          error: 'This blood request is already cancelled.'
        });
      }

      if (existing.status === 'FULFILLED') {
        return res.status(400).json({
          success: false,
          error: 'Completed requests cannot be cancelled.'
        });
      }

      const lifecycle = evaluateRequestLifecycleStatus(existing);
      if (lifecycle.isExpired) {
        return res.status(400).json({
          success: false,
          error: 'This blood request has expired and cannot be cancelled.'
        });
      }

      db.prepare(`
        UPDATE emergency_requests 
        SET status = 'CANCELLED', units_reserved = 0, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(requestId);

      // Cancel any active pledges on this request
      db.prepare(`
        UPDATE request_pledges 
        SET status = 'CANCELLED' 
        WHERE request_id = ? AND status IN ('PLEDGED', 'PROOF_PENDING', 'UNDER_REVIEW')
      `).run(requestId);

      auditFn({
        actorType: 'USER',
        actorId: userId,
        action: 'USER_CANCEL_BLOOD_REQUEST',
        details: `User cancelled their blood request ${requestId}.`,
        ipAddress: clientIp
      });

      return res.status(200).json({
        success: true,
        message: 'Blood request cancelled successfully.'
      });
    } catch (err) {
      console.error('[USER CANCEL REQUEST ERROR]', err);
      return res.status(500).json({
        success: false,
        error: 'Failed to cancel blood request.'
      });
    }
  });

  // ==========================================
  // 3. ADMIN & SUPER ADMIN: CREATE AND PUBLISH BLOOD REQUEST
  // ==========================================
  app.post('/api/requests', authAdmin, reqPermission('MANAGE_REQUESTS'), (req, res) => {
    try {
      const db = getDb();
      const adminId = req.admin.id;
      const adminRole = String(req.admin.role_id || req.admin.roleId || '').toUpperCase();
      const clientIp = req.ip || req.socket.remoteAddress || '127.0.0.1';

      if (!ALLOWED_ADMIN_REQUEST_CREATOR_ROLES.includes(adminRole)) {
        return res.status(403).json({
          success: false,
          code: 'FORBIDDEN_INSUFFICIENT_PERMISSIONS',
          error: 'Only authorized ADMIN or SUPER_ADMIN accounts are permitted to create blood requests.'
        });
      }

      const parsed = validateAndNormalizeCreateRequest(req.body, 'URGENT');
      if (!parsed.valid) {
        return res.status(400).json({ success: false, error: parsed.error });
      }

      const result = createEmergencyBloodRequestRecord(db, {
        actorType: 'ADMIN',
        actorId: adminId,
        creatorRole: adminRole,
        validated: parsed.data,
        clientIp,
        auditFn
      });

      if (result.duplicate) {
        return res.status(409).json({
          success: false,
          code: 'DUPLICATE_REQUEST',
          existingRequestId: result.existingId,
          error: 'A matching open blood request was just submitted. Please refresh rather than submitting twice.'
        });
      }

      return res.status(201).json({
        success: true,
        message: 'Emergency blood request created and published successfully.',
        request: result.request
      });
    } catch (err) {
      console.error('[ADMIN CREATE REQUEST ERROR]', err);
      return res.status(500).json({
        success: false,
        error: 'Failed to create emergency blood request.'
      });
    }
  });

  // ==========================================
  // 4. ADMIN & SUPER ADMIN: UPDATE BLOOD REQUEST STATUS
  // ==========================================
  app.patch('/api/requests/:id/status', authAdmin, reqPermission('MANAGE_REQUESTS'), (req, res) => {
    try {
      const db = getDb();
      const adminId = req.admin.id;
      const requestId = req.params.id;
      const clientIp = req.ip || req.socket.remoteAddress || '127.0.0.1';
      const { status } = req.body;

      if (!status || !VALID_STATUSES.includes(status.toUpperCase())) {
        return res.status(400).json({
          success: false,
          error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}`
        });
      }

      const current = db.prepare('SELECT * FROM emergency_requests WHERE id = ?').get(requestId);
      if (!current) {
        return res.status(404).json({
          success: false,
          error: `Emergency request [${requestId}] was not found.`
        });
      }

      const newStatus = status.toUpperCase();
      db.prepare(`
        UPDATE emergency_requests 
        SET status = ?, updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?
      `).run(newStatus, requestId);

      auditFn({
        actorType: 'ADMIN',
        actorId: adminId,
        action: 'ADMIN_UPDATE_REQUEST_STATUS',
        details: `Updated request ${requestId} status from ${current.status} to ${newStatus}.`,
        ipAddress: clientIp
      });

      const updated = db.prepare(`
        SELECT ${buildSafeRequestSelectColumns()}
        FROM emergency_requests er
        LEFT JOIN admin_accounts a ON er.created_by_admin_id = a.id
        WHERE er.id = ?
      `).get(requestId);

      return res.status(200).json({
        success: true,
        message: `Request status updated to ${newStatus}.`,
        request: formatEnrichedRequest(updated)
      });
    } catch (err) {
      console.error('[ADMIN UPDATE REQUEST STATUS ERROR]', err);
      return res.status(500).json({
        success: false,
        error: 'Failed to update request status.'
      });
    }
  });

  // ==========================================
  // 4B. ADMIN & SUPER ADMIN: APPROVE BLOOD REQUEST
  // ==========================================
  app.post('/api/requests/:id/approve', authAdmin, reqPermission('MANAGE_REQUESTS'), (req, res) => {
    try {
      const db = getDb();
      const adminId = req.admin.id;
      const adminRole = String(req.admin.role_id || req.admin.roleId || '').toUpperCase();
      const requestId = req.params.id;
      const clientIp = req.ip || req.socket.remoteAddress || '127.0.0.1';

      if (!ALLOWED_ADMIN_REQUEST_CREATOR_ROLES.includes(adminRole)) {
        return res.status(403).json({
          success: false,
          code: 'FORBIDDEN_INSUFFICIENT_PERMISSIONS',
          error: 'Only authorized ADMIN or SUPER_ADMIN accounts are permitted to approve blood requests.'
        });
      }

      const current = db.prepare('SELECT * FROM emergency_requests WHERE id = ?').get(requestId);
      if (!current) {
        return res.status(404).json({
          success: false,
          error: `Emergency request [${requestId}] was not found.`
        });
      }

      const lifecycle = evaluateRequestLifecycleStatus(current);
      if (lifecycle.isCancelled) {
        return res.status(400).json({
          success: false,
          error: 'Cannot approve a cancelled blood request.'
        });
      }
      if (lifecycle.isFulfilled) {
        return res.status(400).json({
          success: false,
          error: 'Blood request is already completed.'
        });
      }
      if (lifecycle.isExpired) {
        return res.status(400).json({
          success: false,
          error: 'Cannot approve an expired blood request. The required-by deadline has passed.'
        });
      }

      db.prepare(`
        UPDATE emergency_requests
        SET approval_status = 'APPROVED',
            approved_by_admin_id = ?,
            approved_at = CURRENT_TIMESTAMP,
            rejected_by_admin_id = NULL,
            rejected_at = NULL,
            rejection_reason = NULL,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(adminId, requestId);

      auditFn({
        actorType: 'ADMIN',
        actorId: adminId,
        action: 'ADMIN_APPROVE_BLOOD_REQUEST',
        details: `[Role: ${adminRole}] Approved emergency blood request ${requestId} for patient ${current.patient_name} (${current.blood_group}, ${current.units_requested} unit(s) at ${current.hospital_name}).`,
        ipAddress: clientIp
      });

      const updatedRow = db.prepare(`
        SELECT ${buildSafeRequestSelectColumns()}
        FROM emergency_requests er
        LEFT JOIN admin_accounts a ON er.created_by_admin_id = a.id
        WHERE er.id = ?
      `).get(requestId);

      return res.status(200).json({
        success: true,
        message: `Blood request ${requestId} approved successfully.`,
        request: formatEnrichedRequest(updatedRow)
      });
    } catch (err) {
      console.error('[ADMIN APPROVE REQUEST ERROR]', err);
      return res.status(500).json({
        success: false,
        error: 'Failed to approve blood request.'
      });
    }
  });

  // ==========================================
  // 4C. ADMIN & SUPER ADMIN: REJECT BLOOD REQUEST
  // ==========================================
  app.post('/api/requests/:id/reject', authAdmin, reqPermission('MANAGE_REQUESTS'), (req, res) => {
    try {
      const db = getDb();
      const adminId = req.admin.id;
      const adminRole = String(req.admin.role_id || req.admin.roleId || '').toUpperCase();
      const requestId = req.params.id;
      const clientIp = req.ip || req.socket.remoteAddress || '127.0.0.1';
      const { reason, rejectionReason } = req.body || {};
      const finalReason = String(rejectionReason || reason || 'Declined during administrative verification.').trim();

      if (!ALLOWED_ADMIN_REQUEST_CREATOR_ROLES.includes(adminRole)) {
        return res.status(403).json({
          success: false,
          code: 'FORBIDDEN_INSUFFICIENT_PERMISSIONS',
          error: 'Only authorized ADMIN or SUPER_ADMIN accounts are permitted to reject blood requests.'
        });
      }

      const current = db.prepare('SELECT * FROM emergency_requests WHERE id = ?').get(requestId);
      if (!current) {
        return res.status(404).json({
          success: false,
          error: `Emergency request [${requestId}] was not found.`
        });
      }

      if (current.status === 'FULFILLED') {
        return res.status(400).json({
          success: false,
          error: 'Cannot reject a completed blood request.'
        });
      }
      if (current.status === 'CANCELLED') {
        return res.status(400).json({
          success: false,
          error: 'Cannot reject an already cancelled blood request.'
        });
      }

      db.exec('BEGIN IMMEDIATE;');
      try {
        db.prepare(`
          UPDATE emergency_requests
          SET approval_status = 'REJECTED',
              rejected_by_admin_id = ?,
              rejected_at = CURRENT_TIMESTAMP,
              rejection_reason = ?,
              units_reserved = 0,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(adminId, finalReason, requestId);

        // Cancel any active pledges attached to this rejected request
        db.prepare(`
          UPDATE request_pledges
          SET status = 'CANCELLED', updated_at = CURRENT_TIMESTAMP
          WHERE request_id = ? AND status IN ('PLEDGED', 'PROOF_PENDING', 'UNDER_REVIEW')
        `).run(requestId);

        db.exec('COMMIT;');
      } catch (e) {
        try { db.exec('ROLLBACK;'); } catch {}
        throw e;
      }

      auditFn({
        actorType: 'ADMIN',
        actorId: adminId,
        action: 'ADMIN_REJECT_BLOOD_REQUEST',
        details: `[Role: ${adminRole}] Rejected blood request ${requestId} for patient ${current.patient_name}. Reason: ${finalReason}`,
        ipAddress: clientIp
      });

      const updatedRow = db.prepare(`
        SELECT ${buildSafeRequestSelectColumns()}
        FROM emergency_requests er
        LEFT JOIN admin_accounts a ON er.created_by_admin_id = a.id
        WHERE er.id = ?
      `).get(requestId);

      return res.status(200).json({
        success: true,
        message: `Blood request ${requestId} has been rejected.`,
        request: formatEnrichedRequest(updatedRow)
      });
    } catch (err) {
      console.error('[ADMIN REJECT REQUEST ERROR]', err);
      return res.status(500).json({
        success: false,
        error: 'Failed to reject blood request.'
      });
    }
  });

  function formatSafeDisplayName(fullName) {
    if (!fullName || typeof fullName !== 'string') return 'Anonymous Donor';
    const parts = fullName.trim().split(/\s+/);
    if (parts.length === 1) return parts[0];
    return `${parts[0]} ${parts[parts.length - 1].charAt(0).toUpperCase()}.`;
  }

  // ==========================================
  // 5. COMPATIBLE DONOR MATCHING & SUGGESTIONS
  // ==========================================
  app.get('/api/requests/:id/matching-donors', authenticateAny, (req, res) => {
    try {
      const db = getDatabase();
      const requestId = req.params.id;
      const isAdmin = Boolean(req.admin);

      if (isAdmin) {
        const perms = req.admin?.permissions || [];
        const allowed =
          req.admin?.role_id === 'SUPER_ADMIN' ||
          req.admin?.role_name === 'SUPER_ADMIN' ||
          perms.includes('FULL_ADMINISTRATION') ||
          perms.includes('MANAGE_REQUESTS') ||
          perms.includes('MONITOR_REQUESTS') ||
          perms.includes('VERIFY_PROOFS');
        if (!allowed) {
          return res.status(403).json({
            success: false,
            code: 'PERMISSION_DENIED',
            error: 'Administrative permissions required to inspect matching donors.'
          });
        }
      }

      const requestRow = db.prepare('SELECT * FROM emergency_requests WHERE id = ?').get(requestId);
      if (!requestRow) {
        return res.status(404).json({
          success: false,
          code: 'REQUEST_NOT_FOUND',
          error: `Emergency request [${requestId}] was not found.`
        });
      }

      const tableCols = getDonorProfileColumns(db);
      const hasPublicRefCol = tableCols.includes('public_reference');
      const hasConsentCol = tableCols.includes('consent_directory_listing');

      if (!isAdmin && (!hasConsentCol || !hasPublicRefCol)) {
        return res.status(200).json({
          success: true,
          requestId,
          requestedBloodGroup: requestRow.blood_group,
          hospitalCity: requestRow.hospital_city,
          medicalDisclaimer: MEDICAL_ELIGIBILITY_DISCLAIMER,
          donors: [],
          totalCount: 0,
          eligibleCount: 0,
          cooldownCount: 0
        });
      }

      const { city } = req.query;
      const eligibleOnly = req.query.eligibleOnly === 'true' || req.query.eligibleOnly === '1';

      const whereClauses = isAdmin
        ? ['1=1']
        : ['u.is_active = 1', 'u.is_suspended = 0', 'd.consent_directory_listing = 1', 'd.is_available_for_emergency = 1'];
      const params = [];

      if (city && city !== 'All' && city !== 'ALL' && city.trim()) {
        whereClauses.push('LOWER(d.city) LIKE ?');
        params.push(`%${city.trim().toLowerCase()}%`);
      }

      const rows = db.prepare(`
        SELECT
          d.user_id,
          ${hasPublicRefCol ? 'd.public_reference' : 'NULL AS public_reference'},
          ${hasConsentCol ? 'd.consent_directory_listing' : '0 AS consent_directory_listing'},
          d.blood_group,
          d.city,
          d.total_donations_count,
          d.last_donation_date,
          d.is_available_for_emergency,
          u.full_name,
          u.age,
          u.is_active,
          u.is_suspended
        FROM donor_profiles d
        JOIN users u ON d.user_id = u.id
        WHERE ${whereClauses.join(' AND ')}
      `).all(...params);

      const compatibleRows = rows.filter((r) => isBloodGroupCompatible(r.blood_group, requestRow.blood_group));
      const availabilityMap = getBulkDonorAvailability(db, compatibleRows);

      const unitsRemaining = Math.max(
        0,
        (requestRow.units_requested || 0) - (requestRow.units_reserved || 0) - (requestRow.units_fulfilled || 0)
      );
      const requestAcceptingDonors = requestRow.status === 'OPEN' && unitsRemaining > 0;

      // Active pledges on this request to flag donors already pledged
      const existingPledges = new Set(
        db
          .prepare(`
            SELECT donor_user_id FROM request_pledges
            WHERE request_id = ? AND status IN ('PLEDGED', 'PROOF_PENDING', 'UNDER_REVIEW')
          `)
          .all(requestId)
          .map((p) => p.donor_user_id)
      );

      const targetCity = String(requestRow.hospital_city || '').trim().toLowerCase();

      const mapped = compatibleRows
        .map((r) => {
          const av = availabilityMap.get(r.user_id);
          const alreadyPledged = existingPledges.has(r.user_id);
          const isExactBloodMatch = String(r.blood_group || '').toUpperCase() === String(requestRow.blood_group || '').toUpperCase();
          const isCityMatch = Boolean(targetCity && String(r.city || '').trim().toLowerCase() === targetCity);
          const selectable = Boolean(
            requestAcceptingDonors &&
            !alreadyPledged &&
            av &&
            av.isEligibleForEmergencySelection
          );

          const baseDonor = {
            publicReference: r.public_reference || null,
            displayName: formatSafeDisplayName(r.full_name),
            bloodGroup: r.blood_group,
            city: r.city,
            totalDonationsCount: r.total_donations_count || 0,
            exactBloodMatch: isExactBloodMatch,
            cityMatch: isCityMatch,
            alreadyPledged,
            selectable,
            isAvailable: Boolean(av && av.isAvailable),
            availabilityStatus: av ? av.status : 'UNAVAILABLE',
            availabilityLabel: av ? av.label : 'Unavailable',
            isInCooldown: Boolean(av && av.isInCooldown),
            cooldownReason: av && av.isInCooldown ? av.reason : null,
            reavailableDate: av ? av.reavailableDate : null,
            daysRemaining: av ? av.daysRemaining : 0,
            lastVerifiedDonationDate: av ? av.lastVerifiedDonationDate : null,
            isEligibleForEmergencySelection: Boolean(av && av.isEligibleForEmergencySelection),
            medicalDisclaimer: av ? av.medicalDisclaimer : MEDICAL_ELIGIBILITY_DISCLAIMER,
            availability: av || null
          };

          if (isAdmin) {
            return {
              ...baseDonor,
              id: r.user_id,
              userId: r.user_id,
              fullName: r.full_name
            };
          }

          return {
            ...baseDonor,
            id: r.public_reference
          };
        })
        .filter((d) => (!eligibleOnly ? true : d.isAvailable && d.selectable))
        .sort((a, b) => {
          if (a.selectable !== b.selectable) return a.selectable ? -1 : 1;
          if (a.isInCooldown !== b.isInCooldown) return a.isInCooldown ? 1 : -1;
          if (a.cityMatch !== b.cityMatch) return a.cityMatch ? -1 : 1;
          if (a.exactBloodMatch !== b.exactBloodMatch) return a.exactBloodMatch ? -1 : 1;
          return (b.totalDonationsCount || 0) - (a.totalDonationsCount || 0);
        });

      const eligibleCount = mapped.filter((d) => d.isEligibleForEmergencySelection && !d.alreadyPledged).length;
      const cooldownCount = mapped.filter((d) => d.isInCooldown).length;

      return res.status(200).json({
        success: true,
        requestId,
        requestStatus: requestRow.status,
        unitsRemaining,
        requestedBloodGroup: requestRow.blood_group,
        hospitalCity: requestRow.hospital_city,
        medicalDisclaimer: MEDICAL_ELIGIBILITY_DISCLAIMER,
        totalCount: mapped.length,
        eligibleCount,
        cooldownCount,
        donors: mapped
      });
    } catch (err) {
      console.error('[MATCHING DONORS ERROR]', err);
      return res.status(500).json({
        success: false,
        error: 'Failed to evaluate compatible emergency donors.'
      });
    }
  });

  // ==========================================
  // 6. SELECT / DISPATCH COMPATIBLE DONOR (ENFORCES COOLDOWN)
  // ==========================================
  app.post('/api/requests/:id/select-donor', authenticateAny, (req, res) => {
    const db = getDatabase();
    const requestId = req.params.id;
    const isAdmin = Boolean(req.admin);
    const clientIp = req.ip || req.socket.remoteAddress || '127.0.0.1';
    const rawTarget = req.body?.donorUserId || req.body?.donorPublicReference || req.body?.donorId;

    if (!rawTarget || typeof rawTarget !== 'string' || !rawTarget.trim()) {
      return res.status(400).json({
        success: false,
        code: 'DONOR_IDENTIFIER_REQUIRED',
        error: 'A target donor identifier (donorUserId or donorPublicReference) is required.'
      });
    }

    const donorLookup = rawTarget.trim();

    try {
      const preCheckRequest = db.prepare('SELECT * FROM emergency_requests WHERE id = ?').get(requestId);
      if (!preCheckRequest) {
        return res.status(404).json({
          success: false,
          code: 'REQUEST_NOT_FOUND',
          error: 'Emergency blood request not found.'
        });
      }

      if (isAdmin) {
        const perms = req.admin?.permissions || [];
        const allowed =
          req.admin?.role_id === 'SUPER_ADMIN' ||
          req.admin?.role_name === 'SUPER_ADMIN' ||
          perms.includes('FULL_ADMINISTRATION') ||
          perms.includes('MANAGE_REQUESTS');
        if (!allowed) {
          return res.status(403).json({
            success: false,
            code: 'PERMISSION_DENIED',
            error: 'Administrative MANAGE_REQUESTS permission is required to dispatch donors.'
          });
        }
      } else if (!req.user || !preCheckRequest.requester_user_id || preCheckRequest.requester_user_id !== req.user.id) {
        return res.status(403).json({
          success: false,
          code: 'PERMISSION_DENIED',
          error: 'Only authorized request managers or the request owner can assign donors.'
        });
      }

      db.exec('BEGIN IMMEDIATE;');

      const requestRow = db.prepare('SELECT * FROM emergency_requests WHERE id = ?').get(requestId);
      if (!requestRow || requestRow.status !== 'OPEN') {
        db.exec('ROLLBACK;');
        return res.status(409).json({
          success: false,
          code: 'REQUEST_NOT_OPEN',
          error: 'This emergency request is no longer open for donor assignment.'
        });
      }

      const lifecycle = evaluateRequestLifecycleStatus(requestRow);
      if (!lifecycle.isApproved) {
        db.exec('ROLLBACK;');
        return res.status(409).json({
          success: false,
          code: 'REQUEST_PENDING_APPROVAL',
          error: 'This emergency blood request is pending administrative verification and cannot assign donors.'
        });
      }
      if (lifecycle.isExpired) {
        db.exec('ROLLBACK;');
        return res.status(409).json({
          success: false,
          code: 'REQUEST_EXPIRED',
          error: 'This emergency blood request has passed its deadline and is expired.'
        });
      }

      const unitsRemaining =
        (requestRow.units_requested || 0) - (requestRow.units_reserved || 0) - (requestRow.units_fulfilled || 0);
      if (unitsRemaining <= 0) {
        db.exec('ROLLBACK;');
        return res.status(409).json({
          success: false,
          code: 'UNITS_FULLY_RESERVED',
          error: 'All requested units for this request are already reserved or fulfilled.'
        });
      }

      const tableCols = getDonorProfileColumns(db);
      const hasPublicRefCol = tableCols.includes('public_reference');

      const targetDonor = db
        .prepare(`
          SELECT
            d.user_id,
            ${hasPublicRefCol ? 'd.public_reference' : 'NULL AS public_reference'},
            d.blood_group,
            d.city,
            d.is_available_for_emergency,
            u.full_name,
            u.is_active,
            u.is_suspended,
            u.age
          FROM donor_profiles d
          JOIN users u ON d.user_id = u.id
          WHERE d.user_id = ? ${hasPublicRefCol ? 'OR UPPER(d.public_reference) = UPPER(?)' : ''}
          LIMIT 1
        `)
        .get(...(hasPublicRefCol ? [donorLookup, donorLookup] : [donorLookup]));

      if (!targetDonor) {
        db.exec('ROLLBACK;');
        return res.status(404).json({
          success: false,
          code: 'DONOR_NOT_FOUND',
          error: 'Target voluntary donor profile could not be located.'
        });
      }

      if (!isBloodGroupCompatible(targetDonor.blood_group, requestRow.blood_group)) {
        db.exec('ROLLBACK;');
        return res.status(400).json({
          success: false,
          code: 'INCOMPATIBLE_BLOOD_GROUP',
          error: `Donor blood group (${targetDonor.blood_group}) is not compatible with requested blood group (${requestRow.blood_group}).`
        });
      }

      const availability = getDonorAvailabilityStatus(db, targetDonor.user_id);
      if (!availability.isAvailable) {
        db.exec('ROLLBACK;');
        if (availability.isInCooldown) {
          return res.status(409).json({
            success: false,
            code: 'DONOR_IN_COOLDOWN',
            error: `Selected donor is temporarily unavailable due to a verified blood donation cooldown. Eligible again on ${availability.reavailableDate}.`,
            reavailableDate: availability.reavailableDate,
            daysRemaining: availability.daysRemaining,
            medicalDisclaimer: availability.medicalDisclaimer,
            availability
          });
        }

        return res.status(409).json({
          success: false,
          code: availability.reasonCode || 'DONOR_UNAVAILABLE',
          error: availability.reason || 'Selected donor is currently unavailable for emergency dispatch.',
          medicalDisclaimer: availability.medicalDisclaimer,
          availability
        });
      }

      const existingPledge = db
        .prepare(`
          SELECT id, status FROM request_pledges
          WHERE request_id = ? AND donor_user_id = ? AND status IN ('PLEDGED', 'PROOF_PENDING', 'UNDER_REVIEW')
        `)
        .get(requestId, targetDonor.user_id);

      if (existingPledge) {
        db.exec('ROLLBACK;');
        return res.status(409).json({
          success: false,
          code: 'ALREADY_PLEDGED',
          error: `Donor already has an active pledge (${existingPledge.status}) for this emergency request.`
        });
      }

      const pledgeId = `PLG-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

      db.prepare(`
        INSERT INTO request_pledges (
          id, request_id, donor_user_id, units_pledged, status, reserved_at, expires_at
        ) VALUES (?, ?, ?, 1, 'PLEDGED', CURRENT_TIMESTAMP, ?)
      `).run(pledgeId, requestId, targetDonor.user_id, requestRow.required_by);

      db.prepare(`
        UPDATE emergency_requests
        SET units_reserved = units_reserved + 1, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(requestId);

      db.exec('COMMIT;');

      logSecurityAudit({
        actorType: isAdmin ? 'ADMIN' : 'USER',
        actorId: isAdmin ? req.admin.id : req.user.id,
        action: 'EMERGENCY_DONOR_SELECTED',
        details: `Assigned donor ${targetDonor.user_id} (${targetDonor.blood_group}) to request ${requestId}. Pledge ${pledgeId}.`,
        ipAddress: clientIp
      });

      return res.status(201).json({
        success: true,
        message: 'Eligible donor selected and reserved for emergency dispatch. Subject to hospital medical screening.',
        medicalDisclaimer: MEDICAL_ELIGIBILITY_DISCLAIMER,
        pledge: {
          id: pledgeId,
          requestId,
          donorUserId: isAdmin ? targetDonor.user_id : undefined,
          donorPublicReference: targetDonor.public_reference || null,
          unitsPledged: 1,
          status: 'PLEDGED'
        }
      });
    } catch (err) {
      try {
        db.exec('ROLLBACK;');
      } catch {}
      console.error('[SELECT DONOR ERROR]', err);
      return res.status(500).json({
        success: false,
        error: 'Failed to assign donor to emergency request.'
      });
    }
  });
}
