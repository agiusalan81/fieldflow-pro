import { describe, expect, it } from "vitest";
import { billingPeriod, buildInvoice, reminderStage, storageLevel } from "./saas-billing";

describe("saas billing", () => {
  it("quarterly period ends the day before the next quarter", () => {
    expect(billingPeriod("2026-01-01", "quarterly")).toEqual({ period_start: "2026-01-01", period_end: "2026-03-31", next_start: "2026-04-01" });
  });
  it("per-user items multiply by users, per-company once, VAT added", () => {
    const inv = buildInvoice([{ name: "Plan", price: 100, billing_basis: "company" }, { name: "Seat pack", price: 5, billing_basis: "per_user" }], 10, null, 18);
    expect(inv.subtotal).toBe(150); expect(inv.vat).toBe(27); expect(inv.total).toBe(177);
  });
  it("lower agreed price becomes a discount", () => {
    const inv = buildInvoice([{ name: "Plan", price: 100, billing_basis: "company" }], 1, 80, 0);
    expect(inv.discount).toBe(20); expect(inv.total).toBe(80);
  });
  it("reminder stages follow due date", () => {
    const i = { status: "sent", issue_date: "2026-05-01", due_date: "2026-05-15", period_end: "2026-05-31" };
    expect(reminderStage(i, "2026-05-12")).toBe("due_3d");
    expect(reminderStage(i, "2026-05-15")).toBe("due_today");
    expect(reminderStage(i, "2026-05-22")).toBe("overdue_7d");
    expect(reminderStage(i, "2026-05-29")).toBe("overdue_14d");
    expect(reminderStage(i, "2026-06-14")).toBe("overdue_30d");
    expect(reminderStage({ ...i, status: "paid" }, "2026-06-14")).toBeNull();
  });
  it("storage warns at 80, 90 and 100%", () => {
    const gb = 1024 ** 3;
    expect(storageLevel(8 * gb, 10).level).toBe("warning");
    expect(storageLevel(9 * gb, 10).level).toBe("critical");
    expect(storageLevel(10 * gb, 10).level).toBe("full");
    expect(storageLevel(1 * gb, 10).level).toBe("ok");
  });
});
