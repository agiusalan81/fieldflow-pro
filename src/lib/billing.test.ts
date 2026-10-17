import { describe, it, expect } from "vitest";
import { pickSource, draftLines, linesTotal, ratesFor } from "./billing";
import { renderTemplate, parseIntegrations } from "./integrations";

const company = { standard: 60, ot15: 90, ot20: 120, callout: 30 };
const client = { standard: 50, ot15: 75, ot20: 100, callout: 0 };
const hours = { standard: 2, ot15: 1, ot20: 0 };

describe("billing", () => {
  it("fixed estimate wins over every rate", () => {
    expect(pickSource({ estimate: true, contract: true, clientRates: true })).toBe("estimate");
  });
  it("contract beats client rates, client beats company", () => {
    expect(pickSource({ estimate: false, contract: true, clientRates: true })).toBe("contract");
    expect(pickSource({ estimate: false, contract: false, clientRates: true })).toBe("client");
    expect(pickSource({ estimate: false, contract: false, clientRates: false })).toBe("company");
  });
  it("client rate card is used for client-specific pricing", () => {
    expect(linesTotal(draftLines({ source: "client", hours, company, client }))).toBe(175);
  });
  it("company rates apply when client has none", () => {
    expect(ratesFor("client", company, null)).toEqual(company);
    expect(linesTotal(draftLines({ source: "company", hours, company, client }))).toBe(210);
  });
  it("contract discount reduces labour", () => {
    expect(linesTotal(draftLines({ source: "contract", hours, company, client: null, contractDiscountPct: 50 }))).toBe(105);
  });
  it("fixed-price estimate ignores actual hours", () => {
    const ls = draftLines({ source: "estimate", hours, company, client, estimate: { title: "Door", price: 450, fixedLabor: true } });
    expect(linesTotal(ls)).toBe(450);
  });
  it("estimate without fixed labour adds hours from the job sheet", () => {
    const ls = draftLines({ source: "estimate", hours, company, client, estimate: { title: "Door", price: 450, fixedLabor: false } });
    expect(linesTotal(ls)).toBe(625);
  });
});

describe("message templates", () => {
  it("fills merge tags and blanks unknown ones", () => {
    expect(renderTemplate("Hi {{contact_name}} {{nope}}!", { contact_name: "Sarah" })).toBe("Hi Sarah !");
  });
  it("accounting review is on by default", () => {
    expect(parseIntegrations({}).accounting.require_review).toBe(true);
  });
});
