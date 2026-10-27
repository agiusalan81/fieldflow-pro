import { describe, expect, it } from "vitest";
import { dismantlingLine, nextSurveyNumber, normalizeSurvey, rfqPrefillFromSurvey, travelFromFloors, type FloorRow } from "./lift-survey";

const floors: FloorRow[] = [
  { floor: "0", height_mm: "3200", door_opening_mm: "900", wall_thickness_mm: "200", recess_mm: "", door_side: "A" },
  { floor: "1", height_mm: "3000", door_opening_mm: "900", wall_thickness_mm: "200", recess_mm: "", door_side: "A" },
  { floor: "2", height_mm: "", door_opening_mm: "", wall_thickness_mm: "", recess_mm: "", door_side: "" },
];

describe("lift survey model", () => {
  it("travel is the sum of floor-to-floor heights, ignoring blanks", () => {
    expect(travelFromFloors(floors)).toBe(6200);
    expect(travelFromFloors([])).toBe(0);
  });

  it("normalizeSurvey defaults a bare-shaft new installation and coerces jsonb blocks", () => {
    const d = normalizeSurvey(null);
    expect(d.isNew).toBe(true);
    expect(d.is_bare_shaft).toBe(true);
    expect(d.requires_dismantling).toBe(false);
    expect(d.purpose).toBe("new_installation");
    const row = normalizeSurvey({ id: "x", is_bare_shaft: false, requires_dismantling: true, geometry: { pit_depth_mm: 1400, empty: "" }, floor_heights: floors });
    expect(row.isNew).toBe(false);
    expect(row.is_bare_shaft).toBe(false);
    expect(row.geometry).toEqual({ pit_depth_mm: "1400" });
    expect(row.floors).toHaveLength(3);
  });

  it("dismantling line describes scope, disposal and duration for the estimate", () => {
    expect(dismantlingLine({})).toBe("Decommissioning, dismantling & safe removal of existing lift");
    const line = dismantlingLine({ scope: "partial", scrap: "scrap_credit", hazmat: "yes", duration_days: "3" });
    expect(line).toContain("partial scope");
    expect(line).toContain("scrap value credited");
    expect(line).toContain("hazardous material handling");
    expect(line).toContain("3 day(s)");
  });

  it("RFQ prefill maps shaft geometry and travel for lifts only", () => {
    const d = normalizeSurvey(null);
    d.survey_kind = "lift";
    d.geometry = { pit_depth_mm: "1400", headroom_mm: "3800", shaft_width_mm: "2000", shaft_depth_mm: "2100" };
    d.power = { mains_voltage: "400V 3-phase 50Hz" };
    d.floors = floors;
    const pre = rfqPrefillFromSurvey(d);
    expect(pre).toMatchObject({ stops: "3", pit: "1400", headroom: "3800", shaft_w: "2000", shaft_d: "2100", travel: "6200", floor_heights: "3200, 3000", voltage: "400V 3-phase 50Hz" });
    d.survey_kind = "escalator";
    expect(rfqPrefillFromSurvey(d)).toEqual({});
  });

  it("survey numbers increment from the highest existing number", () => {
    expect(nextSurveyNumber([])).toBe("SV-0001");
    expect(nextSurveyNumber(["SV-0003", "SV-0011", "other"])).toBe("SV-0012");
  });
});
