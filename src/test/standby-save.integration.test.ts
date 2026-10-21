// Run against a consenting supervisor session using the three STANDBY_TEST_* variables.
import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

const url = process.env.STANDBY_TEST_URL;
const key = process.env.STANDBY_TEST_KEY;
const token = process.env.STANDBY_TEST_TOKEN;

describe.skipIf(!url || !key || !token)("supervisor standby save boundary", () => {
  function client() {
    if (!url || !key || !token) throw new Error("Supervisor test session required");
    return createClient(url, key, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  it("lets a supervisor save the existing roster without changing payroll or other settings", async () => {
    const db = client();
    const before = await db.from("company_settings").select("*").single();
    expect(before.error).toBeNull();
    if (!before.data) throw new Error("Company settings required");
    const saved = await db.rpc("save_standby_roster", {
      _start: before.data.standby_start,
      _rotation_days: before.data.standby_rotation_days,
      _per_shift: before.data.standby_per_shift,
      _order: before.data.standby_order,
    });
    expect(saved.error).toBeNull();
    const after = await db.from("company_settings").select("*").single();
    expect(after.error).toBeNull();
    expect(after.data).toEqual(before.data);
  });

  it("still rejects supervisor payroll setup saves", async () => {
    const db = client();
    const user = await db.auth.getUser(token);
    if (!user.data.user) throw new Error("Supervisor session required");
    const saved = await db.rpc("save_employee_payroll_setup", {
      _user: user.data.user.id, _year: 2026,
      _wage: {}, _config: {}, _opening: {},
    });
    expect(saved.error?.message).toBe("Office access to this employee is required");
  });
});