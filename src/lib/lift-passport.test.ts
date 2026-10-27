import { describe, expect, it } from "vitest";
import { equipmentTypeForCategory, fieldOptions, fieldsFor, learnFromPassports, NA, normalizeBlocks, sectionsFor } from "./lift-passport";

describe("lift passport model", () => {
  it("lifts get the five lift sections, escalators get the six escalator sections", () => {
    expect(sectionsFor("lift").map((s) => s.key)).toEqual(["general", "machine_drive", "suspension_safety", "controller_electronics", "doors_cabin"]);
    expect(sectionsFor("escalator").map((s) => s.key)).toEqual(["general", "machine_drive", "escalator_steps_chains", "escalator_handrail_balustrade", "controller_electronics"]);
    expect(sectionsFor("moving_walk").map((s) => s.key)).toEqual(sectionsFor("escalator").map((s) => s.key));
  });

  it("splits machine & drive fields by traction vs hydraulic decider", () => {
    const machine = sectionsFor("lift").find((s) => s.key === "machine_drive")!;
    const tractionKeys = fieldsFor(machine, "traction").map((f) => f.key);
    const hydraulicKeys = fieldsFor(machine, "hydraulic").map((f) => f.key);
    expect(tractionKeys).toContain("machine_brand");
    expect(tractionKeys).not.toContain("pump_brand");
    expect(hydraulicKeys).toContain("pump_brand");
    expect(hydraulicKeys).toContain("rupture_valve");
    expect(hydraulicKeys).not.toContain("machine_brand");
  });

  it("normalizeBlocks coerces jsonb into string maps and drops empties", () => {
    const blocks = normalizeBlocks({ general: { manufacturer: "Kone", year_installed: 2015, empty: "" }, machine_drive: null });
    expect(blocks['general']).toEqual({ manufacturer: "Kone", year_installed: "2015" });
    expect(blocks['machine_drive']).toEqual({});
    expect(normalizeBlocks(null)['general']).toEqual({});
  });

  it("learns suggestions from other passports, skipping N/A, without duplicating built-ins", () => {
    const learned = learnFromPassports([
      { general: { manufacturer: "Kone", lift_ref: "L1" } },
      { general: { manufacturer: "CustomBrand", lift_ref: "L1" }, controller_electronics: { controller: NA } },
    ]);
    expect(learned['manufacturer']).toEqual(["Kone", "CustomBrand"]);
    expect(learned['controller']).toBeUndefined();
    const field = sectionsFor("lift")[0]!.fields.find((f) => f.key === "manufacturer")!;
    const opts = fieldOptions(field, learned);
    expect(opts.filter((o) => o === "Kone")).toHaveLength(1);
    expect(opts).toContain("CustomBrand");
  });

  it("guesses equipment type from the asset category", () => {
    expect(equipmentTypeForCategory("Escalator")).toBe("escalator");
    expect(equipmentTypeForCategory("Moving walk")).toBe("moving_walk");
    expect(equipmentTypeForCategory("Passenger lift")).toBe("lift");
    expect(equipmentTypeForCategory(null)).toBe("lift");
  });
});
