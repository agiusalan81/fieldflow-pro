import { describe, it, expect, afterEach } from "vitest";
import { setTenantLocale, tenantLocale, formatMoney, DEFAULT_LOCALE } from "./locale";
import { returnFeeLine } from "./billing";

afterEach(() => setTenantLocale(DEFAULT_LOCALE));
describe("tenant locale", () => {
  it("formats money in the company's currency", () => { setTenantLocale({ currency: "GBP" }); expect(formatMoney(10)).toBe("£10.00"); });
  it("falls back to Malta defaults for invalid values", () => { setTenantLocale({ currency: "XXX", countryCode: "356" }); expect(tenantLocale()).toMatchObject({ currency: "EUR", countryCode: "+356" }); });
  it("uses the company's equipment word on the return fee", () => expect(returnFeeLine(1, { standard: 40, ot15: 0, ot20: 0, callout: 0 }, "chiller")?.description).toContain("restore chiller"));
});
