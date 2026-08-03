import { describe, it, expect } from "vitest";
import { activitySchema, lockSchema, ticketSchema, solveSchema } from "./validation";

const base = {
  date: "2026-07-01", activity: "Fixed bug", assignedBy: "Lead",
  status: "COMPLETED", timeTaken: 2,
};

describe("activitySchema", () => {
  it("accepts a valid past-dated activity", () => {
    expect(activitySchema.safeParse(base).success).toBe(true);
  });
  it("rejects empty activity", () => {
    expect(activitySchema.safeParse({ ...base, activity: "" }).success).toBe(false);
  });
  it("rejects timeTaken <= 0", () => {
    expect(activitySchema.safeParse({ ...base, timeTaken: 0 }).success).toBe(false);
  });
  it("rejects future date", () => {
    expect(activitySchema.safeParse({ ...base, date: "2999-01-01" }).success).toBe(false);
  });
  it("rejects deadline earlier than date", () => {
    expect(activitySchema.safeParse({ ...base, deadline: "2026-06-01" }).success).toBe(false);
  });
  it("accepts deadline equal to date", () => {
    expect(activitySchema.safeParse({ ...base, deadline: "2026-07-01" }).success).toBe(true);
  });
});

describe("lockSchema", () => {
  it("rejects endDate before startDate", () => {
    expect(lockSchema.safeParse({ startDate: "2026-10-31", endDate: "2026-10-01" }).success).toBe(false);
  });
  it("accepts a valid range", () => {
    expect(lockSchema.safeParse({ startDate: "2026-10-01", endDate: "2026-10-31" }).success).toBe(true);
  });
});

const ticketBase = {
  title: "WiFi down in Lab 2",
  contactName: "Ravi",
  contactPhone: "9876543210",
  source: "PHONE",
  priority: "HIGH",
};

describe("ticketSchema", () => {
  it("accepts a valid ticket", () => {
    expect(ticketSchema.safeParse(ticketBase).success).toBe(true);
  });
  it("rejects short title", () =>
    expect(ticketSchema.safeParse({ ...ticketBase, title: "ab" }).success).toBe(false));
  it("rejects un-normalizable phone", () =>
    expect(ticketSchema.safeParse({ ...ticketBase, contactPhone: "123" }).success).toBe(false));
  it("rejects bad source", () =>
    expect(ticketSchema.safeParse({ ...ticketBase, source: "FAX" }).success).toBe(false));
  it("accepts optional tech fields", () => {
    expect(
      ticketSchema.safeParse({ ...ticketBase, ipAddress: "10.0.0.4", assetId: "SRV-02", branch: "Kochi" }).success
    ).toBe(true);
  });
});

describe("solveSchema", () => {
  it("requires a note of 3+ chars", () => {
    expect(solveSchema.safeParse({ note: "ok" }).success).toBe(false);
    expect(solveSchema.safeParse({ note: "Restarted router" }).success).toBe(true);
  });
});
