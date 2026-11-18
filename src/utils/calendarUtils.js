export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export const WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const FULL_WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * Format a YYYY-MM-DD string or Date into readable string.
 */
export function formatDisplayDate(dateStr) {
  if (!dateStr) return '';
  const parts = String(dateStr).split('T')[0].split('-');
  if (parts.length !== 3) return dateStr;
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  if (isNaN(year) || isNaN(month) || isNaN(day)) return dateStr;
  return `${day} ${MONTH_NAMES[month]} ${year}`;
}

/**
 * Accurately calculate weekday from YYYY-MM-DD in Asia/Kolkata context.
 */
export function calculateWeekday(dateStr) {
  if (!dateStr) return '';
  const parts = String(dateStr).split('T')[0].split('-');
  if (parts.length !== 3) return '';
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  if (isNaN(year) || isNaN(month) || isNaN(day)) return '';
  const d = new Date(Date.UTC(year, month, day, 12, 0, 0));
  return FULL_WEEKDAYS[d.getUTCDay()];
}

/**
 * Calculate dynamic age in Asia/Kolkata from DOB YYYY-MM-DD.
 */
export function calculateAgeFromDob(dobStr, referenceDate) {
  if (!dobStr) return null;
  const parts = String(dobStr).split('T')[0].split('-');
  if (parts.length !== 3) return null;
  const birthYear = parseInt(parts[0], 10);
  const birthMonth = parseInt(parts[1], 10);
  const birthDay = parseInt(parts[2], 10);
  if (isNaN(birthYear) || isNaN(birthMonth) || isNaN(birthDay)) return null;

  let currYear, currMonth, currDay;
  if (referenceDate) {
    const refParts = String(referenceDate).split('T')[0].split('-');
    if (refParts.length === 3) {
      currYear = parseInt(refParts[0], 10);
      currMonth = parseInt(refParts[1], 10);
      currDay = parseInt(refParts[2], 10);
    }
  }

  if (!currYear) {
    const now = new Date();
    const istFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' });
    [currYear, currMonth, currDay] = istFormatter.format(now).split('-').map(Number);
  }

  if (currYear < birthYear ||
     (currYear === birthYear && currMonth < birthMonth) ||
     (currYear === birthYear && currMonth === birthMonth && currDay < birthDay)) {
    return -1; // Future date
  }

  let age = currYear - birthYear;
  if (currMonth < birthMonth || (currMonth === birthMonth && currDay < birthDay)) {
    age -= 1;
  }
  return age;
}
