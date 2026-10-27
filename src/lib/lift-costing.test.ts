import { describe, expect, it } from "vitest";
import { clientLines, comparisonMatrix, costBreakdown, emptyCosting, normalizeCosting, priceWith, reconcileClientLines, stageAmounts, STAGE_PRESETS } from "./lift-costing";

const sample = () => ({
  ...emptyCosting(),
  equipment_cost: 20000, freight_cost: 1500, customs_cost: 500,
  mechanical_hours: 80, mechanical_rate: 25, electrical_hours: 24, electrical_rate: 30,
  third_party: [{ label: "Crane", amount: 1200 }, { label: "Permits", amount: 300 }],
  dismantling_cost: 2500, certification_cost: 800,
  equipment_markup_pct: 25, labour_markup_pct: 25, subcontractor_markup_pct: 15, contingency_pct: 5,
});

describe("lift costing engine", () => {
  it("breaks down supply, labour, third-party, dismantling and certification into a total cost", () => {
    const c = costBreakdown(sample());
    expect(c.supply).toBe(22000);
    expect(c.labour).toBe(80 * 25 + 24 * 30); // 2720
    expect(c.thirdParty).toBe(1500);
    expect(c.total).toBe(22000 + 2720 + 1500 + 2500 + 800); // 29520
  });

  it("applies markups per section plus contingency, and reports profit and margin", () => {
    const d = sample();
    const p = priceWith(d, 25, 25, 15);
    const marked = 22000 * 1.25 + 2720 * 1.25 + (1500 + 2500 + 800) * 1.15;
    expect(p.price).toBeCloseTo(Math.round(marked * 1.05 * 100) / 100, 2);
    expect(p.profit).toBeCloseTo(p.price - 29520, 2);
    expect(p.margin_pct).toBeGreaterThan(0);
    expect(p.margin_pct).toBeLessThan(100);
  });

  it("comparison matrix orders competitive < standard < premium and includes current markups", () => {
    const m = comparisonMatrix(sample());
    expect(m.map((s) => s.key)).toEqual(["competitive", "standard", "premium", "current"]);
    expect(m[0]!.price).toBeLessThan(m[1]!.price);
    expect(m[1]!.price).toBeLessThan(m[2]!.price);
  });

  it("stage payments sum exactly to the client price", () => {
    const amounts = stageAmounts(31234.56, STAGE_PRESETS["new_installation"]!);
    expect(amounts).toHaveLength(4);
    expect(amounts.reduce((s, a) => s + a.amount, 0)).toBeCloseTo(31234.56, 2);
  });

  it("client lines hide raw costs and margins, include dismantling only when present, and reconcile to the price", () => {
    const d = sample();
    const lines = reconcileClientLines(d);
    const target = priceWith(d, 25, 25, 15).price;
    expect(lines.reduce((s, l) => s + l.amount, 0)).toBeCloseTo(target, 2);
    expect(lines.some((l) => l.description.toLowerCase().includes("dismantling"))).toBe(true);
    expect(lines.every((l) => !l.description.match(/supplier|cost|markup|margin/i))).toBe(true);
    const noDismantle = clientLines({ ...d, dismantling_cost: 0 });
    expect(noDismantle.some((l) => l.description.toLowerCase().includes("dismantling"))).toBe(false);
  });

  it("normalizeCosting coerces a DB row and defaults markups", () => {
    const d = normalizeCosting({ id: "x", equipment_cost: "12000", third_party_costs: [{ label: "Crane", amount: "900" }], stage_payments: STAGE_PRESETS["modernisation"] });
    expect(d.isNew).toBe(false);
    expect(d.equipment_cost).toBe(12000);
    expect(d.third_party).toEqual([{ label: "Crane", amount: 900 }]);
    expect(d.stages).toHaveLength(3);
    expect(d.equipment_markup_pct).toBe(25);
    expect(normalizeCosting(null).isNew).toBe(true);
  });
});

import { applyTemplate, normalizeTemplate, proposalSummary, specRows } from "./lift-costing";

describe("costing templates & proposal output", () => {
  const base = () => ({ ...emptyCosting(), equipment_cost: 20000, freight_cost: 4000, customs_cost: 0, equipment_markup_pct: 25, labour_markup_pct: 25, subcontractor_markup_pct: 15, contingency_pct: 0, vat_pct: 18 });

  it("turnkey style produces exactly one line equal to the full price", () => {
    const s = proposalSummary({ ...base(), output_style: "turnkey" });
    expect(s.lines).toHaveLength(1);
    expect(s.lines[0]!.amount).toBe(30000);
    expect(s.grandTotal).toBe(35400);
  });

  it("net + VAT + shipping style splits freight out and adds VAT to shipping", () => {
    const s = proposalSummary({ ...base(), output_style: "net_vat_shipping" });
    expect(s.net).toBe(25000);
    expect(s.vat).toBe(4500);
    expect(s.total).toBe(29500);
    expect(s.shippingNet).toBe(5000);
    expect(s.shippingIncVat).toBe(5900);
    expect(s.grandTotal).toBe(35400);
  });

  it("only selected options are added to the grand total", () => {
    const s = proposalSummary({ ...base(), output_style: "turnkey", options: [{ label: "Glass wall", amount: 1000, selected: true }, { label: "Remote", amount: 500, selected: false }] });
    expect(s.optionsNet).toBe(1000);
    expect(s.grandNet).toBe(31000);
  });

  it("applying a template sets its markups but keeps entered hours", () => {
    const t = normalizeTemplate({ id: "00000000-0000-0000-0000-000000000001", name: "China goods", equipment_type: "goods_lift", output_style: "net_vat_shipping", defaults: { equipment_markup_pct: 20, mechanical_hours: 40 } });
    const d = applyTemplate({ ...base(), mechanical_hours: 12 }, t);
    expect(d.equipment_markup_pct).toBe(20);
    expect(d.mechanical_hours).toBe(12);
    expect(d.output_style).toBe("net_vat_shipping");
  });

  it("4-post lifts can still carry shaft dimensions when the group is switched on", () => {
    const d = { ...base(), equipment_type: "four_post", spec_groups: ["platform", "shaft"], specs: { pit_depth: "150", door_type: "none" } };
    expect(specRows(d).map((r) => r.value)).toEqual(["150"]);
  });
});
