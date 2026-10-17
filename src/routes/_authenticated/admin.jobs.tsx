import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useProfile, useCompanyUsers, hoursBetween } from "@/lib/profile";
import { AppShell, EmptyState } from "@/components/app-shell";
import { useFieldDefs, renderCustomValues } from "@/components/custom-fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/admin/jobs")({
  head: () => ({
    meta: [
      { title: "Job sheets — FieldOps" },
      { name: "description", content: "Master control of all job sheets: hours, overtime and status." },
      { property: "og:title", content: "Job sheets — FieldOps" },
      { property: "og:description", content: "Master job sheet control." },
    ],
  }),
  component: AdminJobs,
});

const STATUSES = [["draft", "Draft"], ["pending", "Pending"], ["in_transit", "In transit"], ["in_progress", "In progress"], ["completed", "Completed"]] as const;

function AdminJobs() {
  const qc = useQueryClient();
  const { data: defs = [] } = useFieldDefs("job_sheet");
  const [filter, setFilter] = useState("all");
  const [q, setQ] = useState("");
  const { data: jobs = [] } = useQuery({
    queryKey: ["admin-jobs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("job_sheets")
        .select("*, clients(name), assets(reference_number), users(full_name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  const update = async (id: string, patch: Record<string, unknown>) => {
    const { error } = await supabase.from("job_sheets").update(patch as never).eq("id", id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["admin-jobs"] });
  };
  const queue = jobs.filter((j) => j.requires_admin_approval || (j.pending_works_future_jobs ?? "").trim());
  const list = jobs.filter((j) => (filter === "all" || j.status === filter) && `${j.clients?.name} ${j.users?.full_name} ${j.assets?.reference_number}`.toLowerCase().includes(q.toLowerCase()));

  return (
    <AppShell title="Job sheets" actions={<NewJobDialog />}>
      <div className="mb-4 grid gap-2 sm:grid-cols-[minmax(0,1fr)_200px]">
        <Input placeholder="Search client, technician or asset" value={q} onChange={(e) => setQ(e.target.value)} />
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {STATUSES.map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      {queue.length > 0 && (
        <section className="mb-4 rounded-xl border border-warning/50 bg-warning/10 p-4">
          <h2 className="mb-2 font-medium text-foreground">Admin pending queue ({queue.length})</h2>
          <ul className="space-y-2">
            {queue.map((j) => (
              <li key={j.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-lg bg-card p-3 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium"><span className="font-mono text-primary">#{j.jobsheet_number}</span> {j.clients?.name} · {j.users?.full_name ?? "—"}</p>
                  {j.requires_admin_approval && <p className="truncate text-xs text-muted-foreground">Asset changed: model {j.lift_model || "—"}, serial {j.serial_number || "—"}</p>}
                  {j.pending_works_future_jobs && <p className="truncate text-xs text-muted-foreground">Pending works: {j.pending_works_future_jobs}</p>}
                </div>
                <div className="flex gap-1">
                  {j.requires_admin_approval && <Button size="sm" onClick={() => update(j.id, { requires_admin_approval: false })}>Approve asset</Button>}
                  {j.pending_works_future_jobs && <Button size="sm" variant="outline" onClick={() => update(j.id, { pending_works_future_jobs: null })}>Mark scheduled</Button>}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
      {list.length === 0 ? <EmptyState>No job sheets match.</EmptyState> : (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Client / asset</TableHead>
                <TableHead>Technician</TableHead>
                <TableHead className="text-right">Travel h</TableHead>
                <TableHead className="text-right">Work h</TableHead>
                <TableHead>Overtime</TableHead>
                <TableHead className="min-w-56">Custom fields</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map((j) => {
                const cv = renderCustomValues(defs, j.custom_values);
                return (
                  <TableRow key={j.id}>
                    <TableCell>
                      <p className="font-medium text-foreground"><Link to="/sheets/$sheetId" params={{ sheetId: j.id }} className="font-mono text-primary">#{j.jobsheet_number}</Link> {j.clients?.name}</p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {j.requires_admin_approval && <span className="rounded bg-warning/25 px-1.5 text-[10px] text-warning-foreground">Asset edit needs approval</span>}
                        {j.status === "completed" && <Link to="/print/$sheetId" params={{ sheetId: j.id }} target="_blank" className="rounded border px-1.5 text-[10px] text-primary">Client PDF</Link>}
                      </div>
                      <p className="text-xs text-muted-foreground">{j.assets?.reference_number ?? "—"} · {new Date(j.created_at).toLocaleDateString()}</p>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{j.users?.full_name ?? <span className="text-muted-foreground">Unassigned</span>}</TableCell>
                    <TableCell className="text-right tabular-nums">{hoursBetween(j.travel_start_time, j.work_start_time ?? j.work_end_time).toFixed(2)}</TableCell>
                    <TableCell className="text-right tabular-nums">{hoursBetween(j.work_start_time, j.work_end_time).toFixed(2)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Switch checked={j.is_overtime} onCheckedChange={(c) => update(j.id, { is_overtime: c })} />
                        {j.is_overtime && j.overtime_rate && <span className="text-xs text-muted-foreground">×{j.overtime_rate}</span>}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{cv.length ? cv.join(" · ") : "—"}</TableCell>
                    <TableCell>
                      <Select value={j.status} onValueChange={(v) => update(j.id, { status: v })}>
                        <SelectTrigger className="h-8 w-36"><SelectValue /></SelectTrigger>
                        <SelectContent>{STATUSES.map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </AppShell>
  );
}

function NewJobDialog() {
  const { data: profile } = useProfile();
  const { data: users = [] } = useCompanyUsers();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const empty = { client_id: "", site_id: "none", asset_id: "none", tech: "none", scheduled_date: new Date().toISOString().slice(0, 10), window_start: "", window_end: "", priority: "normal", problem_summary: "" };
  const [f, setF] = useState(empty);
  const { data: clients = [] } = useQuery({ queryKey: ["clients"], queryFn: async () => (await supabase.from("clients").select("id, name").order("name")).data ?? [] });
  const { data: sites = [] } = useQuery({ queryKey: ["sites"], queryFn: async () => (await supabase.from("sites").select("id, client_id, name").order("name")).data ?? [] });
  const { data: assets = [] } = useQuery({ queryKey: ["assets-all"], queryFn: async () => (await supabase.from("assets").select("id, client_id, site_id, reference_number, asset_category")).data ?? [] });

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !f.client_id) { toast.error("Pick a client"); return; }
    const { error } = await supabase.from("jobs").insert({
      company_id: profile.company_id, client_id: f.client_id,
      site_id: f.site_id === "none" ? null : f.site_id, asset_id: f.asset_id === "none" ? null : f.asset_id,
      assigned_technician_id: f.tech === "none" ? null : f.tech, scheduled_date: f.scheduled_date,
      window_start: f.window_start || null, window_end: f.window_end || null, priority: f.priority, problem_summary: f.problem_summary || null,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Visit scheduled");
    setOpen(false); setF(empty);
    qc.invalidateQueries({ queryKey: ["schedule"] });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm"><Plus className="mr-1 h-4 w-4" />Schedule visit</Button></DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Schedule a visit</DialogTitle></DialogHeader>
        <form onSubmit={save} className="space-y-3">
          <Select value={f.client_id} onValueChange={(v) => setF({ ...f, client_id: v, site_id: "none", asset_id: "none" })}>
            <SelectTrigger><SelectValue placeholder={clients.length ? "Client" : "Add a client first"} /></SelectTrigger>
            <SelectContent>{clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
          </Select>
          <div className="grid gap-3 sm:grid-cols-2">
            <Select value={f.site_id} onValueChange={(v) => setF({ ...f, site_id: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="none">No site</SelectItem>{sites.filter((s) => s.client_id === f.client_id).map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={f.asset_id} onValueChange={(v) => setF({ ...f, asset_id: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="none">No lift</SelectItem>{assets.filter((a) => a.client_id === f.client_id).map((a) => <SelectItem key={a.id} value={a.id}>{a.reference_number} · {a.asset_category}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={f.tech} onValueChange={(v) => setF({ ...f, tech: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="none">Unassigned</SelectItem>{users.map((u) => <SelectItem key={u.id} value={u.id}>{u.full_name}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={f.priority} onValueChange={(v) => setF({ ...f, priority: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{["low", "normal", "high", "urgent"].map((p) => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5"><Label>Date</Label><Input type="date" required value={f.scheduled_date} onChange={(e) => setF({ ...f, scheduled_date: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>From</Label><Input type="time" value={f.window_start} onChange={(e) => setF({ ...f, window_start: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>To</Label><Input type="time" value={f.window_end} onChange={(e) => setF({ ...f, window_end: e.target.value })} /></div>
          </div>
          <div className="space-y-1.5"><Label>Problem summary</Label><Textarea value={f.problem_summary} onChange={(e) => setF({ ...f, problem_summary: e.target.value })} /></div>
          <Button type="submit" className="w-full">Schedule</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
