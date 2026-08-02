import { describe, it, expect } from "vitest";
import { buildActivityWhere, parseActivityFilters } from "./activity-query";

describe("buildActivityWhere", () => {
  it("empty filters produce empty where", () => {
    expect(buildActivityWhere({})).toEqual({});
  });
  it("status maps directly", () => {
    expect(buildActivityWhere({ status: "COMPLETED" as any })).toEqual({ status: "COMPLETED" });
  });
  it("date range builds gte/lte on date", () => {
    const w = buildActivityWhere({ dateFrom: "2026-10-01", dateTo: "2026-10-31" });
    expect(w.date).toEqual({
      gte: new Date("2026-10-01T00:00:00.000Z"),
      lte: new Date("2026-10-31T00:00:00.000Z"),
    });
  });
  it("search ORs across employeeName, activity, assignedBy (insensitive)", () => {
    const w = buildActivityWhere({ search: "bug" });
    expect(w.OR).toEqual([
      { employeeName: { contains: "bug", mode: "insensitive" } },
      { activity: { contains: "bug", mode: "insensitive" } },
      { assignedBy: { contains: "bug", mode: "insensitive" } },
    ]);
  });
  it("combines filters", () => {
    const w = buildActivityWhere({ designation: "Developer", status: "PENDING" as any });
    expect(w).toEqual({
      designation: { contains: "Developer", mode: "insensitive" },
      status: "PENDING",
    });
  });
});

describe("parseActivityFilters", () => {
  it("parses valid params from a plain object", () => {
    expect(
      parseActivityFilters({ status: "COMPLETED", dateFrom: "2026-10-01", search: "bug" })
    ).toEqual({
      employeeName: undefined,
      designation: undefined,
      status: "COMPLETED",
      assignedBy: undefined,
      dateFrom: "2026-10-01",
      dateTo: undefined,
      search: "bug",
    });
  });
  it("rejects bogus status, malformed dates, and array params", () => {
    const f = parseActivityFilters({
      status: "BOGUS",
      dateFrom: "junk",
      dateTo: "2026-13-99x",
      employeeName: ["a", "b"] as unknown as string,
    });
    expect(f.status).toBeUndefined();
    expect(f.dateFrom).toBeUndefined();
    expect(f.dateTo).toBeUndefined();
    expect(f.employeeName).toBeUndefined();
  });
  it("works with URLSearchParams", () => {
    const f = parseActivityFilters(new URLSearchParams("status=PENDING&dateTo=2026-08-31"));
    expect(f.status).toBe("PENDING");
    expect(f.dateTo).toBe("2026-08-31");
  });
});
