/**
 * RED MISSION — Donor Pledge API Routes
 * Stage 2.5: Atomic Pledge Management, Overbooking Prevention, Lifecycle Statuses
 * Strict zero-dependency native Node.js implementation.
 */

import crypto from 'node:crypto';
import { getDatabase } from '../database/connection.js';
import { authenticateUser } from '../middleware/authMiddleware.js';
import { logUserActivity } from '../utils/auditLogger.js';
import { getDonorAvailabilityStatus } from '../services/donorAvailabilityService.js';

export function setupPledgeRoutes(app) {

  // ==========================================
  // 1. ACCEPT / CONFIRM PLEDGE (ATOMIC)
  // ==========================================
  app.post('/api/requests/:id/pledge', authenticateUser, (req, res) => {
    const db = getDatabase();
    const userId = req.user.id;
    const requestId = req.params.id;
    const clientIp = req.ip || req.socket.remoteAddress || '127.0.0.1';

    try {
      db.exec('BEGIN IMMEDIATE;');

      // 1. Fetch current request state
      const request = db.prepare(`
        SELECT id, patient_name, hospital_name, blood_group, units_requested,
               units_reserved, units_fulfilled, status, required_by, approval_status
        FROM emergency_requests
        WHERE id = ?
      `).get(requestId);

      if (!request) {
        db.exec('ROLLBACK;');
        return res.status(404).json({
          success: false,
          code: 'REQUEST_NOT_FOUND',
          error: `Emergency request [${requestId}] was not found.`
        });
      }

      // 2. Validate request is OPEN and verified APPROVED
      if (request.status !== 'OPEN') {
        db.exec('ROLLBACK;');
        return res.status(400).json({
          success: false,
          code: 'REQUEST_NOT_OPEN',
          error: `This blood request is currently ${request.status} and cannot accept new pledges.`
        });
      }

      if (request.approval_status && request.approval_status !== 'APPROVED') {
        db.exec('ROLLBACK;');
        return res.status(400).json({
          success: false,
          code: 'REQUEST_PENDING_APPROVAL',
          error: 'This emergency blood request is pending administrative verification and cannot accept pledges.'
        });
      }

      // 3. Validate remaining units
      const remainingUnits = request.units_requested - request.units_reserved - request.units_fulfilled;
      if (remainingUnits < 1) {
        db.exec('ROLLBACK;');
        return res.status(400).json({
          success: false,
          code: 'NO_UNITS_AVAILABLE',
          error: 'All requested units for this patient are already reserved or fulfilled.'
        });
      }

      // 4. Validate deadline
      if (new Date(request.required_by).getTime() < Date.now()) {
        db.exec('ROLLBACK;');
        return res.status(400).json({
          success: false,
          code: 'REQUEST_EXPIRED',
          error: 'This blood request has passed its required-by deadline and is expired.'
        });
      }

      // 5. Prevent duplicate active pledges by the same user
      const existingPledge = db.prepare(`
        SELECT id, status FROM request_pledges 
        WHERE request_id = ? AND donor_user_id = ? AND status NOT IN ('CANCELLED', 'REJECTED')
      `).get(requestId, userId);

      if (existingPledge) {
        db.exec('ROLLBACK;');
        return res.status(409).json({
          success: false,
          code: 'DUPLICATE_PLEDGE',
          error: 'You already have an active pledge for this blood request.'
        });
      }

      // 5.5 Enforce donor re-availability & 3-month verified post-donation cooldown
      const availability = getDonorAvailabilityStatus(db, userId);
      if (availability.isInCooldown) {
        db.exec('ROLLBACK;');
        return res.status(409).json({
          success: false,
          code: 'DONOR_IN_COOLDOWN',
          error: `You are temporarily unavailable to pledge due to the 3-month recovery cooldown after your verified donation on ${availability.lastVerifiedDonationDate}. You can pledge again on ${availability.reavailableDate} (${availability.daysRemaining} day${availability.daysRemaining === 1 ? '' : 's'} remaining), subject to standard medical screening.`,
          reavailableDate: availability.reavailableDate,
          lastVerifiedDonationDate: availability.lastVerifiedDonationDate,
          daysRemaining: availability.daysRemaining,
          availability
        });
      }

      if (!availability.canSelfPledge) {
        db.exec('ROLLBACK;');
        return res.status(403).json({
          success: false,
          code: availability.reasonCode || 'DONOR_INELIGIBLE',
          error: availability.reason || 'Donor account is not currently eligible to create a blood pledge.',
          reavailableDate: availability.reavailableDate || null,
          availability
        });
      }

      // 6. Generate pledge ID and record reservation
      const pledgeId = `PLG-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

      db.prepare(`
        INSERT INTO request_pledges (
          id, request_id, donor_user_id, units_pledged, status, reserved_at, expires_at
        ) VALUES (?, ?, ?, 1, 'PLEDGED', CURRENT_TIMESTAMP, ?)
      `).run(pledgeId, requestId, userId, request.required_by);

      // 7. Atomically increment reserved units in emergency_requests
      db.prepare(`
        UPDATE emergency_requests 
        SET units_reserved = units_reserved + 1, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(requestId);

      db.exec('COMMIT;');

      // 8. Log activity
      logUserActivity({
        userId,
        eventType: 'DONOR_PLEDGE_CONFIRMED',
        description: `Pledged 1 unit of ${request.blood_group} for patient ${request.patient_name} at ${request.hospital_name} (${requestId}).`,
        ipAddress: clientIp
      });

      return res.status(201).json({
        success: true,
        message: 'Your pledge has been confirmed! Thank you for stepping forward to save a life.',
        pledge: {
          id: pledgeId,
          requestId,
          unitsPledged: 1,
          status: 'PLEDGED',
          hospitalName: request.hospital_name,
          patientName: request.patient_name,
          bloodGroup: request.blood_group
        }
      });
    } catch (err) {
      try { db.exec('ROLLBACK;'); } catch (rbErr) {}
      console.error('[CONFIRM PLEDGE ERROR]', err);
      return res.status(500).json({
        success: false,
        error: 'Failed to process pledge. Please try again.'
      });
    }
  });

  // ==========================================
  // 2. CANCEL PLEDGE (ATOMIC)
  // ==========================================
  app.post('/api/pledges/:id/cancel', authenticateUser, (req, res) => {
    const db = getDatabase();
    const userId = req.user.id;
    const pledgeId = req.params.id;
    const clientIp = req.ip || req.socket.remoteAddress || '127.0.0.1';
    const { reason = 'Cancelled by donor' } = req.body;

    try {
      db.exec('BEGIN IMMEDIATE;');

      const pledge = db.prepare(`
        SELECT p.*, r.patient_name, r.hospital_name
        FROM request_pledges p
        JOIN emergency_requests r ON p.request_id = r.id
        WHERE p.id = ?
      `).get(pledgeId);

      if (!pledge) {
        db.exec('ROLLBACK;');
        return res.status(404).json({
          success: false,
          code: 'PLEDGE_NOT_FOUND',
          error: `Pledge [${pledgeId}] was not found.`
        });
      }

      if (pledge.donor_user_id !== userId) {
        db.exec('ROLLBACK;');
        return res.status(403).json({
          success: false,
          code: 'UNAUTHORIZED_PLEDGE_ACCESS',
          error: 'You are not authorized to cancel this pledge.'
        });
      }

      if (pledge.status === 'CANCELLED') {
        db.exec('ROLLBACK;');
        return res.status(400).json({
          success: false,
          code: 'ALREADY_CANCELLED',
          error: 'This pledge has already been cancelled.'
        });
      }

      if (pledge.status === 'APPROVED') {
        db.exec('ROLLBACK;');
        return res.status(400).json({
          success: false,
          code: 'CANNOT_CANCEL_APPROVED',
          error: 'Cannot cancel a pledge that has already been verified and approved.'
        });
      }

      // Update pledge status to CANCELLED
      db.prepare(`
        UPDATE request_pledges 
        SET status = 'CANCELLED', cancel_reason = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(reason, pledgeId);

      // Synchronize associated PENDING donation proof in the same transaction
      // Note: donation_proofs table has CHECK(status IN ('PENDING', 'APPROVED', 'REJECTED')).
      // We do not set status = 'REJECTED' to avoid misrepresenting a donor withdrawal as an admin rejection.
      // Instead, we record the donor cancellation reason and timestamp, keeping the proof synchronized.
      db.prepare(`
        UPDATE donation_proofs 
        SET rejection_reason = ?, updated_at = CURRENT_TIMESTAMP
        WHERE pledge_id = ? AND status = 'PENDING'
      `).run(`CANCELLED_BY_DONOR: ${reason}`, pledgeId);

      // Decrement units_reserved on the request (if it was reserved)
      db.prepare(`
        UPDATE emergency_requests 
        SET units_reserved = MAX(0, units_reserved - ?), updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(pledge.units_pledged, pledge.request_id);

      db.exec('COMMIT;');

      logUserActivity({
        userId,
        eventType: 'DONOR_PLEDGE_CANCELLED',
        description: `Cancelled pledge ${pledgeId} for request ${pledge.request_id}. Reason: ${reason}`,
        ipAddress: clientIp
      });

      return res.status(200).json({
        success: true,
        message: 'Your pledge has been cancelled and the blood unit reservation has been released.'
      });
    } catch (err) {
      try { db.exec('ROLLBACK;'); } catch (rbErr) {}
      console.error('[CANCEL PLEDGE ERROR]', err);
      return res.status(500).json({
        success: false,
        error: 'Failed to cancel pledge.'
      });
    }
  });

  // ==========================================
  // 3. GET CALLING USER'S PLEDGES ("MY BLOOD PLEDGES")
  // ==========================================
  app.get('/api/donor/pledges', authenticateUser, (req, res) => {
    try {
      const db = getDatabase();
      const userId = req.user.id;

      const rows = db.prepare(`
        SELECT 
          p.id as pledge_id,
          p.request_id,
          p.units_pledged,
          p.status as raw_pledge_status,
          p.cancel_reason,
          p.reserved_at,
          p.expires_at,
          p.completed_at,
          r.patient_name,
          r.hospital_name,
          r.hospital_city,
          r.hospital_address,
          r.blood_group,
          r.urgency_level,
          r.required_by,
          r.contact_person,
          r.contact_phone,
          r.status as request_status,
          dp.id as proof_id,
          dp.status as proof_status,
          dp.rejection_reason,
          dp.submitted_at as proof_submitted_at,
          dp.reviewed_at as proof_reviewed_at,
          c.id as certificate_id,
          c.qr_verification_token
        FROM request_pledges p
        JOIN emergency_requests r ON p.request_id = r.id
        LEFT JOIN donation_proofs dp ON dp.pledge_id = p.id
        LEFT JOIN donation_certificates c ON c.pledge_id = p.id
        WHERE p.donor_user_id = ?
        ORDER BY p.created_at DESC
      `).all(userId);

      // Compute display lifecycle status
      const pledges = rows.map(r => {
        let displayStatus = 'Pledged';
        if (r.raw_pledge_status === 'CANCELLED') {
          displayStatus = 'Cancelled';
        } else if (r.certificate_id || r.raw_pledge_status === 'APPROVED' || r.proof_status === 'APPROVED') {
          displayStatus = 'Approved';
        } else if (r.proof_status === 'REJECTED' || r.raw_pledge_status === 'REJECTED') {
          displayStatus = 'Rejected';
        } else if (r.proof_status === 'PENDING' || r.raw_pledge_status === 'UNDER_REVIEW') {
          displayStatus = 'Under Admin Review';
        } else if (r.raw_pledge_status === 'PLEDGED' || r.raw_pledge_status === 'PROOF_PENDING') {
          displayStatus = 'Donation Proof Pending';
        }

        return {
          id: r.pledge_id,
          requestId: r.request_id,
          unitsPledged: r.units_pledged,
          rawStatus: r.raw_pledge_status,
          displayStatus,
          reservedAt: r.reserved_at,
          expiresAt: r.expires_at,
          cancelReason: r.cancel_reason,
          patientName: r.patient_name,
          hospitalName: r.hospital_name,
          hospitalCity: r.hospital_city,
          hospitalAddress: r.hospital_address,
          bloodGroup: r.blood_group,
          urgencyLevel: r.urgency_level,
          requiredBy: r.required_by,
          contactPerson: r.contact_person,
          contactPhone: r.contact_phone,
          requestStatus: r.request_status,
          proof: r.proof_id ? {
            id: r.proof_id,
            status: r.proof_status,
            rejectionReason: r.rejection_reason,
            submittedAt: r.proof_submitted_at,
            reviewedAt: r.proof_reviewed_at
          } : null,
          certificate: r.certificate_id ? {
            id: r.certificate_id,
            qrVerificationToken: r.qr_verification_token
          } : null
        };
      });

      return res.status(200).json({
        success: true,
        count: pledges.length,
        pledges
      });
    } catch (err) {
      console.error('[GET USER PLEDGES ERROR]', err);
      return res.status(500).json({
        success: false,
        error: 'Failed to retrieve your blood pledges.'
      });
    }
  });
}
