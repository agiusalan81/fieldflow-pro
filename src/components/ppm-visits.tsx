import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ppmStatus } from "@/lib/ppm";
import { useCompanyUsers } from "@/lib/profile";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
export function PpmVisits({
  canManage = false,
  assetId,
}: {
  canManage?: boolean;
  assetId?: string;
}) {
  const qc = useQueryClient();
  const users = useCompanyUsers();
  const today = new Date().toISOString().slice(0, 10);
  const q = useQuery({
    queryKey: ["ppm-visits", assetId],
    queryFn: async () => {
      let query = supabase
        .from("jobs")
        .select(
          "id,job_number,scheduled_date,assigned_technician_id,ppm_due_date,ppm_deadline,asset_id,assets(reference_number),clients(name),job_sheets!job_sheets_job_id_fkey(id,status)",
        )
        .not("ppm_plan_id", "is", null)
        .order("ppm_due_date")
        .limit(500);
      if (assetId) query = query.eq("asset_id", assetId);
      const r = await query;
      if (r.error) throw r.error;
      return r.data;
    },
  });
  const assign = async (id: string, lead: string) => {
    const r = await supabase
      .from("jobs")
      .update({ assigned_technician_id: lead === "none" ? null : lead })
      .eq("id", id);
    if (r.error) {
      toast.error(r.error.message);
      return;
    }
    await Promise.all(
      ["ppm-visits", "schedule", "dashboard"].map((key) =>
        qc.invalidateQueries({ queryKey: [key] }),
      ),
    );
    toast.success("Visit assigned");
  };
  if (q.isPending)
    return <p className="text-sm text-muted-foreground">Loading maintenance visits…</p>;
  if (q.error)
    return (
      <p role="alert" className="text-destructive">
        Maintenance visits could not be loaded.
      </p>
    );
  const rows = q.data ?? [];
  const overdue = rows.filter(
    (j) =>
      !j.job_sheets.some((s) => s.status === "completed") && (j.ppm_deadline ?? "9999") < today,
  );
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">Scheduled maintenance visits (PPM)</h2>
        <span
          className={
            overdue.length
              ? "text-sm font-medium text-destructive"
              : "text-sm text-muted-foreground"
          }
        >
          {overdue.length} SLA overdue
        </span>
      </div>
      {!rows.length ? (
        <p className="text-sm text-muted-foreground">No maintenance visits.</p>
      ) : (
        <ul className="divide-y border-y">
          {rows.map((j) => {
            const completed = j.job_sheets.some((s) => s.status === "completed");
            const state = ppmStatus(
              j.ppm_due_date ?? j.scheduled_date ?? today,
              j.ppm_deadline ?? j.scheduled_date ?? today,
              completed,
              today,
            );
            const sheet = j.job_sheets.find((s) => s.status === "completed") ?? j.job_sheets[0];
            return (
              <li key={j.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="break-words font-medium">
                    #{j.job_number} · {j.assets?.reference_number} · {j.clients?.name}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Visit {j.scheduled_date} · deadline {j.ppm_deadline}
                  </p>
                  <p
                    className={
                      state === "SLA overdue"
                        ? "text-xs font-medium text-destructive"
                        : "text-xs text-muted-foreground"
                    }
                  >
                    {state}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {canManage && !completed && (
                    <Select
                      value={j.assigned_technician_id ?? "none"}
                      onValueChange={(v) => assign(j.id, v)}
                    >
                      <SelectTrigger className="w-48" aria-label={`Assign visit ${j.job_number}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Unassigned</SelectItem>
                        {users.data
                          ?.filter((u) => ['technician','supervisor','maintenance'].includes(u.role))
                          .map((u) => (
                            <SelectItem value={u.id} key={u.id}>
                              {u.full_name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  )}
                  {sheet && (
                    <Button asChild variant="outline" size="sm">
                      <Link to="/sheets/$sheetId" params={{ sheetId: sheet.id }}>
                        Open sheet
                      </Link>
                    </Button>
                  )}
                  {j.asset_id && (
                    <Button asChild variant="ghost" size="sm">
                      <Link to="/equipment/$assetId" params={{ assetId: j.asset_id }}>
                        Equipment
                      </Link>
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {rows.length === 500 && (
        <p className="text-xs text-muted-foreground">Showing the first 500 visits.</p>
      )}
    </section>
  );
}
