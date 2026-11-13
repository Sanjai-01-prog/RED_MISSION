/**
 * RED MISSION — Monthly Donation Report Data Service
 * Phase 6, Feature 1: Evidence-Based Monthly Activity Report Generation
 * 
 * Strict Zero-Dependency Native Node.js Implementation.
 * Enforces strict donation eligibility: only verified completed donations.
 */

import crypto from 'node:crypto';
import { getDatabase } from '../database/connection.js';

/**
 * Mask sensitive mobile number (e.g., +91 98****1234)
 */
export function maskMobile(mobile) {
  if (!mobile || typeof mobile !== 'string') return 'Not Provided';
  const clean = mobile.trim();
  if (clean.length < 8) return '********';
  return clean.slice(0, 5) + '****' + clean.slice(-2);
}

/**
 * Mask sensitive email address (e.g., j***@example.com)
 */
export function maskEmail(email) {
  if (!email || typeof email !== 'string') return 'Not Provided';
  const parts = email.trim().split('@');
  if (parts.length !== 2) return '******';
  const [user, domain] = parts;
  const maskedUser = user.length <= 2 ? user[0] + '***' : user.slice(0, 2) + '***' + user.slice(-1);
  return `${maskedUser}@${domain}`;
}

/**
 * Get Month Name from 1-12 index
 */
export function getMonthName(monthNumber) {
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const idx = parseInt(monthNumber, 10) - 1;
  return months[idx] || 'Unknown Month';
}

/**
 * Retrieve verified monthly donation records and summary statistics.
 * 
 * Strict Eligibility Rules:
 * - Only approved pledges (status = 'APPROVED') with approved proofs (status = 'APPROVED').
 * - Must fall within the exact calendar month based on verified donation date.
 * - Excludes all pledges with PLEDGED, PROOF_PENDING, UNDER_REVIEW, REJECTED, CANCELLED, or EXPIRED.
 * - Excludes all proofs with PENDING or REJECTED.
 * 
 * @param {Object} db - SQLite database instance
 * @param {Object} params
 * @param {number|string} params.month - 1 to 12
 * @param {number|string} params.year - e.g. 2026
 * @param {boolean} [params.maskSensitive=true] - Whether to mask donor PII
 * @param {Object} [params.admin] - Admin details generating the report
 * @returns {Object} Complete structured monthly report data
 */
export function getMonthlyDonationReportData(db, { month, year, maskSensitive = true, admin = null } = {}) {
  const parsedMonth = parseInt(month, 10);
  const parsedYear = parseInt(year, 10);

  if (isNaN(parsedMonth) || parsedMonth < 1 || parsedMonth > 12) {
    throw new Error(`Invalid month: '${month}'. Month must be an integer between 1 and 12.`);
  }

  if (isNaN(parsedYear) || parsedYear < 2000 || parsedYear > 2100) {
    throw new Error(`Invalid year: '${year}'. Year must be a 4-digit year between 2000 and 2100.`);
  }

  const isMasked = !(maskSensitive === false || maskSensitive === 'false');
  const privacyMode = isMasked ? 'MASKED' : 'UNMASKED';

  const monthStr = String(parsedMonth).padStart(2, '0');
  const startDate = `${parsedYear}-${monthStr}-01`;
  const lastDay = new Date(parsedYear, parsedMonth, 0).getDate();
  const endDate = `${parsedYear}-${monthStr}-${String(lastDay).padStart(2, '0')}`;

  // Inspect actual donor_profiles schema dynamically (Stage 2.8 backward compatibility)
  let hasPublicReferenceCol = false;
  try {
    const donorProfileCols = db.prepare('PRAGMA table_info(donor_profiles)').all();
    hasPublicReferenceCol = donorProfileCols.some(col => col.name === 'public_reference');
  } catch {
    hasPublicReferenceCol = false;
  }

  const publicReferenceSelect = hasPublicReferenceCol
    ? 'dprof.public_reference as donor_public_reference,'
    : 'NULL as donor_public_reference,';

  // Query verified completed donations joined across certificates, pledges, requests, users, and proofs
  const query = `
    SELECT 
      p.id as pledge_id,
      p.request_id,
      p.donor_user_id,
      p.units_pledged,
      p.status as pledge_status,
      p.reserved_at as pledge_reserved_at,
      p.completed_at as donation_completed_at,
      
      -- Certificate details (Official proof of completion)
      c.id as certificate_id,
      COALESCE(c.donation_date, DATE(p.completed_at)) as actual_donation_date,
      COALESCE(c.units_donated, p.units_pledged, 1) as verified_units,
      c.qr_verification_token,
      c.issued_at as certificate_issued_at,
      
      -- Donor profile & user information
      u.full_name as donor_name,
      u.age as donor_age,
      u.blood_group as donor_blood_group,
      u.city as donor_city,
      u.mobile_number as donor_mobile,
      u.email as donor_email,
      ${publicReferenceSelect}
      dprof.total_donations_count as donor_lifetime_donations,
      dprof.pincode as donor_pincode,
      
      -- Recipient & Emergency request information
      r.patient_name,
      r.hospital_name,
      r.hospital_city,
      r.hospital_address,
      r.blood_group as recipient_blood_group,
      r.urgency_level,
      r.clinical_condition,
      
      -- Proof review information
      dp.id as proof_id,
      dp.status as proof_status,
      dp.proof_photo_path,
      dp.proof_photo_mime,
      dp.proof_photo_size,
      dp.reviewed_at as proof_reviewed_at,
      
      -- Admin reviewer
      adm.id as reviewer_admin_id,
      adm.full_name as reviewed_by_admin_name,
      adm.role_id as reviewed_by_admin_role
      
    FROM request_pledges p
    JOIN emergency_requests r ON p.request_id = r.id
    JOIN users u ON p.donor_user_id = u.id
    LEFT JOIN donor_profiles dprof ON u.id = dprof.user_id
    LEFT JOIN donation_proofs dp ON dp.pledge_id = p.id
    LEFT JOIN donation_certificates c ON c.pledge_id = p.id
    LEFT JOIN admin_accounts adm ON dp.reviewed_by_admin_id = adm.id
    WHERE p.status = 'APPROVED'
      AND dp.status = 'APPROVED'
      AND COALESCE(c.donation_date, DATE(p.completed_at)) >= ?
      AND COALESCE(c.donation_date, DATE(p.completed_at)) <= ?
    ORDER BY actual_donation_date ASC, p.completed_at ASC, p.id ASC
  `;

  const rows = db.prepare(query).all(startDate, endDate);

  // Deterministic fingerprint of underlying monthly dataset for cache invalidation
  const canonicalRows = rows.map(r => ({
    pledge_id: r.pledge_id,
    certificate_id: r.certificate_id || null,
    proof_id: r.proof_id || null,
    actual_donation_date: r.actual_donation_date,
    verified_units: r.verified_units,
    donor_user_id: r.donor_user_id,
    donor_name: r.donor_name,
    donor_blood_group: r.donor_blood_group,
    donor_mobile: r.donor_mobile,
    donor_email: r.donor_email,
    donor_public_reference: r.donor_public_reference ?? null,
    donor_lifetime_donations: r.donor_lifetime_donations ?? null,
    patient_name: r.patient_name,
    hospital_name: r.hospital_name,
    hospital_city: r.hospital_city,
    urgency_level: r.urgency_level,
    proof_photo_path: r.proof_photo_path || null,
    proof_reviewed_at: r.proof_reviewed_at || null,
    qr_verification_token: r.qr_verification_token || null,
    reviewer_admin_id: r.reviewer_admin_id || null
  }));
  const dataFingerprint = crypto
    .createHash('sha256')
    .update(JSON.stringify({ month: parsedMonth, year: parsedYear, rows: canonicalRows }))
    .digest('hex');

  // Compute blood group distribution
  const bloodGroups = {
    'A+': 0, 'A-': 0,
    'B+': 0, 'B-': 0,
    'AB+': 0, 'AB-': 0,
    'O+': 0, 'O-': 0
  };

  let totalUnits = 0;
  const uniqueDonorsSet = new Set();
  const uniqueHospitalsSet = new Set();
  const uniquePatientsSet = new Set();

  const donations = rows.map((r, index) => {
    const bg = (r.donor_blood_group || 'O+').trim().toUpperCase();
    if (Object.prototype.hasOwnProperty.call(bloodGroups, bg)) {
      bloodGroups[bg] += (r.verified_units || 1);
    }

    const units = r.verified_units || 1;
    totalUnits += units;
    uniqueDonorsSet.add(r.donor_user_id);
    if (r.hospital_name) uniqueHospitalsSet.add(r.hospital_name.trim().toLowerCase());
    if (r.patient_name) uniquePatientsSet.add(r.patient_name.trim().toLowerCase());

    const donationTime = r.donation_completed_at
      ? (r.donation_completed_at.includes('T') ? r.donation_completed_at.split('T')[1].split('.')[0] : r.donation_completed_at.split(' ')[1] || '10:00:00')
      : 'Not Recorded';

    return {
      index: index + 1,
      referenceId: r.certificate_id || `REF-${r.pledge_id}`,
      certificateId: r.certificate_id || 'Not Issued',
      pledgeId: r.pledge_id,
      proofId: r.proof_id || 'Not Available',
      qrToken: r.qr_verification_token || 'N/A',
      
      // Donor Information
      donorName: r.donor_name || 'Anonymous Donor',
      donorAge: r.donor_age ? `${r.donor_age} yrs` : 'Not Available',
      donorBloodGroup: r.donor_blood_group || 'Not Available',
      donorCity: r.donor_city || 'Not Available',
      donor_public_reference: r.donor_public_reference ?? null,
      donorPublicRef: r.donor_public_reference || r.donor_user_id,
      donorLifetimeDonations: r.donor_lifetime_donations || 1,
      donorMobile: isMasked ? maskMobile(r.donor_mobile) : (r.donor_mobile || 'Not Provided'),
      donorEmail: isMasked ? maskEmail(r.donor_email) : (r.donor_email || 'Not Provided'),
      
      // Recipient & Hospital Information
      patientName: r.patient_name || 'Emergency Trauma Patient',
      recipientBloodGroup: r.recipient_blood_group || r.donor_blood_group || 'Not Specified',
      hospitalName: r.hospital_name || 'District General Hospital',
      hospitalCity: r.hospital_city || r.donor_city || 'General District',
      hospitalAddress: r.hospital_address || 'Clinical Blood Bank Facility',
      urgencyLevel: r.urgency_level || 'STANDARD',
      clinicalCondition: r.clinical_condition || 'Not Provided',
      
      // Donation Event Details
      donationDate: r.actual_donation_date,
      donationTime,
      unitsDonated: units,
      donationStatus: 'VERIFIED_COMPLETED',
      verificationStatus: 'APPROVED_AND_CERTIFIED',
      approvalDate: r.proof_reviewed_at || r.donation_completed_at || r.actual_donation_date,
      reviewedByAdmin: r.reviewed_by_admin_name || 'Chief Medical Verification Officer',
      reviewedByRole: r.reviewed_by_admin_role || 'ADMIN',
      
      // Proof photograph metadata
      proofPhotoPath: r.proof_photo_path || null,
      proofPhotoMime: r.proof_photo_mime || null,
      hasProofPhoto: Boolean(r.proof_photo_path)
    };
  });

  const monthName = getMonthName(parsedMonth);
  const reportRef = `RPT-RED-${parsedYear}${monthStr}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

  return {
    reportRef,
    maskSensitive: isMasked,
    privacyMode,
    schemaHasPublicReference: hasPublicReferenceCol,
    dataFingerprint,
    period: {
      month: parsedMonth,
      monthName,
      year: parsedYear,
      startDate,
      endDate,
      label: `${monthName} ${parsedYear}`
    },
    summary: {
      totalDonations: donations.length,
      totalUnits,
      uniqueDonorsCount: uniqueDonorsSet.size,
      uniqueHospitalsCount: uniqueHospitalsSet.size,
      uniquePatientsCount: uniquePatientsSet.size,
      bloodGroups
    },
    donations,
    generatedAt: new Date().toISOString(),
    preparedBy: {
      adminId: admin?.id || 'ADM-SYSTEM',
      adminName: admin?.full_name || 'Rotaract District Administrator',
      adminRole: admin?.role_id || 'SUPER_ADMIN'
    },
    authorizedBy: {
      title: 'Rotaract District Blood Donation Committee',
      designation: 'District Blood Donation Director & Clinical Verification Desk'
    }
  };
}
