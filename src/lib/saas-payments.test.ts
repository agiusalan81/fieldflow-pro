import { describe, expect, it } from "vitest";
import { classifyChange, isLapsed, isPayable, paymentMatches, renewalDue, toMinorUnits, upgradeProration } from "./saas-billing";

describe("FieldBridge payments and plan changes", () => {
  it("company becomes read-only only after 14 days overdue", () => {
    const inv = { status: "sent", due_date: "2026-05-01" };
    expect(isLapsed(inv, "2026-05-15")).toBe(false);
    expect(isLapsed(inv, "2026-05-16")).toBe(true);
    expect(isLapsed({ ...inv, status: "paid" }, "2026-06-30")).toBe(false);
  });
  it("only issued unpaid invoices can be paid", () => {
    expect(isPayable({ status: "sent", total: 100 })).toBe(true);
    expect(isPayable({ status: "draft", total: 100 })).toBe(false);
    expect(isPayable({ status: "paid", total: 100 })).toBe(false);
  });
  it("payment must match exact amount and currency", () => {
    expect(toMinorUnits(177.1)).toBe(17710);
    expect(paymentMatches({ total: "177.10", currency: "EUR" }, 17710, "eur")).toBe(true);
    expect(paymentMatches({ total: "177.10", currency: "EUR" }, 17700, "eur")).toBe(false);
    expect(paymentMatches({ total: "177.10", currency: "EUR" }, 17710, "usd")).toBe(false);
  });
  it("upgrades charge now, downgrades wait", () => {
    expect(classifyChange(100, 150)).toBe("upgrade");
    expect(classifyChange(150, 100)).toBe("downgrade");
  });
  it("upgrade charges the difference for the remaining days", () => {
    // 30-day period, upgrade on day 16 leaves 15 days: (160-100) * 15/30 = 30
    expect(upgradeProration(100, 160, "2026-06-01", "2026-06-30", "2026-06-16").amount).toBe(30);
    expect(upgradeProration(160, 100, "2026-06-01", "2026-06-30", "2026-06-16").amount).toBe(0);
  });
  it("renewal invoice is prepared 7 days before period end", () => {
    expect(renewalDue("2026-06-30", "2026-06-22")).toBe(false);
    expect(renewalDue("2026-06-30", "2026-06-23")).toBe(true);
  });
});
