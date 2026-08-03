import { describe, it, expect } from "vitest";
import { isAllowedGoogleProfile, resolveRole, resolveTech } from "./auth-domain";

describe("isAllowedGoogleProfile", () => {
  const ok = { email: "a@gteceducation.com", email_verified: true, hd: "gteceducation.com" };
  it("accepts verified in-domain", () => expect(isAllowedGoogleProfile(ok)).toBe(true));
  it("rejects other domain", () =>
    expect(isAllowedGoogleProfile({ ...ok, email: "a@gmail.com", hd: undefined })).toBe(false));
  it("rejects unverified", () =>
    expect(isAllowedGoogleProfile({ ...ok, email_verified: false })).toBe(false));
  it("rejects missing email", () =>
    expect(isAllowedGoogleProfile({ email: null, email_verified: true })).toBe(false));
});

describe("resolveRole", () => {
  it("manager when listed (case-insensitive, trimmed)", () =>
    expect(resolveRole("Boss@gteceducation.com", " boss@gteceducation.com ,x@y.com")).toBe("MANAGER"));
  it("employee otherwise", () =>
    expect(resolveRole("a@gteceducation.com", "boss@gteceducation.com")).toBe("EMPLOYEE"));
});

describe("resolveTech", () => {
  it("true when listed (case-insensitive, trimmed)", () =>
    expect(resolveTech("Tech@gteceducation.com", " tech@gteceducation.com , x@y.com")).toBe(true));
  it("false otherwise", () => expect(resolveTech("a@gteceducation.com", "tech@x.com")).toBe(false));
  it("false for empty list", () => expect(resolveTech("a@x.com", "")).toBe(false));
});
