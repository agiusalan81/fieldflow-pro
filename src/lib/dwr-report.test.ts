import { beforeEach, expect, it, vi } from "vitest";
const { from, rpc, state } = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn(), state: { existing: false, conflict: false, inserts: 0 } }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from, rpc } }));
import { fileDailyReport } from "./dwr-report";
import { DEFAULT_RULES } from "./jobsheets";
const input = { userId: "tech", companyId: "company", shiftId: "shift", startedAt: "2026-10-19T19:53:23Z", endedAt: "2026-10-19T19:53:51Z", rules: DEFAULT_RULES, breaks: { enabled: true, count: 1, minutes: 30 } };
beforeEach(() => {
  state.existing = false; state.conflict = false; state.inserts = 0;
  rpc.mockResolvedValue({ data: [], error: null });
  from.mockImplementation((table: string) => {
    let inserting = false;
    const chain: Record<string, any> = {};
    for (const name of ["select", "eq", "order"]) chain[name] = () => chain;
    chain.insert = (row: Record<string, unknown>) => { inserting = true; state.inserts++; expect(row.worked_hours).toBe(0); expect(row.ot15_hours).toBe(0); return chain; };
    chain.maybeSingle = async () => ({ data: table === "daily_work_reports" && state.existing ? { id: "canonical" } : null, error: null });
    chain.single = async () => inserting && state.conflict ? { data: null, error: { code: "23505" } } : { data: { id: "canonical" }, error: null };
    chain.then = (resolve: (v: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(resolve);
    return chain;
  });
});
it("returns the existing report without inserting another", async () => { state.existing = true; expect(await fileDailyReport(input)).toBe("canonical"); expect(state.inserts).toBe(0); });
it("a concurrent filing conflict returns the winning report", async () => { state.conflict = true; expect(await fileDailyReport(input)).toBe("canonical"); expect(state.inserts).toBe(1); });
it("same-minute shifts file zero rather than 23.50 hours", async () => { expect(await fileDailyReport(input)).toBe("canonical"); expect(state.inserts).toBe(1); });