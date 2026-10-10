/** How late an end alarm may be delivered and still sound. */
export const STALE_ALARM_MS = 3000;

/**
 * Whether a countdown that ended at `endsAt` and is noticed at `at` sounds its
 * end alarm. The rest end and the hold end share this rule: an end reached
 * while the page was hidden, or delivered more than three seconds late, is
 * silent.
 */
export function alarmIsLive(endsAt: number, at: number, visible: boolean, wasHidden: boolean): boolean {
  return visible && !wasHidden && at - endsAt <= STALE_ALARM_MS;
}
