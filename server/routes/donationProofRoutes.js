/**
 * RED MISSION — Donation Proof API Routes
 * Stage 2.5: Secure Donation Proof Upload, Admin Verification & Status Lifecycle
 * Strict zero-dependency native Node.js implementation.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { getDatabase } from '../database/connection.js';
import { config } from '../config/env.js';
import { authenticateUser, authenticateAdmin, authenticateAny, requirePermission } from '../middleware/authMiddleware.js';
import { validateImagePayload } from '../utils/imageValidator.js';
import { logSecurityAudit, logUserActivity } from '../utils/auditLogger.js';
import {
  getTodayIstDateString,
  getDonorAvailabilityStatus,
  getBulkDonorAvailability
} from '../services/donorAvailabilityService.js';

// Ensure proof storage directory exists
if (!fs.existsSync(config.PROOF_STORAGE_DIR)) {
  fs.mkdirSync(config.PROOF_STORAGE_DIR, { recursive: true });
}

export function setupDonationProofRoutes(app) {

  // ==========================================
  // 1. DONOR: UPLOAD DONATION PROOF PHOTO
  // ==========================================
  app.post('/api/pledges/:id/proof', authenticateUser, (req, res) => {
    const db = getDatabase();
    const userId = req.user.id;
    const pledgeId = req.params.id;
    const clientIp = req.ip || req.socket.remoteAddress || '127.0.0.1';

    try {
      // 1. Fetch pledge and verify ownership
      const pledge = db.prepare(`
        SELECT p.*, r.patient_name, r.hospital_name, r.blood_group
        FROM request_pledges p
        JOIN emergency_requests r ON p.request_id = r.id
        WHERE p.id = ?
      `).get(pledgeId);

      if (!pledge) {
        return res.status(404).json({
          success: false,
          code: 'PLEDGE_NOT_FOUND',
          error: `Pledge [${pledgeId}] was not found.`
        });
      }

      if (pledge.donor_user_id !== userId) {
        return res.status(403).json({
          success: false,
          code: 'UNAUTHORIZED_PROOF_SUBMISSION',
          error: 'Forbidden: You cannot submit donation proof for another user\'s pledge.'
        });
      }

      if (pledge.status === 'CANCELLED') {
        return res.status(400).json({
          success: false,
          code: 'PLEDGE_CANCELLED',
          error: 'Cannot submit proof for a cancelled pledge.'
        });
      }

      if (pledge.status === 'APPROVED') {
        return res.status(400).json({
          success: false,
          code: 'ALREADY_APPROVED',
          error: 'This donation pledge has already been approved and certified.'
        });
      }

      // 2. Validate proof image payload
      const proofPayload = req.body.proofPhoto || req.body.proofImage || req.body.proof;
      if (!proofPayload) {
        return res.status(400).json({
          success: false,
          code: 'PROOF_IMAGE_REQUIRED',
          error: 'Donation proof photograph (hospital slip or certificate) is required.'
        });
      }

      const validation = validateImagePayload(proofPayload, {
        maxSize: config.MAX_PROOF_SIZE_BYTES || 5 * 1024 * 1024
      });

      if (!validation.valid) {
        return res.status(400).json({
          success: false,
          code: 'INVALID_PROOF_IMAGE',
          error: validation.error
        });
      }

      // 3. Save proof photo securely to disk
      if (!fs.existsSync(config.PROOF_STORAGE_DIR)) {
        fs.mkdirSync(config.PROOF_STORAGE_DIR, { recursive: true });
      }

      const ext = validation.format === 'jpeg' ? 'jpg' : validation.format;
      const fileName = `proof_${pledge.id}_${Date.now()}.${ext}`;
      const filePath = path.join(config.PROOF_STORAGE_DIR, fileName);

      fs.writeFileSync(filePath, validation.buffer);

      // 4. Update database in transaction
      db.exec('BEGIN IMMEDIATE;');

      const existingProof = db.prepare('SELECT id, proof_photo_path FROM donation_proofs WHERE pledge_id = ?').get(pledgeId);
      let proofId;

      if (existingProof) {
        proofId = existingProof.id;
        // Clean up previous image file if it exists and differs
        if (existingProof.proof_photo_path && existingProof.proof_photo_path !== filePath && fs.existsSync(existingProof.proof_photo_path)) {
          try { fs.unlinkSync(existingProof.proof_photo_path); } catch (e) {}
        }

        // Reset proof to PENDING for re-review
        db.prepare(`
          UPDATE donation_proofs 
          SET proof_photo_path = ?, proof_photo_mime = ?, proof_photo_size = ?,
              status = 'PENDING', rejection_reason = NULL, reviewed_by_admin_id = NULL,
              reviewed_at = NULL, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(filePath, validation.mime, validation.buffer.length, proofId);
      } else {
        proofId = `PRF-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
        db.prepare(`
          INSERT INTO donation_proofs (
            id, pledge_id, donor_user_id, request_id, proof_photo_path,
            proof_photo_mime, proof_photo_size, status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING')
        `).run(proofId, pledgeId, userId, pledge.request_id, filePath, validation.mime, validation.buffer.length);
      }

      // Update pledge status to UNDER_REVIEW
      db.prepare(`
        UPDATE request_pledges 
        SET status = 'UNDER_REVIEW', proof_submitted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(pledgeId);

      db.exec('COMMIT;');

      logUserActivity({
        userId,
        eventType: 'DONATION_PROOF_SUBMITTED',
        description: `Uploaded donation proof for pledge ${pledgeId} (${pledge.hospital_name}). Status: UNDER_REVIEW.`,
        ipAddress: clientIp
      });

      return res.status(200).json({
        success: true,
        message: 'Donation proof uploaded successfully! Our medical verification desk will review your submission shortly.',
        proofId,
        status: 'UNDER_REVIEW'
      });
    } catch (err) {
      try { db.exec('ROLLBACK;'); } catch (rbErr) {}
      console.error('[PROOF UPLOAD ERROR]', err);
      return res.status(500).json({
        success: false,
        error: 'Failed to upload donation proof.'
      });
    }
  });

  // ==========================================
  // 2. VIEW PROOF PHOTO (AUTHENTICATED OWNER OR ADMIN ONLY)
  // ==========================================
  app.get('/api/proofs/:id/photo', authenticateAny, (req, res) => {
    try {
      const db = getDatabase();
      const proofId = req.params.id;

      const proof = db.prepare('SELECT * FROM donation_proofs WHERE id = ?').get(proofId);
      if (!proof) {
        return res.status(404).json({
          success: false,
          code: 'PROOF_NOT_FOUND',
          error: 'Proof record not found.'
        });
      }

      // Authorization check: Must be the donor user OR an authorized admin
      const isOwner = req.user && req.user.id === proof.donor_user_id;
      const isAdmin = req.admin && (req.admin.role_id === 'SUPER_ADMIN' || req.admin.permissions.includes('VERIFY_PROOFS'));

      if (!isOwner && !isAdmin) {
        return res.status(403).json({
          success: false,
          code: 'FORBIDDEN_PROOF_ACCESS',
          error: 'Access Denied: You are not authorized to view this donation proof photo.'
        });
      }

      if (!proof.proof_photo_path || !fs.existsSync(proof.proof_photo_path)) {
        return res.status(404).json({
          success: false,
          error: 'Proof image file not found on server.'
        });
      }

      const fileBuffer = fs.readFileSync(proof.proof_photo_path);
      res.setHeader('Content-Type', proof.proof_photo_mime || 'image/jpeg');
      res.setHeader('Content-Length', fileBuffer.length);
      res.setHeader('Cache-Control', 'private, max-age=3600');
      return res.end(fileBuffer);
    } catch (err) {
      console.error('[VIEW PROOF PHOTO ERROR]', err);
      return res.status(500).json({
        success: false,
        error: 'Failed to retrieve proof photo.'
      });
    }
  });

  // ==========================================
  // 3. ADMIN: GET PROOF SUBMISSIONS FOR REVIEW
  // ==========================================
  app.get('/api/admin/proofs', authenticateAdmin, requirePermission('VERIFY_PROOFS'), (req, res) => {
    try {
      const db = getDatabase();
      const { status = 'PENDING' } = req.query;

      let query = `
        SELECT 
          dp.id as proof_id,
          dp.pledge_id,
          dp.request_id,
          dp.donor_user_id,
          dp.proof_photo_mime,
          dp.proof_photo_size,
          dp.status as proof_status,
          dp.rejection_reason,
          dp.reviewed_by_admin_id,
          dp.reviewed_at,
          dp.submitted_at,
          u.full_name as donor_name,
          u.mobile_number as donor_mobile,
          u.email as donor_email,
          u.blood_group as donor_blood_group,
          u.is_active,
          u.is_suspended,
          u.age,
          d.user_id as donor_profile_user_id,
          d.is_available_for_emergency,
          d.last_donation_date,
          r.patient_name,
          r.hospital_name,
          r.hospital_city,
          r.blood_group as requested_blood_group,
          r.urgency_level,
          p.reserved_at as pledge_date,
          p.units_pledged,
          adm.full_name as reviewed_by_admin_name
        FROM donation_proofs dp
        JOIN request_pledges p ON dp.pledge_id = p.id
        JOIN emergency_requests r ON dp.request_id = r.id
        JOIN users u ON dp.donor_user_id = u.id
        LEFT JOIN donor_profiles d ON dp.donor_user_id = d.user_id
        LEFT JOIN admin_accounts adm ON dp.reviewed_by_admin_id = adm.id
        WHERE p.status != 'CANCELLED'
      `;
      const params = [];

      if (status !== 'all') {
        query += ' AND dp.status = ?';
        params.push(status.toUpperCase());
      }

      query += ' ORDER BY dp.submitted_at DESC';

      const rows = db.prepare(query).all(...params);
      const availabilityMap = getBulkDonorAvailability(db, rows);

      const proofs = rows.map(r => ({
        id: r.proof_id,
        pledgeId: r.pledge_id,
        requestId: r.request_id,
        donorUserId: r.donor_user_id,
        donorName: r.donor_name,
        donorMobile: r.donor_mobile,
        donorEmail: r.donor_email,
        donorBloodGroup: r.donor_blood_group,
        donorAvailability: availabilityMap.get(r.donor_user_id) || null,
        patientName: r.patient_name,
        hospitalName: r.hospital_name,
        hospitalCity: r.hospital_city,
        requestedBloodGroup: r.requested_blood_group,
        urgencyLevel: r.urgency_level,
        unitsPledged: r.units_pledged,
        pledgeDate: r.pledge_date,
        status: r.proof_status,
        rejectionReason: r.rejection_reason,
        reviewedByAdminName: r.reviewed_by_admin_name,
        reviewedAt: r.reviewed_at,
        submittedAt: r.submitted_at,
        photoUrl: `/api/proofs/${r.proof_id}/photo`
      }));

      return res.status(200).json({
        success: true,
        count: proofs.length,
        proofs
      });
    } catch (err) {
      console.error('[ADMIN GET PROOFS ERROR]', err);
      return res.status(500).json({
        success: false,
        error: 'Failed to retrieve donation proofs.'
      });
    }
  });

  // ==========================================
  // 4. ADMIN: APPROVE OR REJECT DONATION PROOF
  // ==========================================
  app.post('/api/admin/proofs/:id/review', authenticateAdmin, requirePermission('VERIFY_PROOFS'), (req, res) => {
    const db = getDatabase();
    const adminId = req.admin.id;
    const proofId = req.params.id;
    const clientIp = req.ip || req.socket.remoteAddress || '127.0.0.1';
    const { action, rejectionReason, rejection_reason } = req.body;

    const reviewAction = (action || '').toUpperCase();
    if (reviewAction !== 'APPROVE' && reviewAction !== 'REJECT') {
      return res.status(400).json({
        success: false,
        error: 'Invalid review action. Must be "APPROVE" or "REJECT".'
      });
    }

    try {
      db.exec('BEGIN IMMEDIATE;');

      const proof = db.prepare(`
        SELECT dp.*, p.units_pledged, p.status as pledge_status, r.hospital_name, r.patient_name, r.blood_group,
               u.full_name as donor_name, u.blood_group as donor_blood_group
        FROM donation_proofs dp
        JOIN request_pledges p ON dp.pledge_id = p.id
        JOIN emergency_requests r ON dp.request_id = r.id
        JOIN users u ON dp.donor_user_id = u.id
        WHERE dp.id = ?
      `).get(proofId);

      if (!proof) {
        db.exec('ROLLBACK;');
        return res.status(404).json({
          success: false,
          code: 'PROOF_NOT_FOUND',
          error: `Proof [${proofId}] was not found.`
        });
      }

      // Check proof status - Only PENDING proofs can be reviewed
      if (proof.status !== 'PENDING') {
        db.exec('ROLLBACK;');
        return res.status(409).json({
          success: false,
          code: 'PROOF_ALREADY_REVIEWED',
          error: `This donation proof has already been ${proof.status.toLowerCase()} and cannot be reviewed again.`
        });
      }

      // Verify related pledge is not CANCELLED
      if (proof.pledge_status === 'CANCELLED') {
        db.exec('ROLLBACK;');
        return res.status(409).json({
          success: false,
          code: 'PLEDGE_CANCELLED',
          error: 'Cannot review donation proof for a pledge that has been cancelled.'
        });
      }

      // Self-approval prevention: Admins cannot approve their own proof
      if (proof.donor_user_id === adminId) {
        db.exec('ROLLBACK;');
        return res.status(403).json({
          success: false,
          code: 'SELF_APPROVAL_FORBIDDEN',
          error: 'Admins cannot review or approve their own donation proofs.'
        });
      }

      if (reviewAction === 'APPROVE') {
        // 1. Update donation_proofs
        db.prepare(`
          UPDATE donation_proofs 
          SET status = 'APPROVED', reviewed_by_admin_id = ?, reviewed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(adminId, proofId);

        // 2. Update request_pledges
        db.prepare(`
          UPDATE request_pledges 
          SET status = 'APPROVED', completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(proof.pledge_id);

        // 3. Update emergency_requests (increment fulfilled, decrement reserved)
        db.prepare(`
          UPDATE emergency_requests 
          SET units_fulfilled = units_fulfilled + ?,
              units_reserved = MAX(0, units_reserved - ?),
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(proof.units_pledged, proof.units_pledged, proof.request_id);

        // Check if request is now fully fulfilled
        db.prepare(`
          UPDATE emergency_requests 
          SET status = 'FULFILLED'
          WHERE id = ? AND units_fulfilled >= units_requested
        `).run(proof.request_id);

        // 4. Increment donor's total_donations_count in donor_profiles (IST calendar date)
        const istToday = getTodayIstDateString();
        db.prepare(`
          UPDATE donor_profiles 
          SET total_donations_count = total_donations_count + 1,
              last_donation_date = ?,
              updated_at = CURRENT_TIMESTAMP
          WHERE user_id = ?
        `).run(istToday, proof.donor_user_id);

        // 5. Issue Donation Certificate (Prevent duplicates)
        const existingCert = db.prepare('SELECT id FROM donation_certificates WHERE pledge_id = ?').get(proof.pledge_id);
        let certId;

        if (existingCert) {
          certId = existingCert.id;
        } else {
          const istYear = istToday.slice(0, 4);
          certId = `CERT-RED-${istYear}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
          const qrToken = crypto.randomBytes(16).toString('hex');

          db.prepare(`
            INSERT INTO donation_certificates (
              id, proof_id, pledge_id, donor_user_id, donor_name,
              blood_group, hospital_name, donation_date, units_donated,
              qr_verification_token
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            certId,
            proof.id,
            proof.pledge_id,
            proof.donor_user_id,
            proof.donor_name,
            proof.donor_blood_group,
            proof.hospital_name,
            istToday,
            proof.units_pledged,
            qrToken
          );
        }

        db.exec('COMMIT;');

        const donorAvailability = getDonorAvailabilityStatus(db, proof.donor_user_id);

        logSecurityAudit({
          actorType: 'ADMIN',
          actorId: adminId,
          action: 'ADMIN_APPROVE_DONATION_PROOF',
          details: `Approved proof ${proofId} for donor ${proof.donor_name} (${proof.donor_user_id}). Issued certificate ${certId}. Cooldown active until ${donorAvailability.reavailableDate || 'N/A'}.`,
          ipAddress: clientIp
        });

        return res.status(200).json({
          success: true,
          message: donorAvailability.isInCooldown
            ? `Donation proof approved! Certificate issued. Donor entered 3-month cooldown until ${donorAvailability.reavailableDate}.`
            : 'Donation proof approved! Certificate has been generated and issued to the donor.',
          status: 'APPROVED',
          certificateId: certId,
          donorAvailability
        });

      } else {
        // REJECT ACTION
        const reason = (rejectionReason || rejection_reason || '').trim();
        if (!reason) {
          db.exec('ROLLBACK;');
          return res.status(400).json({
            success: false,
            error: 'A specific rejection reason is mandatory when rejecting donation proof.'
          });
        }

        // 1. Update donation_proofs
        db.prepare(`
          UPDATE donation_proofs 
          SET status = 'REJECTED', rejection_reason = ?, reviewed_by_admin_id = ?,
              reviewed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(reason, adminId, proofId);

        // 2. Update request_pledges to REJECTED so donor can resubmit
        db.prepare(`
          UPDATE request_pledges 
          SET status = 'REJECTED', updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(proof.pledge_id);

        db.exec('COMMIT;');

        logSecurityAudit({
          actorType: 'ADMIN',
          actorId: adminId,
          action: 'ADMIN_REJECT_DONATION_PROOF',
          details: `Rejected proof ${proofId} for donor ${proof.donor_name}. Reason: ${reason}`,
          ipAddress: clientIp
        });

        return res.status(200).json({
          success: true,
          message: 'Donation proof has been rejected. Donor has been notified with the rejection reason.',
          status: 'REJECTED',
          rejectionReason: reason
        });
      }
    } catch (err) {
      try { db.exec('ROLLBACK;'); } catch (rbErr) {}
      console.error('[ADMIN REVIEW PROOF ERROR]', err);
      return res.status(500).json({
        success: false,
        error: 'Failed to process proof review.'
      });
    }
  });
}
