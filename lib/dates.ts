// en-CA formats as YYYY-MM-DD; timeZone gives the Asia/Kolkata calendar date.
const IST = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" });

export function todayISO(): string {
  return IST.format(new Date());
}

// @db.Date values arrive as UTC-midnight Dates; take the UTC date portion.
export function dateToISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function parseISODate(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

export function isFutureISO(iso: string): boolean {
  return iso > todayISO();
}
