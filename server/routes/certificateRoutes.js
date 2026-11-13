/**
 * RED MISSION — Donation Certificate API Routes
 * Stage 2.5: Official Clinical Certificates & Public Verification
 * Strict zero-dependency native Node.js implementation.
 */

import fs from 'node:fs';
import { config } from '../config/env.js';
import { getDatabase as defaultGetDatabase } from '../database/connection.js';
import {
  authenticateAny as defaultAuthenticateAny,
  authenticateAdmin as defaultAuthenticateAdmin,
  requirePermission
} from '../middleware/authMiddleware.js';
import { resolveSafeDonorPhotoFile } from './superAdminDonorRoutes.js';

function detectImageMimeType(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return 'image/jpeg';
  }
  if (
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47 &&
    buf[4] === 0x0d &&
    buf[5] === 0x0a &&
    buf[6] === 0x1a &&
    buf[7] === 0x0a
  ) {
    return 'image/png';
  }
  if (
    buf.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buf.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'image/webp';
  }
  return null;
}

function getDonorProfileColumns(db) {
  try {
    const columns = db.prepare('PRAGMA table_info(donor_profiles)').all();
    return new Set(columns.map((col) => String(col.name || '').trim()).filter(Boolean));
  } catch {
    return new Set();
  }
}

function buildOptionalDonorSelect(cols) {
  const photoPathExpr = cols.has('profile_photo_path')
    ? 'd.profile_photo_path as donor_photo_path'
    : 'NULL as donor_photo_path';
  const publicRefExpr = cols.has('public_reference')
    ? 'd.public_reference as donor_public_reference'
    : 'NULL as donor_public_reference';
  const isPhotoPublicExpr = cols.has('is_photo_public')
    ? 'd.is_photo_public as donor_is_photo_public'
    : '0 as donor_is_photo_public';
  const consentDirExpr = cols.has('consent_directory_listing')
    ? 'd.consent_directory_listing as donor_consent_directory_listing'
    : '0 as donor_consent_directory_listing';

  return `${photoPathExpr},
      ${publicRefExpr},
      ${isPhotoPublicExpr},
      ${consentDirExpr}`;
}

function formatPrivacySafeRecipientReference(patientName, requestId) {
  const cleaned = typeof patientName === 'string' ? patientName.trim() : '';
  if (cleaned) {
    return cleaned;
  }
  return requestId ? `Verified Case (${requestId})` : null;
}

function queryAuthorizedCertificate(db, pledgeId, req) {
  const donorSelect = buildOptionalDonorSelect(getDonorProfileColumns(db));

  const cert = db.prepare(`
    SELECT 
      c.id as certificate_id,
      c.proof_id,
      c.pledge_id,
      c.donor_user_id,
      c.donor_name,
      c.blood_group,
      c.hospital_name,
      c.donation_date,
      c.units_donated,
      c.qr_verification_token,
      c.issued_at,
      u.email as donor_email,
      u.mobile_number as donor_mobile,
      p.status as pledge_status,
      r.id as request_id,
      r.patient_name,
      r.hospital_city,
      dp.status as proof_status,
      dp.proof_photo_path,
      ${donorSelect}
    FROM donation_certificates c
    JOIN users u ON c.donor_user_id = u.id
    JOIN request_pledges p ON c.pledge_id = p.id
    JOIN emergency_requests r ON p.request_id = r.id
    LEFT JOIN donation_proofs dp ON c.proof_id = dp.id
    LEFT JOIN donor_profiles d ON c.donor_user_id = d.user_id
    WHERE c.pledge_id = ?
  `).get(pledgeId);

  if (!cert) {
    return {
      status: 404,
      body: {
        success: false,
        code: 'CERTIFICATE_NOT_FOUND',
        error: 'Certificate not found. Certificates are issued only after medical proof approval.'
      }
    };
  }

  // Authorization check:
  // 1. Donor owner: req.user.id === cert.donor_user_id
  // 2. Super Admin: req.admin.role_id === 'SUPER_ADMIN'
  // 3. Admin with VIEW_CERTIFICATES permission: req.admin.permissions.includes('VIEW_CERTIFICATES')
  const isDonorOwner = Boolean(req.user && req.user.id === cert.donor_user_id);
  const isSuperAdmin = Boolean(req.admin && req.admin.role_id === 'SUPER_ADMIN');
  const hasViewCertificatesPerm = Boolean(
    req.admin && Array.isArray(req.admin.permissions) && req.admin.permissions.includes('VIEW_CERTIFICATES')
  );

  if (!isDonorOwner && !isSuperAdmin && !hasViewCertificatesPerm) {
    return {
      status: 403,
      body: {
        success: false,
        code: 'FORBIDDEN_CERTIFICATE_ACCESS',
        error: 'Access Denied: You do not have permission to view this clinical donation certificate.'
      }
    };
  }

  if ((cert.proof_id && cert.proof_status !== 'APPROVED') || cert.pledge_status === 'CANCELLED' || cert.pledge_status === 'REJECTED') {
    return {
      status: 403,
      body: {
        success: false,
        code: 'UNAPPROVED_CERTIFICATE_PROOF',
        error: 'Certificate unavailable: linked donation proof or pledge is not approved.'
      }
    };
  }

  return { status: 200, cert };
}

export function setupCertificateRoutes(app, deps = {}) {
  const getDb = deps.getDatabase || defaultGetDatabase;
  const authAny = deps.authenticateAny || defaultAuthenticateAny;
  const authAdmin = deps.authenticateAdmin || defaultAuthenticateAdmin;
  const photoStorageDir = deps.photoStorageDir || config.SELFIE_STORAGE_DIR;

  // ==========================================
  // 1. GET CERTIFICATE FOR A PLEDGE (DONOR OWNER OR ADMIN)
  // ==========================================
  app.get('/api/certificates/:pledgeId', authAny, (req, res) => {
    try {
      const db = getDb();
      const pledgeId = req.params.pledgeId;

      const lookup = queryAuthorizedCertificate(db, pledgeId, req);
      if (lookup.status !== 200) {
        return res.status(lookup.status).json(lookup.body);
      }

      const cert = lookup.cert;
      const hasVerifiedProofPhoto = Boolean(cert.proof_id && cert.proof_photo_path && cert.proof_status === 'APPROVED');
      const proofPhotoUrl = hasVerifiedProofPhoto ? `/api/proofs/${cert.proof_id}/photo` : null;

      const donorPhotoFile = cert.donor_photo_path
        ? resolveSafeDonorPhotoFile(cert.donor_photo_path, photoStorageDir)
        : null;
      const donorPhotoAvailable = Boolean(donorPhotoFile && donorPhotoFile.size > 0);
      const donorPhotoUrl = donorPhotoAvailable
        ? `/api/certificates/${encodeURIComponent(cert.pledge_id)}/donor-photo`
        : null;

      return res.status(200).json({
        success: true,
        certificate: {
          id: cert.certificate_id,
          pledgeId: cert.pledge_id,
          proofId: cert.proof_id,
          donorName: cert.donor_name,
          donorEmail: cert.donor_email,
          donorMobile: cert.donor_mobile,
          bloodGroup: cert.blood_group,
          hospitalName: cert.hospital_name,
          hospitalCity: cert.hospital_city,
          patientName: cert.patient_name,
          recipientReference: formatPrivacySafeRecipientReference(cert.patient_name, cert.request_id),
          donationDate: cert.donation_date,
          verifiedDonationDate: cert.donation_date,
          unitsDonated: cert.units_donated,
          issuedAt: cert.issued_at,
          qrVerificationToken: cert.qr_verification_token,
          organizationName: 'RED MISSION',
          issuingAuthority: 'RED MISSION Clinical Verification Council',
          issuingDesignation: 'Authorized Issuing Authority',
          approvalStatus: cert.proof_id ? (cert.proof_status || 'APPROVED') : 'LEGACY_VERIFIED',
          donorPhotoAvailable,
          donorPhotoUrl,
          hasVerifiedProofPhoto,
          proofPhotoUrl,
          verificationUrl: `/#verify-certificate-${cert.qr_verification_token}`
        }
      });
    } catch (err) {
      console.error('[GET CERTIFICATE ERROR]', err);
      return res.status(500).json({
        success: false,
        error: 'Failed to retrieve donation certificate.'
      });
    }
  });

  // ==========================================
  // 1B. STREAM GENUINE REGISTERED DONOR PHOTO FOR CERTIFICATE
  // ==========================================
  app.get('/api/certificates/:pledgeId/donor-photo', authAny, (req, res) => {
    try {
      const db = getDb();
      const pledgeId = req.params.pledgeId;

      const lookup = queryAuthorizedCertificate(db, pledgeId, req);
      if (lookup.status !== 200) {
        return res.status(lookup.status).json(lookup.body);
      }

      const cert = lookup.cert;
      const donorPhotoFile = cert.donor_photo_path
        ? resolveSafeDonorPhotoFile(cert.donor_photo_path, photoStorageDir)
        : null;

      if (!donorPhotoFile) {
        return res.status(404).json({
          success: false,
          code: 'DONOR_PHOTO_UNAVAILABLE',
          error: 'Registered donor photograph is unavailable for this certificate.'
        });
      }

      const imageBuffer = fs.readFileSync(donorPhotoFile.fullPath);
      const mimeType = detectImageMimeType(imageBuffer);
      if (!mimeType) {
        return res.status(404).json({
          success: false,
          code: 'DONOR_PHOTO_UNAVAILABLE',
          error: 'Registered donor photograph format could not be verified.'
        });
      }

      res.status(200);
      res.setHeader('Content-Type', mimeType);
      res.setHeader('Content-Length', imageBuffer.length);
      res.setHeader('Cache-Control', 'private, no-store, max-age=0');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
      return res.end(imageBuffer);
    } catch (err) {
      console.error('[CERTIFICATE DONOR PHOTO ERROR]', err);
      return res.status(500).json({
        success: false,
        error: 'Failed to load certificate donor photograph.'
      });
    }
  });

  // ==========================================
  // 2. PUBLIC VERIFICATION: VERIFY CERTIFICATE BY QR TOKEN OR CERTIFICATE ID
  // ==========================================
  app.get('/api/certificates/verify/:token', (req, res) => {
    try {
      const db = getDb();
      const token = req.params.token ? req.params.token.trim() : '';

      if (!token || token === ':token') {
        return res.status(400).json({
          success: false,
          code: 'MALFORMED_TOKEN',
          error: 'Malformed verification token. Verification requires a valid certificate token or serial ID.'
        });
      }

      const donorSelect = buildOptionalDonorSelect(getDonorProfileColumns(db));

      const cert = db.prepare(`
        SELECT 
          c.id as certificate_id,
          c.proof_id,
          c.pledge_id,
          c.donor_name,
          c.blood_group,
          c.hospital_name,
          c.donation_date,
          c.units_donated,
          c.issued_at,
          dp.status as proof_status,
          p.status as pledge_status,
          r.hospital_city,
          ${donorSelect}
        FROM donation_certificates c
        LEFT JOIN donation_proofs dp ON c.proof_id = dp.id
        LEFT JOIN request_pledges p ON c.pledge_id = p.id
        LEFT JOIN emergency_requests r ON p.request_id = r.id
        LEFT JOIN donor_profiles d ON c.donor_user_id = d.user_id
        WHERE c.qr_verification_token = ? OR c.id = ?
      `).get(token, token);

      if (!cert) {
        return res.status(404).json({
          success: false,
          verificationStatus: 'INVALID',
          code: 'INVALID_CERTIFICATE_TOKEN',
          error: 'Verification failed: This certificate token is invalid or does not exist.'
        });
      }

      const isRevokedOrUnapproved = Boolean(
        (cert.proof_id && cert.proof_status !== 'APPROVED') ||
        cert.pledge_status === 'CANCELLED' ||
        cert.pledge_status === 'REJECTED'
      );

      if (isRevokedOrUnapproved) {
        return res.status(403).json({
          success: false,
          verified: false,
          verificationStatus: 'REVOKED',
          code: 'CERTIFICATE_REVOKED',
          error: 'Verification failed: This certificate has been revoked or its donation proof is no longer approved.',
          certificate: {
            certificateId: cert.certificate_id,
            organizationName: 'RED MISSION',
            approvalStatus: cert.proof_status || cert.pledge_status || 'REVOKED'
          }
        });
      }

      const donorPhotoFile = cert.donor_photo_path
        ? resolveSafeDonorPhotoFile(cert.donor_photo_path, photoStorageDir)
        : null;
      const isPublicPhotoConsented = Boolean(
        donorPhotoFile &&
        donorPhotoFile.size > 0 &&
        cert.donor_public_reference &&
        (cert.donor_is_photo_public === 1 || cert.donor_is_photo_public === true) &&
        (cert.donor_consent_directory_listing === 1 || cert.donor_consent_directory_listing === true)
      );

      return res.status(200).json({
        success: true,
        verified: true,
        verificationStatus: 'VERIFIED',
        certificate: {
          certificateId: cert.certificate_id,
          donorName: cert.donor_name,
          bloodGroup: cert.blood_group,
          hospitalName: cert.hospital_name,
          hospitalCity: cert.hospital_city || null,
          donationDate: cert.donation_date,
          verifiedDonationDate: cert.donation_date,
          unitsDonated: cert.units_donated,
          issuedAt: cert.issued_at,
          organizationName: 'RED MISSION',
          issuer: 'RED MISSION Clinical Blood Network',
          approvalStatus: cert.proof_id ? 'APPROVED' : 'LEGACY_VERIFIED',
          donorPhotoAvailable: isPublicPhotoConsented,
          donorPhotoUrl: isPublicPhotoConsented
            ? `/api/donor/photo/${encodeURIComponent(cert.donor_public_reference)}`
            : null
        }
      });
    } catch (err) {
      console.error('[VERIFY CERTIFICATE ERROR]', err);
      return res.status(500).json({
        success: false,
        error: 'Failed to verify certificate token.'
      });
    }
  });

  // ==========================================
  // 3. GET ALL CLINICAL CERTIFICATES (SUPER ADMIN / ADMIN WITH VIEW_CERTIFICATES)
  // ==========================================
  app.get('/api/admin/certificates', authAdmin, requirePermission('VIEW_CERTIFICATES'), (req, res) => {
    try {
      const db = getDb();
      const cols = getDonorProfileColumns(db);
      const photoPathExpr = cols.has('profile_photo_path')
        ? 'd.profile_photo_path as donor_photo_path'
        : 'NULL as donor_photo_path';

      const certs = db.prepare(`
        SELECT 
          c.id as certificate_id,
          c.proof_id,
          c.pledge_id,
          c.donor_user_id,
          c.donor_name,
          c.blood_group,
          c.hospital_name,
          c.donation_date,
          c.units_donated,
          c.qr_verification_token,
          c.issued_at,
          u.email as donor_email,
          u.mobile_number as donor_mobile,
          r.id as request_id,
          r.patient_name,
          r.hospital_city,
          dp.status as proof_status,
          dp.proof_photo_path,
          ${photoPathExpr}
        FROM donation_certificates c
        JOIN users u ON c.donor_user_id = u.id
        JOIN request_pledges p ON c.pledge_id = p.id
        JOIN emergency_requests r ON p.request_id = r.id
        LEFT JOIN donation_proofs dp ON c.proof_id = dp.id
        LEFT JOIN donor_profiles d ON c.donor_user_id = d.user_id
        WHERE (c.proof_id IS NULL OR dp.status = 'APPROVED')
          AND p.status NOT IN ('CANCELLED', 'REJECTED')
        ORDER BY c.issued_at DESC
      `).all();

      return res.status(200).json({
        success: true,
        certificates: certs.map(c => {
          const donorPhotoFile = c.donor_photo_path
            ? resolveSafeDonorPhotoFile(c.donor_photo_path, photoStorageDir)
            : null;
          const donorPhotoAvailable = Boolean(donorPhotoFile && donorPhotoFile.size > 0);
          return {
            id: c.certificate_id,
            pledgeId: c.pledge_id,
            proofId: c.proof_id,
            donorUserId: c.donor_user_id,
            donorName: c.donor_name,
            donorEmail: c.donor_email,
            donorMobile: c.donor_mobile,
            bloodGroup: c.blood_group,
            hospitalName: c.hospital_name,
            hospitalCity: c.hospital_city,
            patientName: c.patient_name,
            recipientReference: formatPrivacySafeRecipientReference(c.patient_name, c.request_id),
            donationDate: c.donation_date,
            verifiedDonationDate: c.donation_date,
            unitsDonated: c.units_donated,
            issuedAt: c.issued_at,
            qrVerificationToken: c.qr_verification_token,
            organizationName: 'RED MISSION',
            issuingAuthority: 'RED MISSION Clinical Verification Council',
            issuingDesignation: 'Authorized Issuing Authority',
            approvalStatus: c.proof_id ? 'APPROVED' : 'LEGACY_VERIFIED',
            donorPhotoAvailable,
            donorPhotoUrl: donorPhotoAvailable ? `/api/certificates/${encodeURIComponent(c.pledge_id)}/donor-photo` : null,
            hasVerifiedProofPhoto: Boolean(c.proof_id && c.proof_photo_path && c.proof_status === 'APPROVED'),
            proofPhotoUrl: (c.proof_id && c.proof_photo_path && c.proof_status === 'APPROVED') ? `/api/proofs/${c.proof_id}/photo` : null,
            verificationUrl: `/#verify-certificate-${c.qr_verification_token}`
          };
        })
      });
    } catch (err) {
      console.error('[LIST CERTIFICATES ERROR]', err);
      return res.status(500).json({
        success: false,
        error: 'Failed to retrieve donation certificates.'
      });
    }
  });
}
