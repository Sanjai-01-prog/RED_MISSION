import {
  evaluateDonorAvailability,
  getBulkDonorAvailability,
  getDonorAvailabilityStatus,
  getDonorProfileColumns,
  normalizeVerifiedDateToIstYmd,
  resolveEffectiveAge,
  tableExists,
  MEDICAL_ELIGIBILITY_DISCLAIMER
} from './donorAvailabilityService.js';

export const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
export const DONOR_ID_REGEX = /^[a-zA-Z0-9_-]{1,128}$/;

/**
 * Validates donor userId format to prevent injection or oversized input.
 */
export function isValidDonorId(userId) {
  return typeof userId === 'string' && DONOR_ID_REGEX.test(userId.trim());
}

/**
 * Queries non-terminal pledges and latest linked proof status for one or more donors.
 * Only used to surface Case 2 ("Pledge Submitted – Awaiting Donation Verification")
 * without altering donorAvailabilityService cooldown logic.
 */
function getActiveUnverifiedPledgeMap(db, userIds = null) {
  const map = new Map();
  if (!tableExists(db, 'request_pledges')) return map;

  const hasProofs = tableExists(db, 'donation_proofs');
  let rows = [];

  if (Array.isArray(userIds)) {
    if (userIds.length === 0) return map;
    const placeholders = userIds.map(() => '?').join(', ');
    if (hasProofs) {
      rows = db.prepare(`
        SELECT
          rp.id AS pledge_id,
          rp.request_id,
          rp.donor_user_id,
          rp.status AS pledge_status,
          rp.created_at,
          rp.proof_submitted_at,
          (
            SELECT dp.status
            FROM donation_proofs dp
            WHERE dp.pledge_id = rp.id
            ORDER BY COALESCE(dp.reviewed_at, dp.submitted_at) DESC, dp.rowid DESC
            LIMIT 1
          ) AS latest_proof_status
        FROM request_pledges rp
        WHERE rp.donor_user_id IN (${placeholders})
          AND rp.status IN ('PLEDGED', 'PROOF_PENDING', 'UNDER_REVIEW')
        ORDER BY rp.created_at DESC
      `).all(...userIds);
    } else {
      rows = db.prepare(`
        SELECT
          rp.id AS pledge_id,
          rp.request_id,
          rp.donor_user_id,
          rp.status AS pledge_status,
          rp.created_at,
          rp.proof_submitted_at,
          NULL AS latest_proof_status
        FROM request_pledges rp
        WHERE rp.donor_user_id IN (${placeholders})
          AND rp.status IN ('PLEDGED', 'PROOF_PENDING', 'UNDER_REVIEW')
        ORDER BY rp.created_at DESC
      `).all(...userIds);
    }
  } else if (hasProofs) {
    rows = db.prepare(`
      SELECT
        rp.id AS pledge_id,
        rp.request_id,
        rp.donor_user_id,
        rp.status AS pledge_status,
        rp.created_at,
        rp.proof_submitted_at,
        (
          SELECT dp.status
          FROM donation_proofs dp
          WHERE dp.pledge_id = rp.id
          ORDER BY COALESCE(dp.reviewed_at, dp.submitted_at) DESC, dp.rowid DESC
          LIMIT 1
        ) AS latest_proof_status
      FROM request_pledges rp
      WHERE rp.status IN ('PLEDGED', 'PROOF_PENDING', 'UNDER_REVIEW')
      ORDER BY rp.created_at DESC
    `).all();
  } else {
    rows = db.prepare(`
      SELECT
        rp.id AS pledge_id,
        rp.request_id,
        rp.donor_user_id,
        rp.status AS pledge_status,
        rp.created_at,
        rp.proof_submitted_at,
        NULL AS latest_proof_status
      FROM request_pledges rp
      WHERE rp.status IN ('PLEDGED', 'PROOF_PENDING', 'UNDER_REVIEW')
      ORDER BY rp.created_at DESC
    `).all();
  }

  for (const row of rows) {
    // A rejected or already approved proof is not awaiting verification
    if (row.latest_proof_status === 'APPROVED' || row.latest_proof_status === 'REJECTED') {
      continue;
    }
    if (!map.has(row.donor_user_id)) {
      map.set(row.donor_user_id, []);
    }
    map.get(row.donor_user_id).push({
      pledgeId: row.pledge_id,
      requestId: row.request_id,
      pledgeStatus: row.pledge_status,
      proofStatus: row.latest_proof_status || null,
      createdAt: row.created_at,
      proofSubmittedAt: row.proof_submitted_at || null
    });
  }

  return map;
}

/**
 * Resolves the authoritative donorAvailabilityService output plus active unverified pledge state
 * into the 5 required Super Admin availability cases.
 */
export function buildAvailabilityPresentation(availability, activeUnverifiedPledges = [], accountFlags = {}) {
  const isSuspended = Boolean(accountFlags.isSuspended) || availability.reasonCode === 'ACCOUNT_SUSPENDED';
  const isActive = accountFlags.isActive !== undefined
    ? Boolean(accountFlags.isActive)
    : availability.reasonCode !== 'ACCOUNT_INACTIVE';

  const daysRemaining = typeof availability.daysRemaining === 'number' ? availability.daysRemaining : 0;
  const countdownText = availability.isInCooldown
    ? `Eligible again in ${daysRemaining} ${daysRemaining === 1 ? 'day' : 'days'}.`
    : null;

  const baseCooldownMeta = {
    lastVerifiedDonationDate: availability.lastVerifiedDonationDate || null,
    nextEligibleDate: availability.reavailableDate || null,
    reavailableDate: availability.reavailableDate || null,
    daysRemaining: availability.isInCooldown ? daysRemaining : 0,
    countdownText,
    cooldownMonths: availability.cooldownMonths ?? 3,
    isInCooldown: Boolean(availability.isInCooldown),
    cooldownExpired: Boolean(availability.cooldownExpired),
    todayIstDate: availability.todayIstDate
  };

  // CASE 5a / 5b: Inactive or Suspended — must never be labelled available
  if (isSuspended || availability.reasonCode === 'ACCOUNT_SUSPENDED') {
    return {
      caseCode: 'CASE_5_SUSPENDED',
      badgeCategory: 'INACTIVE',
      badgeText: 'Suspended',
      title: 'Account Suspended',
      description: availability.reason || 'Donor account is currently suspended by administration.',
      accountStatusLabel: 'Suspended',
      accountStatusReason: availability.reason || 'Suspended by administration.',
      isAvailable: false,
      hasActiveUnverifiedPledge: activeUnverifiedPledges.length > 0,
      activePledgesCount: activeUnverifiedPledges.length,
      medicalDisclaimer: availability.medicalDisclaimer || MEDICAL_ELIGIBILITY_DISCLAIMER,
      ...baseCooldownMeta
    };
  }

  if (!isActive || availability.reasonCode === 'ACCOUNT_INACTIVE') {
    return {
      caseCode: 'CASE_5_INACTIVE',
      badgeCategory: 'INACTIVE',
      badgeText: 'Inactive',
      title: 'Account Inactive',
      description: availability.reason || 'Donor account is currently inactive.',
      accountStatusLabel: 'Inactive',
      accountStatusReason: availability.reason || 'Donor account has been marked inactive.',
      isAvailable: false,
      hasActiveUnverifiedPledge: activeUnverifiedPledges.length > 0,
      activePledgesCount: activeUnverifiedPledges.length,
      medicalDisclaimer: availability.medicalDisclaimer || MEDICAL_ELIGIBILITY_DISCLAIMER,
      ...baseCooldownMeta
    };
  }

  if (availability.reasonCode === 'AGE_INELIGIBLE') {
    return {
      caseCode: 'CASE_5_AGE_INELIGIBLE',
      badgeCategory: 'INACTIVE',
      badgeText: 'Ineligible (Age)',
      title: 'Ineligible – Age Requirement Not Met',
      description: availability.reason || 'Donor does not meet the 18–65 age eligibility criteria.',
      accountStatusLabel: 'Active (Age Ineligible)',
      accountStatusReason: availability.reason,
      isAvailable: false,
      hasActiveUnverifiedPledge: activeUnverifiedPledges.length > 0,
      activePledgesCount: activeUnverifiedPledges.length,
      medicalDisclaimer: availability.medicalDisclaimer || MEDICAL_ELIGIBILITY_DISCLAIMER,
      ...baseCooldownMeta
    };
  }

  // CASE 3: Verified donation within the last 3 months
  if (availability.isInCooldown || availability.reasonCode === 'POST_DONATION_COOLDOWN') {
    return {
      caseCode: 'CASE_3_RECENT_DONATION_COOLDOWN',
      badgeCategory: 'COOLDOWN',
      badgeText: `Cooldown (${daysRemaining}d left)`,
      title: 'Temporarily Unavailable – Recent Donation',
      description:
        'This donor has recently completed a verified donation and is temporarily unavailable for another donation request.',
      accountStatusLabel: 'Active',
      accountStatusReason: availability.reason,
      isAvailable: false,
      hasActiveUnverifiedPledge: activeUnverifiedPledges.length > 0,
      activePledgesCount: activeUnverifiedPledges.length,
      medicalDisclaimer: availability.medicalDisclaimer || MEDICAL_ELIGIBILITY_DISCLAIMER,
      ...baseCooldownMeta
    };
  }

  if (availability.reasonCode === 'DONOR_OPTED_OUT') {
    return {
      caseCode: 'STANDBY_OPTED_OUT',
      badgeCategory: 'INACTIVE',
      badgeText: 'Standby Off',
      title: 'Temporarily Opted Out of Emergency Standby',
      description: availability.reason || 'Donor has temporarily opted out of emergency standby requests.',
      accountStatusLabel: 'Active (Standby Opt-Out)',
      accountStatusReason: availability.reason,
      isAvailable: false,
      hasActiveUnverifiedPledge: activeUnverifiedPledges.length > 0,
      activePledgesCount: activeUnverifiedPledges.length,
      medicalDisclaimer: availability.medicalDisclaimer || MEDICAL_ELIGIBILITY_DISCLAIMER,
      ...baseCooldownMeta
    };
  }

  // CASE 2: Pledge submitted, donation not yet verified (cooldown NEVER started by pledge alone)
  if (availability.isAvailable && activeUnverifiedPledges.length > 0) {
    return {
      caseCode: 'CASE_2_PLEDGE_AWAITING_VERIFICATION',
      badgeCategory: 'PENDING_VERIFICATION',
      badgeText: 'Awaiting Verification',
      title: 'Pledge Submitted – Awaiting Donation Verification',
      description: 'The donor has pledged to donate. The donation has not yet been verified.',
      accountStatusLabel: 'Active',
      accountStatusReason: 'Eligible; active pledge awaiting proof verification.',
      isAvailable: true,
      hasActiveUnverifiedPledge: true,
      activePledgesCount: activeUnverifiedPledges.length,
      medicalDisclaimer: availability.medicalDisclaimer || MEDICAL_ELIGIBILITY_DISCLAIMER,
      ...baseCooldownMeta
    };
  }

  // CASE 4: 3-month cooldown completed
  if (availability.isAvailable && availability.cooldownExpired) {
    return {
      caseCode: 'CASE_4_COOLDOWN_COMPLETED',
      badgeCategory: 'AVAILABLE',
      badgeText: 'Available Again',
      title: 'Available Again',
      description:
        "The donor's 3-month post-donation cooldown period has ended. The donor is eligible to be considered for a new donation request.",
      accountStatusLabel: 'Active',
      accountStatusReason: '3-month cooldown completed.',
      isAvailable: true,
      hasActiveUnverifiedPledge: false,
      activePledgesCount: 0,
      medicalDisclaimer: availability.medicalDisclaimer || MEDICAL_ELIGIBILITY_DISCLAIMER,
      ...baseCooldownMeta
    };
  }

  // CASE 1: Eligible donor
  return {
    caseCode: 'CASE_1_ELIGIBLE',
    badgeCategory: 'AVAILABLE',
    badgeText: 'Available',
    title: 'Available to Donate',
    description: 'This donor is currently eligible to be considered for a blood donation request.',
    accountStatusLabel: 'Active',
    accountStatusReason: 'Donor account active and eligible.',
    isAvailable: Boolean(availability.isAvailable),
    hasActiveUnverifiedPledge: false,
    activePledgesCount: 0,
    medicalDisclaimer: availability.medicalDisclaimer || MEDICAL_ELIGIBILITY_DISCLAIMER,
    ...baseCooldownMeta
  };
}

/**
 * Translates raw database pledge and proof states into clear, accurate status labels.
 */
export function mapPledgeWorkflowStates(rawPledgeStatus, rawProofStatus) {
  if (rawPledgeStatus === 'APPROVED' && rawProofStatus === 'APPROVED') {
    return {
      pledgeStatusLabel: 'Donation Verified',
      donationCompletionLabel: 'Completed & Verified',
      proofVerificationLabel: 'Donation Verified',
      badgeTone: 'green',
      isVerifiedDonation: true
    };
  }

  if (rawPledgeStatus === 'APPROVED') {
    return {
      pledgeStatusLabel: 'Pledge Approved',
      donationCompletionLabel: 'Awaiting Proof Verification',
      proofVerificationLabel: rawProofStatus === 'PENDING' ? 'Under Verification' : 'Not Verified',
      badgeTone: 'amber',
      isVerifiedDonation: false
    };
  }

  if (rawPledgeStatus === 'UNDER_REVIEW' || (['PLEDGED', 'PROOF_PENDING'].includes(rawPledgeStatus) && rawProofStatus === 'PENDING')) {
    return {
      pledgeStatusLabel: 'Donation Proof Submitted',
      donationCompletionLabel: 'Under Verification',
      proofVerificationLabel: 'Under Verification',
      badgeTone: 'amber',
      isVerifiedDonation: false
    };
  }

  if (rawPledgeStatus === 'PROOF_PENDING') {
    return {
      pledgeStatusLabel: 'Pledge Accepted',
      donationCompletionLabel: 'Awaiting Donation',
      proofVerificationLabel: 'Not Submitted',
      badgeTone: 'amber',
      isVerifiedDonation: false
    };
  }

  if (rawPledgeStatus === 'PLEDGED') {
    return {
      pledgeStatusLabel: 'Pledge Submitted',
      donationCompletionLabel: 'Awaiting Donation',
      proofVerificationLabel: 'Not Submitted',
      badgeTone: 'amber',
      isVerifiedDonation: false
    };
  }

  if (rawPledgeStatus === 'REJECTED') {
    return {
      pledgeStatusLabel: rawProofStatus === 'REJECTED' ? 'Proof Rejected' : 'Pledge Rejected',
      donationCompletionLabel: 'Not Completed',
      proofVerificationLabel: rawProofStatus === 'REJECTED' ? 'Rejected' : 'Not Verified',
      badgeTone: 'red',
      isVerifiedDonation: false
    };
  }

  if (rawPledgeStatus === 'CANCELLED') {
    return {
      pledgeStatusLabel: 'Pledge Cancelled',
      donationCompletionLabel: 'Cancelled',
      proofVerificationLabel:
        rawProofStatus === 'REJECTED'
          ? 'Rejected'
          : rawProofStatus === 'PENDING'
            ? 'Under Verification'
            : 'Not Submitted',
      badgeTone: 'grey',
      isVerifiedDonation: false
    };
  }

  if (rawPledgeStatus === 'EXPIRED') {
    return {
      pledgeStatusLabel: 'Pledge Expired',
      donationCompletionLabel: 'Expired',
      proofVerificationLabel: rawProofStatus === 'REJECTED' ? 'Rejected' : 'Not Submitted',
      badgeTone: 'grey',
      isVerifiedDonation: false
    };
  }

  return {
    pledgeStatusLabel: rawPledgeStatus || 'Unknown',
    donationCompletionLabel: 'Unknown',
    proofVerificationLabel: rawProofStatus || 'Not Recorded',
    badgeTone: 'grey',
    isVerifiedDonation: false
  };
}

function buildDonorBaseSelectColumns(db) {
  const cols = new Set(getDonorProfileColumns(db) || []);
  return {
    cols,
    selectClause: `
      u.id AS user_id,
      u.full_name,
      u.mobile_number,
      u.email,
      u.age,
      u.date_of_birth,
      u.gender,
      COALESCE(NULLIF(TRIM(d.blood_group), ''), u.blood_group) AS blood_group,
      COALESCE(NULLIF(TRIM(d.city), ''), u.city) AS city,
      d.pincode,
      u.is_active,
      u.is_suspended,
      u.created_at AS user_created_at,
      d.created_at AS donor_registered_at,
      d.updated_at AS donor_updated_at,
      d.is_available_for_emergency,
      d.consent_emergency_alerts,
      d.last_donation_date,
      d.total_donations_count,
      d.profile_photo_path,
      ${cols.has('profile_photo_mime') ? 'd.profile_photo_mime' : 'NULL AS profile_photo_mime'},
      ${cols.has('profile_photo_size_bytes') ? 'd.profile_photo_size_bytes' : 'NULL AS profile_photo_size_bytes'},
      ${cols.has('profile_photo_updated_at') ? 'd.profile_photo_updated_at' : 'NULL AS profile_photo_updated_at'},
      ${cols.has('selfie_consent_given') ? 'd.selfie_consent_given' : '0 AS selfie_consent_given'},
      ${cols.has('selfie_consent_at') ? 'd.selfie_consent_at' : 'NULL AS selfie_consent_at'},
      ${cols.has('is_photo_public') ? 'd.is_photo_public' : '0 AS is_photo_public'},
      ${cols.has('consent_directory_listing') ? 'd.consent_directory_listing' : '0 AS consent_directory_listing'},
      ${cols.has('public_reference') ? 'd.public_reference' : 'NULL AS public_reference'}
    `
  };
}

/**
 * Returns the full Super Admin Donor Directory grouped across all 8 blood groups,
 * backed strictly by actual registered donor rows and donorAvailabilityService.
 */
export function getSuperAdminDonorDirectory(
  db,
  { bloodGroup = 'ALL', search = '', city = '', availability = 'ALL', referenceDate = null } = {}
) {
  const { selectClause } = buildDonorBaseSelectColumns(db);
  const rawRows = db.prepare(`
    SELECT ${selectClause}
    FROM donor_profiles d
    INNER JOIN users u ON d.user_id = u.id
    ORDER BY d.created_at DESC, u.full_name COLLATE NOCASE ASC
  `).all();

  const donorInputRows = rawRows.map((row) => ({
    ...row,
    id: row.user_id,
    has_donor_profile: 1
  }));

  const bulkAvailability = getBulkDonorAvailability(db, donorInputRows, { referenceDate });
  const activePledgeMap = getActiveUnverifiedPledgeMap(
    db,
    rawRows.map((r) => r.user_id)
  );

  // Also count verified donations per donor strictly from APPROVED pledge + APPROVED proof
  const verifiedCountMap = new Map();
  if (tableExists(db, 'request_pledges') && tableExists(db, 'donation_proofs')) {
    const countRows = db.prepare(`
      SELECT rp.donor_user_id, COUNT(DISTINCT rp.id) AS verified_count
      FROM request_pledges rp
      INNER JOIN donation_proofs dp ON dp.pledge_id = rp.id
      WHERE rp.status = 'APPROVED'
        AND dp.status = 'APPROVED'
      GROUP BY rp.donor_user_id
    `).all();
    for (const c of countRows) {
      verifiedCountMap.set(c.donor_user_id, Number(c.verified_count || 0));
    }
  }

  const bloodGroupCounts = {};
  for (const bg of BLOOD_GROUPS) {
    bloodGroupCounts[bg] = 0;
  }

  let availableTotalCount = 0;
  let unavailableTotalCount = 0;
  let pendingVerificationTotalCount = 0;
  let suspendedOrInactiveTotalCount = 0;

  const allDonorCards = rawRows.map((row) => {
    const bg = BLOOD_GROUPS.includes(row.blood_group) ? row.blood_group : row.blood_group;
    if (Object.prototype.hasOwnProperty.call(bloodGroupCounts, bg)) {
      bloodGroupCounts[bg] += 1;
    }

    const effectiveAge = resolveEffectiveAge(row.age, row.date_of_birth, referenceDate);
    const avail =
      bulkAvailability.get(row.user_id) ||
      evaluateDonorAvailability({
        hasDonorProfile: true,
        isActive: row.is_active === 1,
        isSuspended: row.is_suspended === 1,
        age: effectiveAge,
        isAvailableForEmergency: row.is_available_for_emergency === 1,
        latestVerifiedDonationDate: null,
        selfReportedLastDonationDate: row.last_donation_date,
        referenceDate
      });

    const activeUnverifiedPledges = activePledgeMap.get(row.user_id) || [];
    const presentation = buildAvailabilityPresentation(avail, activeUnverifiedPledges, {
      isActive: row.is_active === 1,
      isSuspended: row.is_suspended === 1
    });

    if (avail.isAvailable) {
      availableTotalCount += 1;
    } else {
      unavailableTotalCount += 1;
    }
    if (presentation.caseCode === 'CASE_2_PLEDGE_AWAITING_VERIFICATION') {
      pendingVerificationTotalCount += 1;
    }
    if (row.is_active !== 1 || row.is_suspended === 1) {
      suspendedOrInactiveTotalCount += 1;
    }

    const hasPhoto = Boolean(row.profile_photo_path && String(row.profile_photo_path).trim());

    return {
      userId: row.user_id,
      publicReference: row.public_reference || null,
      fullName: row.full_name,
      bloodGroup: bg,
      city: row.city || '',
      pincode: row.pincode || null,
      age: effectiveAge,
      dateOfBirth: row.date_of_birth || null,
      gender: row.gender || null,
      mobileNumber: row.mobile_number,
      email: row.email || null,
      hasPhoto,
      photoUrl: hasPhoto ? `/api/superadmin/donors/${encodeURIComponent(row.user_id)}/photo` : null,
      registeredAt: row.donor_registered_at || row.user_created_at || null,
      isActive: row.is_active === 1,
      isSuspended: row.is_suspended === 1,
      accountStatus: row.is_suspended === 1 ? 'SUSPENDED' : row.is_active === 1 ? 'ACTIVE' : 'INACTIVE',
      emergencyOptIn: row.is_available_for_emergency === 1,
      verifiedDonationsCount: verifiedCountMap.get(row.user_id) || 0,
      availability: avail,
      availabilityPresentation: presentation
    };
  });

  // Apply Super Admin filters cleanly
  const normalizedBg = typeof bloodGroup === 'string' && bloodGroup.trim() ? bloodGroup.trim().toUpperCase() : 'ALL';
  const normalizedAvail = typeof availability === 'string' && availability.trim() ? availability.trim().toUpperCase() : 'ALL';
  const searchLower = typeof search === 'string' ? search.trim().toLowerCase() : '';
  const cityLower = typeof city === 'string' ? city.trim().toLowerCase() : '';

  const filteredDonors = allDonorCards.filter((donor) => {
    if (normalizedBg !== 'ALL' && donor.bloodGroup !== normalizedBg) {
      return false;
    }
    if (normalizedAvail === 'AVAILABLE' && !donor.availability.isAvailable) {
      return false;
    }
    if (normalizedAvail === 'UNAVAILABLE' && donor.availability.isAvailable) {
      return false;
    }
    if (
      normalizedAvail === 'PENDING_VERIFICATION' &&
      donor.availabilityPresentation.caseCode !== 'CASE_2_PLEDGE_AWAITING_VERIFICATION'
    ) {
      return false;
    }
    if (cityLower && !(donor.city || '').toLowerCase().includes(cityLower)) {
      return false;
    }
    if (searchLower) {
      const matchName = (donor.fullName || '').toLowerCase().includes(searchLower);
      const matchCity = (donor.city || '').toLowerCase().includes(searchLower);
      const matchMobile = (donor.mobileNumber || '').toLowerCase().includes(searchLower);
      const matchEmail = (donor.email || '').toLowerCase().includes(searchLower);
      if (!matchName && !matchCity && !matchMobile && !matchEmail) {
        return false;
      }
    }
    return true;
  });

  // Build ordered groups across all 8 blood groups
  const groups = BLOOD_GROUPS.map((bg) => {
    const donorsInGroup = filteredDonors.filter((d) => d.bloodGroup === bg);
    return {
      bloodGroup: bg,
      registeredCount: bloodGroupCounts[bg] || 0,
      filteredCount: donorsInGroup.length,
      donors: donorsInGroup
    };
  });

  return {
    bloodGroups: BLOOD_GROUPS,
    bloodGroupCounts,
    summary: {
      totalRegisteredDonors: allDonorCards.length,
      filteredDonorsCount: filteredDonors.length,
      availableCount: availableTotalCount,
      unavailableCount: unavailableTotalCount,
      pendingVerificationCount: pendingVerificationTotalCount,
      suspendedOrInactiveCount: suspendedOrInactiveTotalCount
    },
    groups,
    donors: filteredDonors
  };
}

/**
 * Returns complete authorized donor profile, authoritative availability status,
 * full pledge history timeline, and verified donation history for Super Admin.
 */
export function getSuperAdminDonorDetail(db, userId, { referenceDate = null } = {}) {
  const trimmedId = typeof userId === 'string' ? userId.trim() : '';
  if (!isValidDonorId(trimmedId)) {
    return { errorCode: 'INVALID_DONOR_ID', status: 400 };
  }

  const { selectClause } = buildDonorBaseSelectColumns(db);
  const row = db.prepare(`
    SELECT ${selectClause}
    FROM donor_profiles d
    INNER JOIN users u ON d.user_id = u.id
    WHERE d.user_id = ?
    LIMIT 1
  `).get(trimmedId);

  if (!row) {
    return { errorCode: 'DONOR_NOT_FOUND', status: 404 };
  }

  const availability = getDonorAvailabilityStatus(db, trimmedId, { referenceDate });
  const activeUnverifiedPledges = getActiveUnverifiedPledgeMap(db, [trimmedId]).get(trimmedId) || [];
  const availabilityPresentation = buildAvailabilityPresentation(availability, activeUnverifiedPledges, {
    isActive: row.is_active === 1,
    isSuspended: row.is_suspended === 1
  });

  // Fetch complete Pledge History & Verified Donation History
  const hasPledges = tableExists(db, 'request_pledges');
  const hasRequests = tableExists(db, 'emergency_requests');
  const hasProofs = tableExists(db, 'donation_proofs');
  const hasCerts = tableExists(db, 'donation_certificates');
  const hasAdmins = tableExists(db, 'admin_accounts');

  const pledgeHistory = [];
  const verifiedDonationHistory = [];

  if (hasPledges) {
    const pledgeRows = db.prepare(`
      SELECT
        rp.id AS pledge_id,
        rp.request_id,
        rp.units_pledged,
        rp.status AS pledge_status,
        rp.cancel_reason,
        rp.proof_submitted_at,
        rp.reserved_at,
        rp.expires_at,
        rp.completed_at,
        rp.created_at AS pledge_created_at
        ${hasRequests ? `,
          er.patient_name,
          er.hospital_name,
          er.hospital_city,
          er.hospital_address,
          er.blood_group AS request_blood_group,
          er.units_requested,
          er.urgency_level,
          er.status AS request_status,
          er.required_by,
          er.contact_person` : ''}
      FROM request_pledges rp
      ${hasRequests ? 'LEFT JOIN emergency_requests er ON rp.request_id = er.id' : ''}
      WHERE rp.donor_user_id = ?
      ORDER BY rp.created_at DESC, rp.rowid DESC
    `).all(trimmedId);

    const proofByPledgeId = new Map();
    if (hasProofs) {
      const proofRows = db.prepare(`
        SELECT
          dp.id AS proof_id,
          dp.pledge_id,
          dp.status AS proof_status,
          dp.rejection_reason,
          dp.reviewed_by_admin_id,
          dp.reviewed_at,
          dp.submitted_at
          ${hasAdmins ? ', aa.full_name AS reviewed_by_admin_name' : ''}
        FROM donation_proofs dp
        ${hasAdmins ? 'LEFT JOIN admin_accounts aa ON dp.reviewed_by_admin_id = aa.id' : ''}
        WHERE dp.donor_user_id = ?
        ORDER BY
          CASE WHEN dp.status = 'APPROVED' THEN 0 WHEN dp.status = 'PENDING' THEN 1 ELSE 2 END,
          COALESCE(dp.reviewed_at, dp.submitted_at) DESC,
          dp.rowid DESC
      `).all(trimmedId);

      for (const p of proofRows) {
        if (!proofByPledgeId.has(p.pledge_id)) {
          proofByPledgeId.set(p.pledge_id, p);
        }
      }
    }

    const certByPledgeId = new Map();
    const certByProofId = new Map();
    if (hasCerts) {
      const certRows = db.prepare(`
        SELECT id, proof_id, pledge_id, blood_group, hospital_name, donation_date, units_donated, qr_verification_token, issued_at
        FROM donation_certificates
        WHERE donor_user_id = ?
        ORDER BY issued_at DESC, rowid DESC
      `).all(trimmedId);

      for (const c of certRows) {
        if (c.pledge_id && !certByPledgeId.has(c.pledge_id)) {
          certByPledgeId.set(c.pledge_id, c);
        }
        if (c.proof_id && !certByProofId.has(c.proof_id)) {
          certByProofId.set(c.proof_id, c);
        }
      }
    }

    for (const pr of pledgeRows) {
      const proof = proofByPledgeId.get(pr.pledge_id) || null;
      const cert = certByPledgeId.get(pr.pledge_id) || (proof ? certByProofId.get(proof.proof_id) : null) || null;
      const mappedStates = mapPledgeWorkflowStates(pr.pledge_status, proof ? proof.proof_status : null);

      pledgeHistory.push({
        pledgeId: pr.pledge_id,
        requestId: pr.request_id,
        recipientDetails: {
          patientName: pr.patient_name || null,
          bloodGroup: pr.request_blood_group || null,
          urgencyLevel: pr.urgency_level || null,
          unitsRequested: pr.units_requested ?? null,
          unitsPledged: pr.units_pledged ?? 1,
          requestStatus: pr.request_status || null,
          requiredBy: pr.required_by || null,
          contactPerson: pr.contact_person || null
        },
        hospitalName: pr.hospital_name || cert?.hospital_name || null,
        hospitalCity: pr.hospital_city || null,
        hospitalAddress: pr.hospital_address || null,
        pledgeCreatedAt: pr.pledge_created_at || null,
        reservedAt: pr.reserved_at || null,
        expiresAt: pr.expires_at || null,
        proofSubmittedAt: pr.proof_submitted_at || proof?.submitted_at || null,
        completedAt: pr.completed_at || null,
        cancelReason: pr.cancel_reason || null,
        rawPledgeStatus: pr.pledge_status,
        rawProofStatus: proof ? proof.proof_status : null,
        proofId: proof ? proof.proof_id : null,
        proofRejectionReason: proof?.rejection_reason || null,
        proofReviewedAt: proof?.reviewed_at || null,
        proofReviewedByName: proof?.reviewed_by_admin_name || null,
        certificateId: cert?.id || null,
        certificateQrToken: cert?.qr_verification_token || null,
        pledgeStatusLabel: mappedStates.pledgeStatusLabel,
        donationCompletionLabel: mappedStates.donationCompletionLabel,
        proofVerificationLabel: mappedStates.proofVerificationLabel,
        badgeTone: mappedStates.badgeTone,
        isVerifiedDonation: mappedStates.isVerifiedDonation
      });

      // ONLY an APPROVED pledge with an APPROVED proof counts as a verified donation
      if (mappedStates.isVerifiedDonation && proof) {
        const verifiedTimestamp = proof.reviewed_at || pr.completed_at || cert?.issued_at || null;
        const donationDateYmd = normalizeVerifiedDateToIstYmd(
          proof.reviewed_at || pr.completed_at || cert?.donation_date
        );

        verifiedDonationHistory.push({
          pledgeId: pr.pledge_id,
          proofId: proof.proof_id,
          requestId: pr.request_id,
          donationDate: donationDateYmd,
          verifiedAt: verifiedTimestamp,
          certificateDonationDate: cert?.donation_date || null,
          unitsDonated: cert?.units_donated ?? pr.units_pledged ?? 1,
          recipientDetails: {
            patientName: pr.patient_name || null,
            bloodGroup: pr.request_blood_group || cert?.blood_group || null,
            urgencyLevel: pr.urgency_level || null
          },
          hospitalName: pr.hospital_name || cert?.hospital_name || null,
          hospitalCity: pr.hospital_city || null,
          hospitalAddress: pr.hospital_address || null,
          proofVerificationStatus: 'Donation Verified',
          rawProofStatus: proof.proof_status,
          verifiedByAdminName: proof.reviewed_by_admin_name || null,
          certificate: cert
            ? {
                id: cert.id,
                qrVerificationToken: cert.qr_verification_token || null,
                issuedAt: cert.issued_at || null,
                donationDate: cert.donation_date || null,
                hospitalName: cert.hospital_name || null
              }
            : null
        });
      }
    }

    // Sort verified donation history strictly by authoritative IST donation date desc, then verified timestamp desc
    verifiedDonationHistory.sort((a, b) => {
      const dateA = a.donationDate || '';
      const dateB = b.donationDate || '';
      if (dateA !== dateB) return dateB.localeCompare(dateA);
      const tsA = a.verifiedAt || '';
      const tsB = b.verifiedAt || '';
      return tsB.localeCompare(tsA);
    });
  }

  const latestVerifiedDonation = verifiedDonationHistory.length > 0 ? verifiedDonationHistory[0] : null;
  const hasPhoto = Boolean(row.profile_photo_path && String(row.profile_photo_path).trim());
  const effectiveAge = resolveEffectiveAge(row.age, row.date_of_birth, referenceDate);

  return {
    donor: {
      userId: row.user_id,
      publicReference: row.public_reference || null,
      fullName: row.full_name,
      bloodGroup: row.blood_group,
      age: effectiveAge,
      dateOfBirth: row.date_of_birth || null,
      gender: row.gender || null,
      mobileNumber: row.mobile_number,
      email: row.email || null,
      city: row.city || '',
      pincode: row.pincode || null,
      registrationDate: row.donor_registered_at || row.user_created_at || null,
      accountCreatedAt: row.user_created_at || null,
      donorProfileCreatedAt: row.donor_registered_at || null,
      donorProfileUpdatedAt: row.donor_updated_at || null,
      isActive: row.is_active === 1,
      isSuspended: row.is_suspended === 1,
      accountStatus: row.is_suspended === 1 ? 'SUSPENDED' : row.is_active === 1 ? 'ACTIVE' : 'INACTIVE',
      emergencyOptIn: row.is_available_for_emergency === 1,
      consentEmergencyAlerts: row.consent_emergency_alerts === 1,
      consentDirectoryListing: row.consent_directory_listing === 1,
      hasPhoto,
      photoUrl: hasPhoto ? `/api/superadmin/donors/${encodeURIComponent(row.user_id)}/photo` : null,
      profilePhotoMime: row.profile_photo_mime || null,
      profilePhotoSizeBytes: row.profile_photo_size_bytes ?? null,
      profilePhotoUpdatedAt: row.profile_photo_updated_at || null,
      selfieConsentGiven: row.selfie_consent_given === 1,
      selfieConsentAt: row.selfie_consent_at || null,
      isPhotoPublic: row.is_photo_public === 1,
      selfReportedLastDonationDate: row.last_donation_date || null,
      storedDonationsCount: Number(row.total_donations_count || 0),
      verifiedDonationsCount: verifiedDonationHistory.length
    },
    availability,
    availabilityPresentation,
    latestVerifiedDonation,
    pledgeHistory,
    verifiedDonationHistory
  };
}
