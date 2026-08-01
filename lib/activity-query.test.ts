import { describe, it, expect } from "vitest";
import { buildActivityWhere } from "./activity-query";

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
    expect(w).toEqual({ designation: "Developer", status: "PENDING" });
  });
});
