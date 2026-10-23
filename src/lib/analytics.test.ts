import { describe, expect, it } from "vitest";
import { analyticsFeature, renderOutreach, tenantAlerts, unknownTokens } from "./analytics";
const now = Date.parse("2026-10-23T08:00:00Z");
const tenant = { status: "trial", created_at: "2026-10-19T08:00:00Z", trial_ends_at: "2026-12-19T08:00:00Z", first_sign_in: "2026-10-20T08:00:00Z", last_seen: "2026-10-22T08:00:00Z", work_count: 0, active_days: 2 };
describe("tenant health rules", () => {
  it("flags a signed-in team after exactly three days without work", () => expect(tenantAlerts(tenant, now).map(a => a.key)).toContain("stalled"));
  it("does not flag before three days", () => expect(tenantAlerts(tenant, now - 1).map(a => a.key)).not.toContain("stalled"));
  it("does not call a team unused once work is recorded", () => expect(tenantAlerts({ ...tenant, work_count: 1 }, now).map(a => a.key)).not.toContain("stalled"));
  it("requires a sign-in before raising the three-day flag", () => expect(tenantAlerts({ ...tenant, first_sign_in: null }, now).map(a => a.key)).not.toContain("stalled"));
  it("offers three conversion actions per alert", () => expect(tenantAlerts(tenant, now)[0]?.actions).toEqual(["setup", "feedback", "unlock"]));
});
describe("product-safe analytics and outreach", () => {
  it("substitutes another product without FieldBridge wording", () => expect(renderOutreach("What would {{product_name}} have needed for {{company_name}} to stay?", { product_name: "SitePilot", company_name: "Acme" })).toBe("What would SitePilot have needed for Acme to stay?"));
  it("rejects unsupported tokens", () => expect(unknownTokens("{{product_name}} {{salary}}" )).toEqual(["salary"]));
  it("reduces sheet identities to one coarse feature", () => expect(analyticsFeature("/sheets/private-client-id")).toBe("job_sheets"));
  it("does not track payroll, leave or location paths", () => { expect(analyticsFeature("/payroll/wages")).toBeNull(); expect(analyticsFeature("/leave")).toBeNull(); expect(analyticsFeature("/live-map")).toBeNull(); });
});