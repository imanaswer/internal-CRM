import { describe, it, expect } from "vitest";
import { activitySchema, lockSchema } from "./validation";

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
