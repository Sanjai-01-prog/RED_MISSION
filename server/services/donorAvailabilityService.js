/**
 * RED MISSION — Donor Re-availability & Three-Month Cooldown Service
 * Phase 6, Feature 3: Evidence-Based Donor Recovery & Eligibility Policy
 *
 * Policy & Safety Model:
 * - Cooldown triggers ONLY from authoritative verified blood donations
 *   (request_pledges.status = 'APPROVED' AND donation_proofs.status = 'APPROVED').
 * - Unverified self-reported last_donation_date, active PLEDGED reservations,
 *   PENDING/UNDER_REVIEW proofs, REJECTED proofs, or CANCELLED pledges do NOT start cooldown.
 * - Cooldown lasts 3 calendar months from the verified donation calendar date (Asia/Kolkata),
 *   handling month-end dates and leap years consistently without 90*86400s drift.
 * - During cooldown, donor availability resolves to TEMPORARILY_UNAVAILABLE and cannot be
 *   selected for emergency requests or create new pledges.
 * - Application cooldown completion is NOT medical clearance; hospital screening, donor health,
 *   account status, opt-out flags, and admin review always take precedence.
 */

export const COOLDOWN_MONTHS = 3;
export const IST_TIMEZONE = 'Asia/Kolkata';

export const MEDICAL_ELIGIBILITY_DISCLAIMER =
  'Application 3-calendar-month recovery policy applies after verified whole blood donations. Availability indicates policy cooldown completion only and is not medical clearance; hospital clinical screening, donor health, and admin verification take precedence.';

const YMD_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const SQLITE_UTC_DATETIME_PATTERN = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?)$/;

const istDatePartsFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: IST_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
});

const RBC_RECIPIENT_COMPATIBILITY = {
  'O-': ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'],
  'O+': ['O+', 'A+', 'B+', 'AB+'],
  'A-': ['A-', 'A+', 'AB-', 'AB+'],
  'A+': ['A+', 'AB+'],
  'B-': ['B-', 'B+', 'AB-', 'AB+'],
  'B+': ['B+', 'AB+'],
  'AB-': ['AB-', 'AB+'],
  'AB+': ['AB+']
};

export function isGregorianLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function getDaysInMonth(year, month) {
  const lengths = [
    31,
    isGregorianLeapYear(year) ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31
  ];
  return lengths[month - 1] || 0;
}

export function parseStrictYmd(value) {
  if (typeof value !== 'string') return null;
  const match = YMD_PATTERN.exec(value.trim());
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  if (month < 1 || month > 12) return null;
  const maxDays = getDaysInMonth(year, month);
  if (day < 1 || day > maxDays) return null;

  return { year, month, day };
}

export function formatYmdParts(year, month, day) {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function formatDateToIstYmd(dateObj) {
  if (!(dateObj instanceof Date) || Number.isNaN(dateObj.getTime())) {
    return null;
  }
  const parts = istDatePartsFormatter.formatToParts(dateObj);
  const map = {};
  for (const part of parts) {
    if (part.type !== 'literal') {
      map[part.type] = part.value;
    }
  }
  if (!map.year || !map.month || !map.day) return null;
  return `${map.year}-${map.month}-${map.day}`;
}

/**
 * Resolve reference date/now into canonical Asia/Kolkata calendar date YYYY-MM-DD.
 * Accepts a YYYY-MM-DD string, ISO/SQLite timestamp, or Date instance.
 */
export function getTodayIstDateString(referenceDate = new Date()) {
  if (typeof referenceDate === 'string') {
    const strict = parseStrictYmd(referenceDate);
    if (strict) {
      return formatYmdParts(strict.year, strict.month, strict.day);
    }
    const normalized = normalizeVerifiedDateToIstYmd(referenceDate);
    if (normalized) return normalized;
  }
  if (referenceDate instanceof Date && !Number.isNaN(referenceDate.getTime())) {
    return formatDateToIstYmd(referenceDate);
  }
  return formatDateToIstYmd(new Date());
}

/**
 * Normalize verified timestamps or calendar dates into Asia/Kolkata YYYY-MM-DD.
 * Pure YYYY-MM-DD values are preserved verbatim to prevent timezone-offset drift.
 * SQLite UTC timestamps (YYYY-MM-DD HH:MM:SS) are interpreted as UTC and converted to IST.
 */
export function normalizeVerifiedDateToIstYmd(rawValue) {
  if (rawValue === null || rawValue === undefined) return null;

  if (rawValue instanceof Date) {
    return formatDateToIstYmd(rawValue);
  }

  if (typeof rawValue !== 'string') return null;
  const trimmed = rawValue.trim();
  if (!trimmed) return null;

  const exactYmd = parseStrictYmd(trimmed);
  if (exactYmd) {
    return formatYmdParts(exactYmd.year, exactYmd.month, exactYmd.day);
  }

  const sqliteUtcMatch = SQLITE_UTC_DATETIME_PATTERN.exec(trimmed);
  if (sqliteUtcMatch) {
    const parsedUtc = new Date(`${sqliteUtcMatch[1]}T${sqliteUtcMatch[2]}Z`);
    return formatDateToIstYmd(parsedUtc);
  }

  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) {
    return formatDateToIstYmd(parsed);
  }

  return null;
}

/**
 * Add calendar months to a YYYY-MM-DD date with month-end clamping (e.g., Nov 30 + 3 -> Feb 28/29).
 */
export function addCalendarMonths(ymd, monthsToAdd = COOLDOWN_MONTHS) {
  const parts = parseStrictYmd(ymd);
  if (!parts) {
    throw new TypeError(`Invalid YYYY-MM-DD date: "${ymd}"`);
  }

  const totalMonths = parts.year * 12 + (parts.month - 1) + monthsToAdd;
  const targetYear = Math.floor(totalMonths / 12);
  const targetMonth = (((totalMonths % 12) + 12) % 12) + 1;
  const maxDay = getDaysInMonth(targetYear, targetMonth);
  const targetDay = Math.min(parts.day, maxDay);

  return formatYmdParts(targetYear, targetMonth, targetDay);
}

/**
 * Exact calendar day difference (toYmd - fromYmd) free from local DST shifts.
 */
export function diffCalendarDays(fromYmd, toYmd) {
  const fromParts = parseStrictYmd(fromYmd);
  const toParts = parseStrictYmd(toYmd);
  if (!fromParts || !toParts) return null;

  const fromUtc = Date.UTC(fromParts.year, fromParts.month - 1, fromParts.day);
  const toUtc = Date.UTC(toParts.year, toParts.month - 1, toParts.day);
  return Math.round((toUtc - fromUtc) / 86400000);
}

/**
 * Calculate dynamic age from Date of Birth string (YYYY-MM-DD) evaluated in Asia/Kolkata timezone.
 * Returns null if dobString is invalid or null. Returns -1 if the date is in the future.
 */
export function calculateAgeFromDob(dobString, referenceDate = new Date()) {
  if (!dobString || typeof dobString !== 'string') return null;
  const parts = parseStrictYmd(dobString.trim());
  if (!parts) return null;

  const todayIst = getTodayIstDateString(referenceDate);
  if (todayIst < dobString.trim()) {
    return -1; // Future date indicator
  }

  const currParts = parseStrictYmd(todayIst);
  if (!currParts) return null;

  let age = currParts.year - parts.year;
  if (currParts.month < parts.month || (currParts.month === parts.month && currParts.day < parts.day)) {
    age -= 1;
  }
  return age;
}

/**
 * Resolves the effective age of a user:
 * Uses calculated age if date_of_birth is present and valid;
 * Falls back to legacy numeric age column if date_of_birth is null/undefined.
 */
export function resolveEffectiveAge(storedAge, dateOfBirth, referenceDate = new Date()) {
  if (dateOfBirth && typeof dateOfBirth === 'string' && dateOfBirth.trim()) {
    const computed = calculateAgeFromDob(dateOfBirth.trim(), referenceDate);
    if (computed !== null && computed >= 0) {
      return computed;
    }
  }
  if (storedAge !== null && storedAge !== undefined && storedAge !== '') {
    const num = Number(storedAge);
    if (!Number.isNaN(num)) return num;
  }
  return null;
}

/**
 * Pure policy evaluation combining account status, emergency opt-in, age bounds, and 3-month verified cooldown.
 */
export function evaluateDonorAvailability({
  hasDonorProfile = true,
  isActive = true,
  isSuspended = false,
  age = null,
  isAvailableForEmergency = true,
  latestVerifiedDonationDate = null,
  selfReportedLastDonationDate = null,
  referenceDate = new Date()
} = {}) {
  const todayIstDate = getTodayIstDateString(referenceDate);
  const verifiedYmd = normalizeVerifiedDateToIstYmd(latestVerifiedDonationDate);
  const reavailableDate = verifiedYmd ? addCalendarMonths(verifiedYmd, COOLDOWN_MONTHS) : null;

  const isInCooldown = Boolean(verifiedYmd && reavailableDate && todayIstDate < reavailableDate);
  const daysRemaining = isInCooldown
    ? Math.max(0, diffCalendarDays(todayIstDate, reavailableDate) || 0)
    : 0;
  const cooldownExpired = Boolean(verifiedYmd && reavailableDate && todayIstDate >= reavailableDate);

  const selfReportedYmd = normalizeVerifiedDateToIstYmd(selfReportedLastDonationDate);
  const active = isActive === true || isActive === 1;
  const suspended = isSuspended === true || isSuspended === 1;
  const numericAge = age === null || age === undefined || age === '' ? null : Number(age);
  const ageOutOfRange = numericAge !== null && !Number.isNaN(numericAge) && (numericAge < 18 || numericAge > 65);
  const emergencyOptIn = isAvailableForEmergency === true || isAvailableForEmergency === 1;

  const canSelfPledge = Boolean(active && !suspended && !ageOutOfRange && !isInCooldown);

  const base = {
    todayIstDate,
    cooldownMonths: COOLDOWN_MONTHS,
    isInCooldown,
    cooldownExpired,
    lastVerifiedDonationDate: verifiedYmd,
    lastSelfReportedDonationDate: selfReportedYmd,
    reavailableDate,
    daysRemaining,
    emergencyOptIn,
    canSelfPledge,
    medicalDisclaimer: MEDICAL_ELIGIBILITY_DISCLAIMER
  };

  if (suspended) {
    return {
      ...base,
      status: 'UNAVAILABLE',
      label: 'Suspended',
      isAvailable: false,
      isEligibleForEmergencySelection: false,
      reasonCode: 'ACCOUNT_SUSPENDED',
      reason: 'Donor account is currently suspended.',
      badgeText: 'Account Suspended'
    };
  }

  if (!active) {
    return {
      ...base,
      status: 'UNAVAILABLE',
      label: 'Inactive',
      isAvailable: false,
      isEligibleForEmergencySelection: false,
      reasonCode: 'ACCOUNT_INACTIVE',
      reason: 'Donor account is inactive.',
      badgeText: 'Account Inactive'
    };
  }

  if (ageOutOfRange) {
    return {
      ...base,
      status: 'UNAVAILABLE',
      label: 'Ineligible (Age)',
      isAvailable: false,
      isEligibleForEmergencySelection: false,
      reasonCode: 'AGE_INELIGIBLE',
      reason: 'Voluntary blood donors must be aged between 18 and 65 years.',
      badgeText: 'Age Policy Restriction'
    };
  }

  if (!hasDonorProfile) {
    return {
      ...base,
      status: isInCooldown ? 'TEMPORARILY_UNAVAILABLE' : 'NOT_ENLISTED',
      label: isInCooldown ? 'Temporarily Unavailable' : 'Not Enlisted',
      isAvailable: false,
      isEligibleForEmergencySelection: false,
      reasonCode: isInCooldown ? 'POST_DONATION_COOLDOWN' : 'DONOR_PROFILE_REQUIRED',
      reason: isInCooldown
        ? `Temporarily unavailable due to recent verified blood donation on ${verifiedYmd}. Re-available on ${reavailableDate} (${daysRemaining} day${daysRemaining === 1 ? '' : 's'} remaining).`
        : 'User has not enlisted a voluntary donor profile yet.',
      badgeText: isInCooldown ? '3-Month Cooldown' : 'Citizen Account'
    };
  }

  if (isInCooldown) {
    return {
      ...base,
      status: 'TEMPORARILY_UNAVAILABLE',
      label: 'Temporarily Unavailable',
      isAvailable: false,
      isEligibleForEmergencySelection: false,
      reasonCode: 'POST_DONATION_COOLDOWN',
      reason: `Temporarily unavailable due to recent verified blood donation on ${verifiedYmd}. Re-available on ${reavailableDate} (${daysRemaining} day${daysRemaining === 1 ? '' : 's'} remaining).`,
      badgeText: '3-Month Cooldown'
    };
  }

  if (!emergencyOptIn) {
    return {
      ...base,
      status: 'UNAVAILABLE',
      label: 'Standby',
      isAvailable: false,
      isEligibleForEmergencySelection: false,
      reasonCode: 'DONOR_OPTED_OUT',
      reason: 'Donor has set emergency dispatch availability to standby.',
      badgeText: 'Standby'
    };
  }

  return {
    ...base,
    status: 'AVAILABLE',
    label: 'Available',
    isAvailable: true,
    isEligibleForEmergencySelection: true,
    reasonCode: 'AVAILABLE',
    reason: cooldownExpired
      ? `3-month recovery period completed on ${reavailableDate}. Available subject to hospital medical screening.`
      : 'Available for emergency blood requests, subject to hospital medical screening.',
    badgeText: 'Available'
  };
}

export function tableExists(db, tableName) {
  if (!db || !tableName) return false;
  try {
    const row = db
      .prepare("SELECT 1 AS found FROM sqlite_master WHERE type = 'table' AND name = ?")
      .get(tableName);
    return Boolean(row && row.found === 1);
  } catch {
    return false;
  }
}

export function getDonorProfileColumns(db) {
  try {
    return db.prepare('PRAGMA table_info(donor_profiles)').all().map((c) => c.name);
  } catch {
    return [];
  }
}

/**
 * Query latest authoritative verified blood donation per user from request_pledges + donation_proofs.
 * Unverified pledges (PLEDGED, PROOF_PENDING, UNDER_REVIEW, CANCELLED, EXPIRED, REJECTED),
 * unapproved proofs (PENDING, REJECTED), and self-reported donor_profiles.last_donation_date are ignored.
 */
export function getVerifiedDonationMap(db, userIds = null) {
  const result = new Map();
  if (!db) return result;

  if (Array.isArray(userIds) && userIds.length === 0) {
    return result;
  }

  if (!tableExists(db, 'request_pledges') || !tableExists(db, 'donation_proofs')) {
    return result;
  }

  const hasCertificatesTable = tableExists(db, 'donation_certificates');
  const certSelect = hasCertificatesTable
    ? 'c.id AS certificate_id, c.donation_date AS certificate_donation_date'
    : 'NULL AS certificate_id, NULL AS certificate_donation_date';
  const certJoin = hasCertificatesTable
    ? 'LEFT JOIN donation_certificates c ON c.pledge_id = p.id'
    : '';

  const baseSelect = `
    SELECT
      p.donor_user_id,
      p.id AS pledge_id,
      p.request_id,
      p.completed_at,
      dp.id AS proof_id,
      dp.reviewed_at,
      ${certSelect}
    FROM request_pledges p
    JOIN donation_proofs dp ON dp.pledge_id = p.id
    ${certJoin}
    WHERE p.status = 'APPROVED'
      AND dp.status = 'APPROVED'
  `;

  let rows = [];
  if (Array.isArray(userIds)) {
    const uniqueIds = [...new Set(userIds.filter(Boolean))];
    const chunkSize = 200;
    for (let i = 0; i < uniqueIds.length; i += chunkSize) {
      const chunk = uniqueIds.slice(i, i + chunkSize);
      const placeholders = chunk.map(() => '?').join(', ');
      const chunkRows = db
        .prepare(`${baseSelect} AND p.donor_user_id IN (${placeholders})`)
        .all(...chunk);
      rows.push(...chunkRows);
    }
  } else {
    rows = db.prepare(baseSelect).all();
  }

  for (const row of rows) {
    const donationDateYmd =
      normalizeVerifiedDateToIstYmd(row.completed_at) ||
      normalizeVerifiedDateToIstYmd(row.reviewed_at) ||
      normalizeVerifiedDateToIstYmd(row.certificate_donation_date);

    if (!donationDateYmd) continue;

    const rawOrderKey = String(row.completed_at || row.reviewed_at || row.certificate_donation_date || '');
    const existing = result.get(row.donor_user_id);

    if (
      !existing ||
      donationDateYmd > existing.donationDateYmd ||
      (donationDateYmd === existing.donationDateYmd && rawOrderKey > existing.rawOrderKey)
    ) {
      result.set(row.donor_user_id, {
        donorUserId: row.donor_user_id,
        pledgeId: row.pledge_id,
        requestId: row.request_id,
        proofId: row.proof_id,
        certificateId: row.certificate_id || null,
        donationDateYmd,
        completedAt: row.completed_at || null,
        reviewedAt: row.reviewed_at || null,
        certificateDonationDate: row.certificate_donation_date || null,
        rawOrderKey
      });
    }
  }

  return result;
}

/**
 * Compute full availability & cooldown status for a single user ID from the database.
 */
export function getDonorAvailabilityStatus(db, userId, { referenceDate = new Date() } = {}) {
  if (!db || !userId) {
    return evaluateDonorAvailability({ hasDonorProfile: false, isActive: false, referenceDate });
  }

  const row = db
    .prepare(`
      SELECT
        u.id AS user_id,
        u.is_active,
        u.is_suspended,
        u.age,
        u.date_of_birth,
        d.user_id AS donor_profile_user_id,
        d.is_available_for_emergency,
        d.last_donation_date,
        d.total_donations_count
      FROM users u
      LEFT JOIN donor_profiles d ON d.user_id = u.id
      WHERE u.id = ?
    `)
    .get(userId);

  if (!row) {
    return evaluateDonorAvailability({ hasDonorProfile: false, isActive: false, referenceDate });
  }

  const verifiedMap = getVerifiedDonationMap(db, [userId]);
  const latestVerified = verifiedMap.get(userId) || null;
  const effectiveAge = resolveEffectiveAge(row.age, row.date_of_birth, referenceDate);

  const availability = evaluateDonorAvailability({
    hasDonorProfile: Boolean(row.donor_profile_user_id),
    isActive: row.is_active === 1,
    isSuspended: row.is_suspended === 1,
    age: effectiveAge,
    isAvailableForEmergency: row.donor_profile_user_id ? row.is_available_for_emergency === 1 : true,
    latestVerifiedDonationDate: latestVerified ? latestVerified.donationDateYmd : null,
    selfReportedLastDonationDate: row.last_donation_date || null,
    referenceDate
  });

  return {
    userId,
    age: effectiveAge,
    verifiedDonation: latestVerified,
    ...availability
  };
}

/**
 * Batch evaluate availability for an array of DB donor rows (keyed by row.user_id or row.id).
 */
export function getBulkDonorAvailability(db, donorRows = [], { referenceDate = new Date() } = {}) {
  const availabilityMap = new Map();
  if (!db || !Array.isArray(donorRows) || donorRows.length === 0) {
    return availabilityMap;
  }

  const userIds = donorRows.map((r) => r.user_id || r.donor_user_id || r.id).filter(Boolean);
  const verifiedMap = getVerifiedDonationMap(db, userIds);

  for (const row of donorRows) {
    const uid = row.user_id || row.donor_user_id || row.id;
    if (!uid) continue;

    const latestVerified = verifiedMap.get(uid) || null;
    const hasProfile =
      row.has_donor_profile !== undefined
        ? Boolean(row.has_donor_profile)
        : row.is_available_for_emergency !== undefined || row.donor_profile_user_id !== undefined;

    const effectiveAge = resolveEffectiveAge(
      row.age !== undefined ? row.age : null,
      row.date_of_birth || row.donor_dob || null,
      referenceDate
    );

    const evaluated = evaluateDonorAvailability({
      hasDonorProfile: hasProfile,
      isActive: row.is_active === undefined ? true : row.is_active === 1 || row.is_active === true,
      isSuspended: row.is_suspended === 1 || row.is_suspended === true,
      age: effectiveAge,
      isAvailableForEmergency:
        row.is_available_for_emergency === undefined
          ? true
          : row.is_available_for_emergency === 1 || row.is_available_for_emergency === true,
      latestVerifiedDonationDate: latestVerified ? latestVerified.donationDateYmd : null,
      selfReportedLastDonationDate: row.last_donation_date || null,
      referenceDate
    });

    availabilityMap.set(uid, {
      userId: uid,
      age: effectiveAge,
      verifiedDonation: latestVerified,
      ...evaluated
    });
  }

  return availabilityMap;
}

/**
 * Standard whole-blood RBC ABO/Rh compatibility check.
 */
export function isBloodGroupCompatible(donorBloodGroup, recipientBloodGroup) {
  const donor = typeof donorBloodGroup === 'string' ? donorBloodGroup.trim().toUpperCase() : '';
  const recipient = typeof recipientBloodGroup === 'string' ? recipientBloodGroup.trim().toUpperCase() : '';
  if (!donor || !recipient) return false;
  if (donor === recipient) return true;
  const compatibleRecipients = RBC_RECIPIENT_COMPATIBILITY[donor];
  return Array.isArray(compatibleRecipients) ? compatibleRecipients.includes(recipient) : false;
}
