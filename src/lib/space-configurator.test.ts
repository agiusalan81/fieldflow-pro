import { describe, expect, it } from "vitest";
import { assetRows, buildSpaces, nextFloor, type Floor } from "./space-configurator";

const f1: Floor = { id: "a", label: "Floor 1", start: 101, count: 3, zone: "Standard King" };

describe("space configurator", () => {
  it("added floor continues at the next hundred", () => {
    expect(nextFloor([f1], "x").start).toBe(201);
  });
  it("builds one asset per room per equipment item", () => {
    const rows = assetRows(buildSpaces([f1], "Room "), ["TV", "Safe"]);
    expect(rows).toHaveLength(6);
    expect(rows[0]?.reference_number).toBe("Room 101 · TV");
  });
});
