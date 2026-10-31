import { describe, expect, it } from "vitest";
import { composeProblem, reporterFields } from "./quick-report";

describe("quick QR report", () => {
  it("builds a valid problem from taps only", () => {
    expect(composeProblem({ category: "Fridges & freezers", symptom: "Not cold" })).toBe("Fridges & freezers — Not cold");
    expect(composeProblem({ symptom: "Leak" }).length).toBeGreaterThanOrEqual(5);
  });
  it("keeps anonymous reporters anonymous", () => {
    expect(reporterFields("")).toEqual({ first: "Anonymous", last: "(QR scan)", position: "Not given" });
    expect(reporterFields("Ann Bo").first).toBe("Ann");
  });
});
