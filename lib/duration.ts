export function formatSessionDuration(
  startedAt: string,
  finishedAt: string | null | undefined,
): string | null {
  if (!finishedAt) return null;

  const start = Date.parse(startedAt);
  const finish = Date.parse(finishedAt);
  if (!Number.isFinite(start) || !Number.isFinite(finish) || finish < start) return null;

  const elapsedMs = finish - start;
  const totalMinutes = Math.max(elapsedMs > 0 ? 1 : 0, Math.round(elapsedMs / 60_000));
  if (totalMinutes < 60) return `${totalMinutes} min`;

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes === 0 ? `${hours} h` : `${hours} h ${minutes} min`;
}

export function stripDayEstimate(dayName: string): string {
  return dayName.replace(/\s+\([^()]*~\d+(?:\.\d+)?\s+min[^()]*\)\s*$/, "");
}
