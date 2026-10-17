import { createFileRoute } from "@tanstack/react-router";
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

const STATUSES = [["pending", "Pending"], ["in_transit", "In transit"], ["in_progress", "In progress"], ["completed", "Completed"]] as const;

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
    const { error } = await supabase.from("job_sheets").update(patch).eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["admin-jobs"] });
  };
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
                      <p className="font-medium text-foreground">{j.clients?.name}</p>
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
  const [f, setF] = useState({ client_id: "", asset_id: "none", tech: "none", notes: "", is_overtime: false, overtime_rate: "" });
  const { data: clients = [] } = useQuery({ queryKey: ["clients"], queryFn: async () => (await supabase.from("clients").select("id, name").order("name")).data ?? [] });
  const { data: assets = [] } = useQuery({ queryKey: ["assets-all"], queryFn: async () => (await supabase.from("assets").select("id, client_id, reference_number, asset_category")).data ?? [] });

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !f.client_id) return toast.error("Pick a client");
    const { error } = await supabase.from("job_sheets").insert({
      company_id: profile.company_id, client_id: f.client_id,
      asset_id: f.asset_id === "none" ? null : f.asset_id,
      assigned_technician_id: f.tech === "none" ? null : f.tech,
      notes: f.notes || null, is_overtime: f.is_overtime, overtime_rate: f.overtime_rate ? Number(f.overtime_rate) : null,
    });
    if (error) return toast.error(error.message);
    toast.success("Job sheet created");
    setOpen(false);
    setF({ client_id: "", asset_id: "none", tech: "none", notes: "", is_overtime: false, overtime_rate: "" });
    qc.invalidateQueries({ queryKey: ["admin-jobs"] });
    qc.invalidateQueries({ queryKey: ["overview"] });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm"><Plus className="mr-1 h-4 w-4" />New job</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>New job sheet</DialogTitle></DialogHeader>
        <form onSubmit={save} className="space-y-3">
          <div className="space-y-1.5">
            <Label>Client</Label>
            <Select value={f.client_id} onValueChange={(v) => setF({ ...f, client_id: v, asset_id: "none" })}>
              <SelectTrigger><SelectValue placeholder={clients.length ? "Choose client" : "Add a client first"} /></SelectTrigger>
              <SelectContent>{clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Asset</Label>
              <Select value={f.asset_id} onValueChange={(v) => setF({ ...f, asset_id: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {assets.filter((a) => a.client_id === f.client_id).map((a) => <SelectItem key={a.id} value={a.id}>{a.reference_number} · {a.asset_category}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Technician</Label>
              <Select value={f.tech} onValueChange={(v) => setF({ ...f, tech: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Unassigned</SelectItem>
                  {users.map((u) => <SelectItem key={u.id} value={u.id}>{u.full_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-[auto_minmax(0,1fr)] items-end gap-3">
            <label className="flex h-10 items-center gap-2 text-sm"><Switch checked={f.is_overtime} onCheckedChange={(c) => setF({ ...f, is_overtime: c })} />Overtime</label>
            <div className="space-y-1.5"><Label>Overtime rate (×)</Label><Input type="number" step="0.1" disabled={!f.is_overtime} value={f.overtime_rate} onChange={(e) => setF({ ...f, overtime_rate: e.target.value })} /></div>
          </div>
          <div className="space-y-1.5"><Label>Notes</Label><Textarea value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></div>
          <Button type="submit" className="w-full">Create job</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
