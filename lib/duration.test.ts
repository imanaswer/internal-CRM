import { describe, it, expect } from "vitest";
import { formatDuration, istStamp, significantWords, titlesSimilar } from "./duration";

describe("formatDuration", () => {
  it("two largest units", () => {
    expect(formatDuration(2 * 86400_000 + 4 * 3600_000 + 30 * 60_000)).toBe("2d 4h");
    expect(formatDuration(3 * 3600_000 + 12 * 60_000 + 50_000)).toBe("3h 12m");
    expect(formatDuration(41 * 60_000)).toBe("41m");
  });
  it("sub-minute and garbage clamp to <1m", () => {
    expect(formatDuration(30_000)).toBe("<1m");
    expect(formatDuration(-5)).toBe("<1m");
    expect(formatDuration(NaN)).toBe("<1m");
  });
  it("exact unit boundaries drop the zero second unit", () => {
    expect(formatDuration(2 * 86400_000)).toBe("2d");
    expect(formatDuration(3600_000)).toBe("1h");
  });
});

describe("istStamp", () => {
  it("formats in IST", () => {
    expect(istStamp(new Date("2026-08-03T07:22:00.000Z"))).toBe("3 Aug, 12:52 pm");
  });
});

describe("significantWords", () => {
  it("drops stopwords and short words", () => {
    expect(significantWords("The printer is not working in the office")).toEqual(["printer", "working"]);
  });
});

describe("titlesSimilar", () => {
  it("matches on 2+ shared words", () => {
    expect(titlesSimilar("Printer driver corrupt in admin office", "Printer offline driver failure")).toBe(true);
  });
  it("rejects unrelated titles", () => {
    expect(titlesSimilar("Printer driver corrupt", "WiFi down in Lab 2")).toBe(false);
  });
  it("single-significant-word source matches on 1 overlap", () => {
    expect(titlesSimilar("Printer issue", "Printer offline again")).toBe(true);
  });
});
