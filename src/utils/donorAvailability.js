/**
 * RED MISSION — Frontend Donor Availability & Cooldown Formatting Helpers
 *
 * Uses Temporal.PlainDate where natively supported for location-agnostic YYYY-MM-DD
 * calendar dates without timezone drift, with an explicit IST Intl fallback for Safari/older browsers.
 */

export const MEDICAL_COOLDOWN_NOTE =
  '3-month recovery policy applies after verified donations. Not a substitute for hospital medical screening.';

const CALENDAR_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

const istDisplayFormatter = new Intl.DateTimeFormat('en-IN', {
  timeZone: 'Asia/Kolkata',
  day: 'numeric',
  month: 'short',
  year: 'numeric'
});

/**
 * Safely format a backend calendar date string (YYYY-MM-DD) or ISO timestamp for display
 * without local browser timezone shift (e.g. UTC-west browsers shifting YYYY-MM-DD back a day).
 */
export function formatCalendarDate(rawDate) {
  if (!rawDate) return null;
  const trimmed = String(rawDate).trim();
  if (!trimmed) return null;

  const ymdMatch = CALENDAR_DATE_PATTERN.exec(trimmed);
  if (ymdMatch) {
    const year = Number(ymdMatch[1]);
    const month = Number(ymdMatch[2]);
    const day = Number(ymdMatch[3]);

    if (typeof globalThis.Temporal !== 'undefined' && globalThis.Temporal?.PlainDate) {
      try {
        const plain = globalThis.Temporal.PlainDate.from({ year, month, day });
        const { year: y, month: m, day: d } = plain;
        const utcNoon = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
        return istDisplayFormatter.format(utcNoon);
      } catch {
        // Fall through to explicit UTC-noon formatter
      }
    }

    const utcNoon = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
    if (!Number.isNaN(utcNoon.getTime())) {
      return istDisplayFormatter.format(utcNoon);
    }
  }

  const sqliteMatch = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?)$/.exec(trimmed);
  const parsed = sqliteMatch ? new Date(`${sqliteMatch[1]}T${sqliteMatch[2]}Z`) : new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    return trimmed;
  }

  return istDisplayFormatter.format(parsed);
}

/**
 * Normalize availability metadata from any backend donor/profile payload.
 */
export function resolveDonorAvailability(donorOrProfile) {
  if (!donorOrProfile) {
    return {
      status: 'UNAVAILABLE',
      label: 'Unavailable',
      isAvailable: false,
      isInCooldown: false,
      reavailableDate: null,
      daysRemaining: 0,
      lastVerifiedDonationDate: null,
      reason: 'Donor profile unavailable.',
      medicalDisclaimer: MEDICAL_COOLDOWN_NOTE
    };
  }

  const avail = donorOrProfile.availability || null;
  if (avail) {
    return {
      status: avail.status || (avail.isInCooldown ? 'TEMPORARILY_UNAVAILABLE' : avail.isAvailable ? 'AVAILABLE' : 'UNAVAILABLE'),
      label: avail.label || (avail.isInCooldown ? 'Temporarily Unavailable' : avail.isAvailable ? 'Available' : 'Standby'),
      isAvailable: Boolean(avail.isAvailable),
      isInCooldown: Boolean(avail.isInCooldown),
      isEligibleForEmergencySelection: avail.isEligibleForEmergencySelection !== undefined ? Boolean(avail.isEligibleForEmergencySelection) : Boolean(avail.isAvailable),
      reavailableDate: avail.reavailableDate || null,
      daysRemaining: typeof avail.daysRemaining === 'number' ? avail.daysRemaining : 0,
      lastVerifiedDonationDate: avail.lastVerifiedDonationDate || null,
      lastSelfReportedDonationDate: avail.lastSelfReportedDonationDate || donorOrProfile.lastDonationDate || null,
      reasonCode: avail.reasonCode || null,
      reason: avail.reason || null,
      badgeText: avail.badgeText || (avail.isInCooldown ? '3-Month Cooldown' : avail.isAvailable ? 'Available' : 'Standby'),
      medicalDisclaimer: avail.medicalDisclaimer || MEDICAL_COOLDOWN_NOTE
    };
  }

  const isInCooldown = Boolean(donorOrProfile.isInCooldown || donorOrProfile.availabilityStatus === 'TEMPORARILY_UNAVAILABLE');
  const isAvailable =
    donorOrProfile.isAvailable !== undefined
      ? Boolean(donorOrProfile.isAvailable) && !isInCooldown
      : Boolean(donorOrProfile.isAvailableForEmergency) && !isInCooldown;

  return {
    status: isInCooldown ? 'TEMPORARILY_UNAVAILABLE' : isAvailable ? 'AVAILABLE' : 'UNAVAILABLE',
    label: donorOrProfile.availabilityLabel || (isInCooldown ? 'Temporarily Unavailable' : isAvailable ? 'Available' : 'Standby'),
    isAvailable,
    isInCooldown,
    isEligibleForEmergencySelection:
      donorOrProfile.isEligibleForEmergencySelection !== undefined
        ? Boolean(donorOrProfile.isEligibleForEmergencySelection)
        : isAvailable,
    reavailableDate: donorOrProfile.reavailableDate || null,
    daysRemaining: typeof donorOrProfile.daysRemaining === 'number' ? donorOrProfile.daysRemaining : 0,
    lastVerifiedDonationDate: donorOrProfile.lastVerifiedDonationDate || null,
    lastSelfReportedDonationDate: donorOrProfile.lastDonationDate || null,
    reasonCode: isInCooldown ? 'POST_DONATION_COOLDOWN' : isAvailable ? 'AVAILABLE' : 'DONOR_OPTED_OUT',
    reason: donorOrProfile.cooldownReason || null,
    badgeText: isInCooldown ? '3-Month Cooldown' : isAvailable ? 'Available' : 'Standby',
    medicalDisclaimer: donorOrProfile.medicalDisclaimer || MEDICAL_COOLDOWN_NOTE
  };
}
