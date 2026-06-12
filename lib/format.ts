/** Shared display formatting — lowercase editorial style per DESIGN.md. */

export function fmtInt(n: number): string {
  return Math.round(n).toLocaleString("en-US");
}

const MONTHS = [
  "jan", "feb", "mar", "apr", "may", "jun",
  "jul", "aug", "sep", "oct", "nov", "dec",
];

/** "2014-11-23T01:26:06Z" → "nov 2014" (UTC). */
export function fmtMonthYear(iso: string): string {
  const d = new Date(iso);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** "2014-11-23T01:26:06Z" → "nov 23, 2014" (UTC). */
export function fmtDate(iso: string): string {
  const d = new Date(iso);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}

/** Minutes → compact display: "1,234 min" under ~100h, else "x,xxx h". */
export function fmtMinutes(minutes: number): string {
  if (minutes < 6000) return `${fmtInt(minutes)} min`;
  return `${fmtInt(minutes / 60)} h`;
}
