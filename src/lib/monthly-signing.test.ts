import { describe, it, expect } from "vitest";
import { monthlyGroups, unsignedQueue, validateMonthlyQueue } from "./monthly-signing";
const row = (id: string, client_id = "client-a", created_at = "2026-10-18T08:00:00Z", status = "draft", signature_data: string | null = null) => ({ id, client_id, created_at, status, signature_data });
describe("monthly client signing", () => {
  it("keeps different clients and calendar months separate", () => {
    const groups = monthlyGroups([row("a"), row("b", "client-b"), row("c", "client-a", "2026-09-30T23:59:00Z")]);
    expect(groups.map((g) => [g.clientId, g.month, g.sheets.length])).toEqual([["client-a", "2026-10", 1], ["client-b", "2026-10", 1], ["client-a", "2026-09", 1]]);
  });
  it("leaves signed or completed sheets outside the unsigned queue", () => {
    expect(unsignedQueue([row("a"), row("b", "client-a", undefined, "completed"), row("c", "client-a", undefined, "draft", "signature")]).map((s) => s.id)).toEqual(["a"]);
  });
  it("rejects mixed-client and mixed-month signing sessions", () => {
    expect(() => validateMonthlyQueue([row("a"), row("b", "client-b")], "client-a", "2026-10")).toThrow();
    expect(() => validateMonthlyQueue([row("a")], "client-a", "2026-09")).toThrow();
  });
});