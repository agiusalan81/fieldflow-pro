import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Profile } from "./profile";

const { from, writes, state } = vi.hoisted(() => ({
  from: vi.fn(), writes: [] as Record<string, unknown>[], state: { status: "draft", error: null as { message: string } | null },
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from } }));
import { startJobTravel } from "./jobsheets";

describe("assigned job travel", () => {
  beforeEach(() => {
    writes.length = 0; state.status = "draft"; state.error = null;
    from.mockImplementation((table: string) => {
      const chain: Record<string, any> = {};
      for (const method of ["select", "eq", "neq", "order", "limit", "is"]) chain[method] = () => chain;
      chain.update = (value: Record<string, unknown>) => { writes.push({ table, ...value }); return chain; };
      chain.maybeSingle = async () => ({ data: { id: "sheet-1", status: state.status }, error: null });
      chain.single = async () => ({ data: { id: "sheet-1", status: state.status }, error: state.error });
      chain.then = (resolve: (value: unknown) => unknown) => Promise.resolve({ error: state.error }).then(resolve);
      return chain;
    });
  });
  const profile = { id: "tech-1", company_id: "company-1", full_name: "Test Technician" } as Profile;
  it("Start travel marks the sheet in transit and records departure, not arrival", async () => {
    expect(await startJobTravel(profile, "job-1")).toBe("sheet-1");
    expect(writes[0]).toEqual({ table: "job_sheets", status: "in_transit", travel_start_time: expect.any(String) });
    expect(writes[1]).toEqual({ table: "jobs", acknowledged_at: expect.any(String) });
  });
  it("reopening a travelling job preserves its departure timestamp", async () => {
    state.status = "in_transit";
    await startJobTravel(profile, "job-1");
    expect(writes.filter((w) => w.table === "job_sheets")).toEqual([]);
  });
  it.each(["in_progress", "completed"])("does not send an %s job back into transit", async (status) => {
    state.status = status;
    await expect(startJobTravel(profile, "job-1")).rejects.toThrow("Open its job sheet instead");
    expect(writes).toEqual([]);
  });
  it("a failed status save does not acknowledge the job", async () => {
    state.error = { message: "Save denied" };
    await expect(startJobTravel(profile, "job-1")).rejects.toEqual(state.error);
    expect(writes.filter((w) => w.table === "jobs")).toEqual([]);
  });
});