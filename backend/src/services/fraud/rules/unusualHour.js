/**
 * ==============================================================================
 * Fraud Rule 4: UNUSUAL_HOUR
 * ==============================================================================
 * Purpose: Detect transactions occurring during configured unusual banking off-hours.
 *
 * Timezone-Aware Evaluation & Boundary Specification:
 * - Reads `startHour`, `endHour`, and `timezone` from the MongoDB rule's config object.
 * - Defaults: `startHour: 1`, `endHour: 5`, `timezone: 'Asia/Kolkata'`.
 * - Uses `Intl.DateTimeFormat` to extract the hour in the configured timezone,
 *   completely avoiding reliance on the server host's implicit local timezone.
 * - Boundary: Half-open interval [startHour, endHour).
 *   With startHour: 1 and endHour: 5, timestamps from 01:00:00 through 04:59:59
 *   fall within the window and trigger. A timestamp at 05:00:00 or later is outside.
 * - If startHour > endHour (e.g. 23:00 to 05:00 overnight wrap), timestamps
 *   where hour >= startHour OR hour < endHour trigger the rule.
 * ==============================================================================
 */

/**
 * Extracts the 24-hour hour integer (0-23) for a given Date in a specified timezone.
 *
 * @param {Date} date
 * @param {string} timezone
 * @returns {number}
 */
function getHourInTimezone(date, timezone = 'Asia/Kolkata') {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: 'numeric',
      hour12: false
    });
    const parts = formatter.formatToParts(date);
    const hourPart = parts.find((p) => p.type === 'hour');
    let h = parseInt(hourPart.value, 10);
    if (h === 24) h = 0; // Some ICU versions return 24 for midnight
    return h;
  } catch {
    // Fallback if timezone string is unrecognized: use UTC
    return date.getUTCHours();
  }
}

/**
 * Evaluates the UNUSUAL_HOUR rule against transaction timestamp.
 *
 * @param {object} transaction - Validated transaction payload
 * @param {object} rule - MongoDB fraud rule document
 * @returns {Promise<{ triggered: boolean, points?: number, description?: string }>}
 */
async function evaluateUnusualHour(transaction, rule) {
  const startHour = Number(rule.config?.startHour ?? 1);
  const endHour = Number(rule.config?.endHour ?? 5);
  const timezone = rule.config?.timezone ?? 'Asia/Kolkata';

  const txDate = transaction.timestamp instanceof Date
    ? transaction.timestamp
    : new Date(transaction.timestamp);

  const hour = getHourInTimezone(txDate, timezone);

  let isWithinWindow = false;
  if (startHour <= endHour) {
    // Standard window (e.g. 1 to 5: hours 1, 2, 3, 4)
    isWithinWindow = hour >= startHour && hour < endHour;
  } else {
    // Overnight window crossing midnight (e.g. 23 to 5: hours 23, 0, 1, 2, 3, 4)
    isWithinWindow = hour >= startHour || hour < endHour;
  }

  if (isWithinWindow) {
    const displayHour = `${String(hour).padStart(2, '0')}:00`;
    return {
      triggered: true,
      points: rule.weight,
      description: `Transaction occurred during unusual banking hours (${displayHour} in ${timezone}, configured window ${startHour}:00 - ${endHour}:00)`
    };
  }

  return { triggered: false };
}

module.exports = {
  evaluateUnusualHour,
  getHourInTimezone
};

