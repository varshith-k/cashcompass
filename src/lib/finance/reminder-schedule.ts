// Pure scheduling for bill email reminders (no I/O), so it can be unit-tested.

/** Days-before choices offered in the UI. */
export const REMINDER_DAY_OPTIONS = [0, 1, 2, 3, 5, 7] as const;

export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}

/** Offset (ms) of `timeZone` from UTC at the given instant, e.g. +5:30 for Asia/Kolkata. */
function zoneOffsetMs(instant: number, timeZone: string): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
      .formatToParts(new Date(instant))
      .map((p) => [p.type, p.value]),
  );
  const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  return asUtc - Math.floor(instant / 1000) * 1000;
}

/**
 * The UTC instant of `hour`:00 local time, `daysBefore` days before the bill's
 * due date (a YYYY-MM-DD calendar date), in the user's time zone.
 */
export function reminderSendAt(dueDateKey: string, daysBefore: number, hour: number, timeZone: string): number {
  const [y, m, d] = dueDateKey.slice(0, 10).split("-").map(Number);
  const localAsUtc = Date.UTC(y!, m! - 1, d! - daysBefore, hour, 0, 0);
  // Two passes handle a DST change between the guess and the real instant.
  let instant = localAsUtc - zoneOffsetMs(localAsUtc, timeZone);
  instant = localAsUtc - zoneOffsetMs(instant, timeZone);
  return instant;
}

/**
 * Whether a reminder should go out now: its send time has passed, the bill
 * isn't overdue by more than a day (don't nag about long-past bills after an
 * outage), and it hasn't already been sent for this occurrence.
 */
export function isReminderDue(input: {
  dueDateKey: string;
  daysBefore: number;
  hour: number;
  timeZone: string;
  now: number;
  lastSentKey?: string;
  occurrenceKey: string;
}): boolean {
  if (input.lastSentKey === input.occurrenceKey) return false;
  const sendAt = reminderSendAt(input.dueDateKey, input.daysBefore, input.hour, input.timeZone);
  const dueEnd = Date.parse(`${input.dueDateKey.slice(0, 10)}T00:00:00Z`) + 2 * 86_400_000;
  return input.now >= sendAt && input.now < dueEnd;
}

export function describeReminder(daysBefore: number, hour: number): string {
  const time = new Date(Date.UTC(2000, 0, 1, hour)).toLocaleTimeString("en-US", { hour: "numeric", timeZone: "UTC" });
  const when = daysBefore === 0 ? "on the due date" : daysBefore === 1 ? "1 day before" : `${daysBefore} days before`;
  return `${when} at ${time}`;
}
