import { describe, expect, it } from "vitest";
import { etaBadge, etaText, fallbackEta } from "./travel-eta";
import { canSeeMember, visibleRoles } from "./member-registration";

describe("travel ETA", () => {
  it("estimates road distance and time from GPS when no route is available", () => {
    const e = fallbackEta({ lat: 35.9, lng: 14.5 }, { lat: 35.9, lng: 14.55 });
    expect(e.km).toBeCloseTo(4.5 * 1.3, 0);
    expect(e.minutes).toBe(Math.round((e.km / 30) * 60));
  });
  it("words the client window", () => expect(etaText({ km: 3.42, minutes: 12 })).toBe("approximately 12 minutes (3.4 km)"));
  it("shows the in-transit badge", () => expect(etaBadge({ km: 3.42, minutes: 12 })).toBe("~12 min · 3.4 km"));
});

describe("team visibility", () => {
  it("supervisor sees field staff only", () => expect(visibleRoles("supervisor")).toEqual(["technician", "maintenance", "supervisor"]));
  it("office admin sees admins but not superusers", () => { expect(canSeeMember("admin", "admin")).toBe(true); expect(canSeeMember("admin", "superuser")).toBe(false); });
  it("superuser sees everyone", () => expect(canSeeMember("superuser", "superuser")).toBe(true));
});
