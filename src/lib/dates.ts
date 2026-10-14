/** Today's date in Cairo, as midnight UTC (matches @db.Date columns). */
export function cairoToday(now: Date = new Date()): Date {
  const ymd = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Cairo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  return new Date(`${ymd}T00:00:00.000Z`);
}
