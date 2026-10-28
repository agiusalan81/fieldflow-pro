import { describe, expect, it } from "vitest";
import { editionMenu, parseEdition, EDITION_SPEC } from "./editions";

const menu = [{ to: "/estimates", label: "Estimates, quotes & proposals" }, { to: "/crm", label: "CRM pipeline" }, { to: "/admin/entities", label: "Clients & assets" }, { to: "/sheets", label: "My job sheets" }];

describe("editions", () => {
  it("unknown edition falls back to contractor", () => { expect(parseEdition("x")).toBe("contractor"); expect(parseEdition("hotel")).toBe("hotel"); });
  it("contractor keeps quotes and CRM", () => { expect(editionMenu("contractor", menu)).toHaveLength(4); });
  it("hotel hides quotes and CRM and renames rooms", () => {
    const m = editionMenu("hotel", menu);
    expect(m.map((i) => i.to)).toEqual(["/admin/entities", "/sheets"]);
    expect(m[0]?.label).toBe("Properties, rooms & assets");
  });
  it("retail uses tickets wording", () => { expect(editionMenu("retail", menu)[1]?.label).toBe("My tickets"); });
  it("retail offers superstore, express outlet, bakery and factory sites", () => {
    for (const t of ["Superstore", "Express outlet", "Bakery", "Production / factory"]) expect(EDITION_SPEC.retail.siteTypes).toContain(t);
  });
  it("both in-house editions cover tiles and parking", () => {
    for (const e of ["hotel", "retail"] as const) {
      const all = EDITION_SPEC[e].assetGroups.flatMap((g) => g.items);
      expect(all).toContain("Floor tiles"); expect(all).toContain("Car park barrier");
    }
  });
});

import { isInHouse as _inHouse, editionEquipmentTypes as _types, CHECKLIST_PRESETS as _presets } from "./editions";
describe("AisleOps in-house rules", () => {
  it("retail is in-house, contractor is not", () => { expect(_inHouse("retail")).toBe(true); expect(_inHouse("contractor")).toBe(false); });
  it("retail equipment list has no lifts", () => { const t = _types("retail", ["Passenger Lift"]); expect(t).not.toContain("Passenger Lift"); expect(t).toContain("Cold room"); });
  it("contractor keeps its lift list", () => { expect(_types("contractor", ["Passenger Lift"])).toEqual(["Passenger Lift"]); });
  it("retail has a refrigeration checklist", () => { expect(_presets.retail?.["Refrigeration"]?.length).toBeGreaterThan(0); });
});
