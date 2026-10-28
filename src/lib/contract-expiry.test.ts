import { test, expect } from "vitest";
import { addPeriod } from "@/components/equipment-contracts";
test("presets", () => { expect(addPeriod("2026-10-28",{days:30})).toBe("2026-11-27"); expect(addPeriod("2026-10-28",{months:12})).toBe("2027-10-28"); expect(addPeriod("2026-08-31",{months:6})).toBe("2027-02-28"); });
