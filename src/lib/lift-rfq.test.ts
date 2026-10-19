import { describe, expect, it } from "vitest";
import { RFQ_FIELDS, alignToSupplier, optionsFor, parseEstimateConfig, reminderDue, straighten, suggestedPersons, suppliersOffering } from "./lift-rfq";

const cfg = parseEstimateConfig({});
const door = RFQ_FIELDS.find((f) => f.key === "door_brand")!;

describe("lift estimate requests", () => {
  it("AH&MET packages only offer Fermator, AHZ and AHZ Plus doors", () => {
    expect(optionsFor(door, cfg, "AH&MET")).toEqual(["Fermator", "AHZ", "AHZ Plus"]);
  });
  it("without a supplier every door brand is offered", () => expect(optionsFor(door, cfg, null)).toContain("Wittur"));
  it("switching supplier clears options the new supplier does not offer", () => {
    expect(alignToSupplier({ door_brand: "Wittur", voltage: "230V 1-phase" }, cfg, "AH&MET")).toEqual({ voltage: "230V 1-phase" });
  });
  it("suggests which supplier offers an option", () => expect(suppliersOffering(door, "AHZ Plus", cfg)).toEqual(["AH&MET"]));
  it("persons suggested from load ÷ 75", () => expect(suggestedPersons("630 kg")).toBe(8));
});

describe("supplier reminders", () => {
  const sent = { status: "sent", sent_at: "2026-10-01T09:00:00Z", last_reminder_at: null, reminders_sent: 0, reminders_paused: false };
  const at = (d: string) => Date.parse(d);
  it("first reminder after 5 days by default", () => {
    expect(reminderDue(sent, cfg, at("2026-10-05T09:00:00Z"))).toBeNull();
    expect(reminderDue(sent, cfg, at("2026-10-06T09:00:00Z"))).toBe("due");
  });
  it("repeats every 3 days after the last reminder", () => {
    const s = { ...sent, reminders_sent: 1, last_reminder_at: "2026-10-06T09:00:00Z" };
    expect(reminderDue(s, cfg, at("2026-10-08T09:00:00Z"))).toBeNull();
    expect(reminderDue(s, cfg, at("2026-10-09T09:00:00Z"))).toBe("due");
  });
  it("after the maximum reminders it asks for a phone call", () => {
    expect(reminderDue({ ...sent, reminders_sent: 3, last_reminder_at: "2026-10-12T09:00:00Z" }, cfg, at("2026-10-20T09:00:00Z"))).toBe("call");
  });
  it("stops once the estimate is received or reminders are paused", () => {
    expect(reminderDue({ ...sent, status: "quoted" }, cfg, at("2026-12-01"))).toBeNull();
    expect(reminderDue({ ...sent, reminders_paused: true }, cfg, at("2026-12-01"))).toBeNull();
  });
});

describe("sketch straightening", () => {
  it("snaps a slightly wobbly stroke to a line", () => expect(straighten([{ x: 0, y: 0 }, { x: 50, y: 2 }, { x: 100, y: 0 }])).toHaveLength(2));
  it("keeps a curve", () => expect(straighten([{ x: 0, y: 0 }, { x: 50, y: 40 }, { x: 100, y: 0 }])).toHaveLength(3));
});
