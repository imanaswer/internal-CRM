import { dateToISO } from "./dates";

export type LockRange = { startDate: Date; endDate: Date };

export function isLocked(dateISO: string, locks: LockRange[]): boolean {
  return locks.some(
    (l) => dateToISO(l.startDate) <= dateISO && dateISO <= dateToISO(l.endDate)
  );
}
