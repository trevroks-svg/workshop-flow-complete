/**
 * Centralised date/time utilities.
 *
 * Uses the browser-native Intl API so DST transitions are handled
 * automatically for any IANA timezone. The user's timezone is detected
 * automatically from their browser — no hardcoded offsets or zones.
 */

/**
 * Get the current user's IANA timezone from their browser.
 * Falls back to 'UTC' if unavailable.
 * @returns {string}
 */
export function getUserTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

/**
 * Format an ISO timestamp string for display in the user's local timezone.
 *
 * @param {string} isoString  - ISO 8601 timestamp (with or without trailing Z)
 * @param {string} [timezone] - IANA timezone name, defaults to the user's browser timezone
 * @returns {string}          - e.g. "14 May 2026, 09:32"
 */
export function formatDateTime(isoString, timezone) {
  if (!isoString) return '—';

  const tz = timezone || getUserTimezone();

  // Ensure the string is treated as UTC when no offset is present
  const normalized = /Z|[+-]\d{2}:\d{2}$/.test(isoString)
    ? isoString
    : isoString + 'Z';

  const date = new Date(normalized);
  if (isNaN(date.getTime())) return '—';

  return new Intl.DateTimeFormat('en-AU', {
    timeZone: tz,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

/**
 * Return a Date object representing the start of today (midnight) in the
 * user's timezone, correctly converted to a UTC-equivalent Date so it
 * can be compared with other Date objects from the database.
 *
 * @param {string} [timezone] - IANA timezone, defaults to the user's browser timezone
 * @returns {Date}
 */
export function getStartOfToday(timezone) {
  const tz = timezone || getUserTimezone();
  const now = new Date();

  // Get today's date parts in the target timezone
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);

  const y = parts.find(p => p.type === 'year').value;
  const m = parts.find(p => p.type === 'month').value;
  const d = parts.find(p => p.type === 'day').value;

  // Build midnight in the target timezone by parsing as UTC then adjusting
  // for the actual offset at that moment in that timezone
  const midnightLocal = new Date(`${y}-${m}-${d}T00:00:00`);

  // Get what the timezone offset is at that exact moment using Intl
  const offsetMs = getTimezoneOffsetMs(tz, midnightLocal);

  // Shift so comparisons against UTC database timestamps work correctly
  return new Date(midnightLocal.getTime() - offsetMs);
}

/**
 * Return a Date object representing the start of this calendar month
 * in the user's timezone, correctly converted to UTC.
 *
 * @param {string} [timezone] - IANA timezone, defaults to the user's browser timezone
 * @returns {Date}
 */
export function getStartOfMonth(timezone) {
  const tz = timezone || getUserTimezone();
  const now = new Date();

  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);

  const y = parts.find(p => p.type === 'year').value;
  const m = parts.find(p => p.type === 'month').value;

  const firstOfMonth = new Date(`${y}-${m}-01T00:00:00`);
  const offsetMs = getTimezoneOffsetMs(tz, firstOfMonth);

  return new Date(firstOfMonth.getTime() - offsetMs);
}

/**
 * Calculate the UTC offset in milliseconds for a given IANA timezone at a
 * specific moment, using the Intl API (DST-aware).
 *
 * @param {string} timezone
 * @param {Date} date
 * @returns {number} offset in milliseconds (positive = ahead of UTC)
 */
function getTimezoneOffsetMs(timezone, date) {
  // Format the date in UTC and in the target timezone, then diff them
  const utcStr = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'UTC',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  }).format(date);

  const localStr = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  }).format(date);

  return new Date(localStr) - new Date(utcStr);
}