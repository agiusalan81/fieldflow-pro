import { describe, expect, it } from "vitest";
import { canViewDocument, parseAudience, parseSections, sectionsFor } from "./document-audience";

const sections = parseSections([
  { title: "Scope", body: "Service lift", audience: "both" },
  { title: "Pricing", body: "€1,200 less 10% discount, 4 visits a year", audience: "client" },
  { title: "Wiring notes", body: "Check X1", audience: "technician" },
]);

describe("document audience", () => {
  it("technician copy excludes client-only pricing, discounts and visit counts", () => {
    expect(sectionsFor(sections, "technician").map((s) => s.title)).toEqual(["Scope", "Wiring notes"]);
  });
  it("client copy excludes technician-only sections", () => {
    expect(sectionsFor(sections, "client").map((s) => s.title)).toEqual(["Scope", "Pricing"]);
  });
  it("technicians cannot see client-only documents", () => {
    expect(canViewDocument("technician", ["client"])).toBe(false);
    expect(canViewDocument("technician", ["technician", "client"])).toBe(true);
  });
  it("office roles always see documents", () => {
    expect(canViewDocument("supervisor", [])).toBe(true);
    expect(canViewDocument("admin", ["client"])).toBe(true);
  });
  it("drops unknown audiences", () => {
    expect(parseAudience(["client", "hacker", "client"])).toEqual(["client"]);
  });
});
