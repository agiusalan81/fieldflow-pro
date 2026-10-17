import { describe, expect, it } from "vitest";
import { fromFriendly, parseIntegrations, renderTemplate, toFriendly } from "./integrations";

describe("plain-language templates", () => {
  it("shows tags as everyday labels and saves them back", () => {
    const stored = "Hi {{contact_name}}, technician {{technician_name}} is on the way.";
    expect(toFriendly(stored)).toBe("Hi [Contact Person], technician [Technician] is on the way.");
    expect(fromFriendly("Hi [contact person], [Technician] coming")).toBe("Hi {{contact_name}}, {{technician_name}} coming");
  });
  it("leaves unknown brackets as typed", () => {
    expect(fromFriendly("Bring [ladder]")).toBe("Bring [ladder]");
  });
  it("renders the on-my-way default wording", () => {
    const t = parseIntegrations({}).templates.on_my_way.body;
    expect(renderTemplate(t, { contact_name: "Alan", technician_name: "Jorey Gloria", eta_window: "30 mins" }))
      .toBe("Hi Alan, technician Jorey Gloria is on the way. Should be there in approximately 30 mins depending on traffic.");
  });
  it("keeps emergency dispatch off external channels", () => {
    expect(parseIntegrations({ templates: { emergency_dispatch: { enabled: true, channels: ["sms"], body: "x" } } }).templates.emergency_dispatch.channels).toEqual([]);
  });
  it("defaults job sheet completed to email and on-the-way to WhatsApp", () => {
    const t = parseIntegrations({}).templates;
    expect(t.job_completed.channels).toEqual(["email"]);
    expect(t.on_my_way.channels).toEqual(["whatsapp"]);
  });
  it("lets companies change those channels", () => {
    expect(parseIntegrations({ templates: { on_my_way: { enabled: true, channels: ["sms"], body: "y" } } }).templates.on_my_way.channels).toEqual(["sms"]);
  });
});
