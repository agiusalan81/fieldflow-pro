import { describe, expect, it } from "vitest";
import { canSetDeparture, canSendNotice, waNumber } from "./client-notices";

describe("leaving an unsigned site", () => {
  it("technician can request approval", () => expect(canSetDeparture("none", "requested", false)).toBe(true));
  it("technician cannot approve their own departure", () => expect(canSetDeparture("requested", "approved", false)).toBe(false));
  it("manager can approve a request", () => expect(canSetDeparture("requested", "approved", true)).toBe(true));
  it("unsigned notice is blocked until approved", () => expect(canSendNotice("unsigned_left", { departure_status: "requested" })).not.toBeNull());
  it("unsigned notice allowed once approved", () => expect(canSendNotice("unsigned_left", { departure_status: "approved" })).toBeNull());
  it("no-access notice needs no approval", () => expect(canSendNotice("no_access", { departure_status: "none" })).toBeNull());
  it("formats WhatsApp numbers", () => expect(waNumber("+356 9943 5435")).toBe("35699435435"));
});
