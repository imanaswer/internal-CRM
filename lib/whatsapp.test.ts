import { describe, it, expect } from "vitest";
import { normalizePhone, buildWaLink, solvedMessage, ticketNo } from "./whatsapp";

describe("normalizePhone", () => {
  it("prefixes 91 to 10-digit numbers", () => expect(normalizePhone("9876543210")).toBe("919876543210"));
  it("strips spaces/dashes/parens", () => expect(normalizePhone("98765 432-10")).toBe("919876543210"));
  it("drops leading 0 then prefixes 91", () => expect(normalizePhone("09876543210")).toBe("919876543210"));
  it("keeps 12-digit country-coded numbers", () => expect(normalizePhone("+91 98765 43210")).toBe("919876543210"));
  it("keeps other international numbers", () => expect(normalizePhone("+1 415 555 2671")).toBe("14155552671"));
  it("rejects too-short numbers", () => expect(normalizePhone("12345")).toBeNull());
  it("rejects empty/garbage", () => {
    expect(normalizePhone("")).toBeNull();
    expect(normalizePhone("abc")).toBeNull();
  });
});

describe("buildWaLink", () => {
  it("builds an encoded wa.me link", () => {
    expect(buildWaLink("9876543210", "Hi there & welcome")).toBe(
      "https://wa.me/919876543210?text=Hi%20there%20%26%20welcome"
    );
  });
  it("returns null for bad phone", () => expect(buildWaLink("123", "x")).toBeNull());
});

describe("ticketNo", () => {
  it("pads to 3 digits", () => expect(ticketNo(7)).toBe("T-007"));
  it("does not truncate 4-digit numbers", () => expect(ticketNo(1234)).toBe("T-1234"));
});

describe("solvedMessage", () => {
  it("formats the exact template in IST", () => {
    const msg = solvedMessage({
      contactName: "Ravi",
      num: 14,
      title: "WiFi down in Lab 2",
      resolutionNote: "Router restarted and firmware updated",
      solvedAt: new Date("2026-08-02T12:10:00.000Z"), // 17:40 IST
    });
    expect(msg).toBe(
      "Hi Ravi, your complaint T-014 — WiFi down in Lab 2 has been resolved on 2 Aug 2026, 5:40 pm IST. Resolution: Router restarted and firmware updated. — G-TEC Tech Team"
    );
  });
});
