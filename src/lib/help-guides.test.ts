import { expect, it } from "vitest";
import { helpFor, searchHelp } from "./help-guides";
it("payroll help is hidden when payroll is switched off", () => expect(helpFor("/payroll/wages", (k) => k !== "payroll")).toBeNull());
it("standby help is excluded from search when the rota module is off", () => expect(searchHelp("standby", (k) => k !== "standby").some((r) => r.path === "/standby")).toBe(false));
it("core help stays available regardless of modules", () => expect(helpFor("/sheets", () => false)?.title).toBe("Job sheets"));
