/**
 * RED MISSION — Persistent Website Launch Timer Utilities
 *
 * Uses Temporal (with feature-detected temporal-polyfill fallback) and Intl.DurationFormat
 * to compute timezone-independent, DST-safe elapsed time from a single fixed official
 * launch instant (UTC ISO 8601).
 */

export const ZERO_ELAPSED = Object.freeze({
  days: 0,
  hours: 0,
  minutes: 0,
  seconds: 0,
  totalSeconds: 0,
  isLaunched: false,
  isoDuration: 'PT0S'
});

const EXPLICIT_TZ_ISO_REGEX =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:?\d{2})(?:\[[^\]]+\])?$/;

let temporalLoadPromise = null;

/**
 * Ensures `globalThis.Temporal` is available, loading `temporal-polyfill` only
 * when the runtime does not natively expose `Temporal`.
 */
export async function ensureTemporal() {
  if (typeof globalThis.Temporal !== 'undefined') {
    return globalThis.Temporal;
  }

  if (!temporalLoadPromise) {
    temporalLoadPromise = import('temporal-polyfill')
      .then((mod) => {
        const TemporalImpl = mod.Temporal || mod.default?.Temporal;
        if (!TemporalImpl) {
          throw new Error('Failed to resolve Temporal implementation from temporal-polyfill.');
        }
        if (typeof globalThis.Temporal === 'undefined') {
          globalThis.Temporal = TemporalImpl;
        }
        if (mod.toTemporalInstant && typeof Date.prototype.toTemporalInstant !== 'function') {
          Date.prototype.toTemporalInstant = mod.toTemporalInstant;
        }
        return globalThis.Temporal;
      })
      .catch((err) => {
        temporalLoadPromise = null;
        throw err;
      });
  }

  return temporalLoadPromise;
}

/**
 * Parses and validates an explicit timezone-qualified ISO 8601 launch timestamp.
 * Rejects naive date-time strings without `Z`, `±HH:MM`, or `[IANA/Zone]` so that
 * visitor local timezones can never shift the official launch instant.
 *
 * Returns canonical UTC ISO 8601 string (e.g. "2026-11-12T10:30:00Z") or null if invalid.
 */
export function parseOfficialLaunchTimestamp(rawValue, TemporalImpl = globalThis.Temporal) {
  if (typeof rawValue !== 'string') return null;
  const trimmed = rawValue.trim();
  if (!trimmed || !EXPLICIT_TZ_ISO_REGEX.test(trimmed)) {
    return null;
  }

  if (TemporalImpl) {
    try {
      const instant = trimmed.includes('[')
        ? TemporalImpl.ZonedDateTime.from(trimmed).toInstant()
        : TemporalImpl.Instant.from(trimmed);
      return instant.toString();
    } catch {
      return null;
    }
  }

  // Structural fallback before async Temporal polyfill resolves (strip optional [Zone] bracket)
  const withoutBracket = trimmed.replace(/\[[^\]]+\]$/, '');
  const parsedMs = Date.parse(withoutBracket);
  if (Number.isNaN(parsedMs)) return null;
  return new Date(parsedMs).toISOString();
}

/**
 * Calculates elapsed time as `currentTimestamp - fixedLaunchTimestamp` in UTC,
 * clamping pre-launch or inactive states cleanly to 00:00:00:00.
 */
export function calculateElapsedTime(
  launchTimestampIso,
  {
    nowEpochMs,
    clockOffsetMs = 0,
    isActive = true,
    TemporalImpl = globalThis.Temporal
  } = {}
) {
  if (!isActive || !launchTimestampIso || !TemporalImpl) {
    return { ...ZERO_ELAPSED };
  }

  const canonicalLaunchIso = parseOfficialLaunchTimestamp(launchTimestampIso, TemporalImpl);
  if (!canonicalLaunchIso) {
    return { ...ZERO_ELAPSED };
  }

  try {
    const launchZdt = TemporalImpl.Instant.from(canonicalLaunchIso).toZonedDateTimeISO('UTC');
    const safeOffsetMs = Number.isFinite(clockOffsetMs) ? Math.trunc(clockOffsetMs) : 0;
    const baseEpochMs =
      typeof nowEpochMs === 'number' && Number.isFinite(nowEpochMs)
        ? Math.trunc(nowEpochMs)
        : TemporalImpl.Now.instant().epochMilliseconds;

    const effectiveNowInstant = TemporalImpl.Instant.fromEpochMilliseconds(baseEpochMs + safeOffsetMs);
    const nowZdt = effectiveNowInstant.toZonedDateTimeISO('UTC');

    if (TemporalImpl.ZonedDateTime.compare(nowZdt, launchZdt) <= 0) {
      return { ...ZERO_ELAPSED };
    }

    const duration = nowZdt.since(launchZdt, {
      largestUnit: 'day',
      smallestUnit: 'second',
      roundingMode: 'trunc'
    });

    const days = Math.max(0, duration.days || 0);
    const hours = Math.max(0, duration.hours || 0);
    const minutes = Math.max(0, duration.minutes || 0);
    const seconds = Math.max(0, duration.seconds || 0);

    return {
      days,
      hours,
      minutes,
      seconds,
      totalSeconds: days * 86400 + hours * 3600 + minutes * 60 + seconds,
      isLaunched: true,
      isoDuration: duration.toString()
    };
  } catch {
    return { ...ZERO_ELAPSED };
  }
}

/**
 * Formats elapsed duration cleanly for assistive technologies via Intl.DurationFormat.
 */
export function formatDurationForScreenReader(elapsed = ZERO_ELAPSED, locale = 'en-US') {
  const safe = {
    days: Number(elapsed?.days) || 0,
    hours: Number(elapsed?.hours) || 0,
    minutes: Number(elapsed?.minutes) || 0,
    seconds: Number(elapsed?.seconds) || 0
  };

  if (typeof Intl !== 'undefined' && typeof Intl.DurationFormat === 'function') {
    const formatter = new Intl.DurationFormat(locale, {
      style: 'long',
      daysDisplay: 'always',
      hoursDisplay: 'always',
      minutesDisplay: 'always',
      secondsDisplay: 'always'
    });
    return formatter.format(safe);
  }

  return `${safe.days} days, ${safe.hours} hours, ${safe.minutes} minutes, ${safe.seconds} seconds`;
}

/**
 * Formats the fixed launch timestamp in both IST (Asia/Kolkata) and UTC so
 * visitors in any timezone see an unambiguous reference instant.
 */
export function formatLaunchTimestampDisplay(launchTimestampIso) {
  if (!launchTimestampIso) return null;
  const parsedMs = Date.parse(String(launchTimestampIso).replace(/\[[^\]]+\]$/, ''));
  if (Number.isNaN(parsedMs)) return null;
  const date = new Date(parsedMs);

  const istText = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).format(date);

  const utcText = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'UTC',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).format(date);

  return {
    istText: `${istText} IST`,
    utcText: `${utcText} UTC`,
    isoUtc: date.toISOString()
  };
}
