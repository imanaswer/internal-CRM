import { describe, it, expect } from "vitest";
import { isLocked } from "./period-lock";

const lock = (s: string, e: string) => ({
  startDate: new Date(`${s}T00:00:00.000Z`),
  endDate: new Date(`${e}T00:00:00.000Z`),
});

describe("isLocked", () => {
  const locks = [lock("2026-10-01", "2026-10-31")];
  it("date inside range is locked", () => expect(isLocked("2026-10-15", locks)).toBe(true));
  it("boundaries inclusive", () => {
    expect(isLocked("2026-10-01", locks)).toBe(true);
    expect(isLocked("2026-10-31", locks)).toBe(true);
  });
  it("date outside range not locked", () => expect(isLocked("2026-09-30", locks)).toBe(false));
  it("no locks means not locked", () => expect(isLocked("2026-10-15", [])).toBe(false));
});
