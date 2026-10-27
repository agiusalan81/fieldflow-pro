import { describe, expect, it } from "vitest";
import { ardFor, checksFor, collectDefects, evaluate, LIFT_MEASUREMENTS, ESCALATOR_MEASUREMENTS, protocolForCategory } from "./lift-maintenance";

const m = (list: typeof LIFT_MEASUREMENTS, k: string) => list.find((x) => x.key === k)!;

describe("lift maintenance tolerances", () => {
  it("flags lift levelling outside ±10 mm", () => {
    expect(evaluate(m(LIFT_MEASUREMENTS, "levelling"), "10")).toBe("pass");
    expect(evaluate(m(LIFT_MEASUREMENTS, "levelling"), "-11")).toBe("fail");
  });
  it("flags door closing force above 150 N", () => {
    expect(evaluate(m(LIFT_MEASUREMENTS, "door_force"), "151")).toBe("fail");
  });
  it("flags escalator skirt gap above 4 mm", () => {
    expect(evaluate(m(ESCALATOR_MEASUREMENTS, "skirt_gap"), "4.5")).toBe("fail");
    expect(evaluate(m(ESCALATOR_MEASUREMENTS, "skirt_gap"), "")).toBeNull();
  });
  it("includes ARD mains-loss test for lifts quarterly, never for escalators", () => {
    expect(ardFor("lift", "quarterly").map((c) => c.key)).toContain("mains_loss");
    expect(ardFor("lift", "monthly").map((c) => c.key)).not.toContain("mains_loss");
    expect(ardFor("escalator", "annual")).toHaveLength(0);
  });
  it("adds governor check only on annual visits", () => {
    expect(checksFor("lift", "monthly").some((c) => c.key === "governor")).toBe(false);
    expect(checksFor("lift", "annual").some((c) => c.key === "governor")).toBe(true);
  });
  it("collects defects from checks, readings and ARD", () => {
    const d = collectDefects("lift", "quarterly", { brake: "defect" }, { levelling: "15" }, { battery: "defect" });
    expect(d.map((x) => x.source)).toEqual(["check", "measurement", "ard"]);
  });
  it("maps categories to protocols", () => {
    expect(protocolForCategory("Passenger lift")).toBe("lift");
    expect(protocolForCategory("Escalator")).toBe("escalator");
    expect(protocolForCategory("Generator")).toBeNull();
  });
});
