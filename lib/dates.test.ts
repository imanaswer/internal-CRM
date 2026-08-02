import { describe, it, expect } from "vitest";
import { dateToISO, isFutureISO, parseISODate, todayISO } from "./dates";

describe("dates", () => {
  it("todayISO returns YYYY-MM-DD", () => {
    expect(todayISO()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
  it("dateToISO reads UTC date parts of a db.Date", () => {
    expect(dateToISO(new Date("2026-08-01T00:00:00.000Z"))).toBe("2026-08-01");
  });
  it("parseISODate round-trips with dateToISO", () => {
    expect(dateToISO(parseISODate("2026-10-15"))).toBe("2026-10-15");
  });
  it("isFutureISO is true for tomorrow, false for today", () => {
    const [y, m, d] = todayISO().split("-").map(Number);
    const tomorrow = new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
    expect(isFutureISO(tomorrow)).toBe(true);
    expect(isFutureISO(todayISO())).toBe(false);
  });
});
