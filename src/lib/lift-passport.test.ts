import { describe, expect, it } from "vitest";
import { assetPassportBlocks, equipmentTypeForCategory, fieldOptions, fieldsFor, learnFromPassports, NA, normalizeBlocks, sectionsFor } from "./lift-passport";

describe("lift passport model", () => {
  it('prefills reference, serial and location only for a new passport',()=>{
    const asset={reference_number:'GL1',serial_number:'SN-145',location_details:'Main entrance'};
    expect(assetPassportBlocks(asset,'Lift',null)['general']).toEqual({lift_ref:'GL1',serial_number:'SN-145',location_details:'Main entrance'});
    expect(assetPassportBlocks(asset,'Lift',{general:{lift_ref:'Verified GL1'}})['general']).toEqual({lift_ref:'Verified GL1'});
  });
  it('hydraulic piston brand and diameter in mm never appear in traction fields',()=>{
    const machine=sectionsFor('lift').find(s=>s.key==='machine_drive');if(!machine)throw Error('Missing section');
    expect(fieldsFor(machine,'hydraulic').find(f=>f.key==='piston_brand')?.type).toBe('select');
    expect(fieldsFor(machine,'hydraulic').find(f=>f.key==='piston_diameter')?.unit).toBe('mm');
    expect(fieldsFor(machine,'traction').some(f=>f.key==='piston_brand'||f.key==='piston_diameter')).toBe(false);
  });
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
