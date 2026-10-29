import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { History, LogIn, LogOut, Plus, Search, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Profile } from "@/lib/profile";
import { canSignIn, canSignOut, isInventoryManager, isOverdue, TOOL_CATEGORIES, TOOL_STATUS_LABEL, type ControlMode, type ToolStatus } from "@/lib/inventory-control";
import { EmptyState } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Tool = { id: string; tag: string; name: string; model: string | null; serial_number: string | null; category: string; default_location: string | null; status: ToolStatus; inspection_due: string | null; holder_id: string | null; notes: string | null };
type Log = { id: string; tool_id: string; holder_id: string; issued_by: string; destination: string | null; checked_out_at: string; expected_return: string | null; returned_at: string | null; return_condition: string | null; return_notes: string | null };

const STATUS_STYLE: Record<ToolStatus, string> = {
  available: "bg-success/15 text-success",
  checked_out: "bg-warning/15 text-warning",
  in_maintenance: "bg-destructive/10 text-destructive",
  decommissioned: "bg-muted text-muted-foreground",
};

export function useInventoryModes(companyId?: string) {
  return useQuery({
    queryKey: ["inventory-modes", companyId], enabled: !!companyId,
    queryFn: async () => {
      const { data } = await supabase.from("company_settings").select("tool_checkout_mode, parts_control_mode").eq("company_id", companyId!).maybeSingle();
      return { tools: (data?.tool_checkout_mode ?? "managed") as ControlMode, parts: (data?.parts_control_mode ?? "managed") as ControlMode };
    },
  });
}

export function ToolRegister({ profile }: { profile: Profile }) {
  const qc = useQueryClient();
  const manager = isInventoryManager(profile.role);
  const mode = useInventoryModes(profile.company_id).data?.tools ?? "managed";
  const [q, setQ] = useState("");
  const [edit, setEdit] = useState<Partial<Tool> | null>(null);
  const [out, setOut] = useState<Tool | null>(null);
  const [back, setBack] = useState<Tool | null>(null);
  const [hist, setHist] = useState<Tool | null>(null);

  const tools = useQuery({ queryKey: ["company-tools"], queryFn: async () => ((await supabase.from("company_tools").select("*").order("tag")).data ?? []) as Tool[] });
  const open = useQuery({ queryKey: ["tool-open-logs"], queryFn: async () => ((await supabase.from("tool_custody_logs").select("*").is("returned_at", null)).data ?? []) as Log[] });
  const team = useQuery({ queryKey: ["tool-team"], queryFn: async () => (await supabase.from("users").select("id, full_name").order("full_name")).data ?? [] });
  const name = (id?: string | null) => team.data?.find((u) => u.id === id)?.full_name ?? "—";
  const refresh = () => { qc.invalidateQueries({ queryKey: ["company-tools"] }); qc.invalidateQueries({ queryKey: ["tool-open-logs"] }); qc.invalidateQueries({ queryKey: ["tool-history"] }); };

  const list = (tools.data ?? []).filter((t) => !q || `${t.tag} ${t.name} ${t.model ?? ""} ${t.serial_number ?? ""} ${t.category}`.toLowerCase().includes(q.toLowerCase()));
  const today = new Date().toISOString().slice(0, 10);

  const remove = async (t: Tool) => {
    if (!confirm(`Delete ${t.tag} ${t.name}? Its custody history will also be removed. Use "Retired" status to keep history.`)) return;
    const { error } = await supabase.from("company_tools").delete().eq("id", t.id);
    if (error) { toast.error(error.message); return; }
    refresh();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input className="h-10 pl-9" placeholder="Search tag, name, serial…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        {manager && <Button onClick={() => setEdit({ category: "General", status: "available" })}><Plus className="mr-1 h-4 w-4" />Add tool</Button>}
      </div>
      <p className="text-xs text-muted-foreground">{mode === "self_service" ? "Self-service: technicians can sign tools out to themselves and return them." : "Managed: only office and supervisors sign tools in and out."}</p>
      {tools.isPending ? <p role="status" className="text-muted-foreground">Loading tools…</p> : list.length === 0 ? <EmptyState>{q ? "No tools match." : "No tools registered yet."}</EmptyState> : (
        <ul className="divide-y rounded-xl border bg-card">
          {list.map((t) => {
            const log = open.data?.find((l) => l.tool_id === t.id);
            const late = isOverdue(log?.expected_return, today);
            const inspect = t.inspection_due && t.inspection_due <= today;
            return (
              <li key={t.id} className="flex flex-wrap items-center gap-3 p-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium"><span className="mr-2 font-mono text-sm text-muted-foreground">{t.tag}</span>{t.name}{t.model && <span className="text-muted-foreground"> · {t.model}</span>}</p>
                  <p className="text-xs text-muted-foreground">{t.category}{t.serial_number && ` · SN ${t.serial_number}`}{t.default_location && ` · ${t.default_location}`}</p>
                  {log && <p className={`text-xs ${late ? "font-medium text-destructive" : "text-muted-foreground"}`}>With {name(log.holder_id)}{log.destination && ` · ${log.destination}`}{log.expected_return && ` · due ${log.expected_return}`}{late && " · OVERDUE"}</p>}
                  {inspect && <p className="text-xs font-medium text-destructive">Inspection / calibration due {t.inspection_due}</p>}
                </div>
                <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_STYLE[t.status]}`}>{TOOL_STATUS_LABEL[t.status]}</span>
                <div className="flex gap-1">
                  {t.status === "available" && (manager || canSignOut(profile.role, mode, profile.id, profile.id)) && <Button size="sm" onClick={() => setOut(t)}><LogOut className="mr-1 h-4 w-4" />Sign out</Button>}
                  {t.status === "checked_out" && canSignIn(profile.role, mode, profile.id, t.holder_id) && <Button size="sm" variant="outline" onClick={() => setBack(t)}><LogIn className="mr-1 h-4 w-4" />Sign in</Button>}
                  <Button size="icon" variant="ghost" aria-label="History" onClick={() => setHist(t)}><History className="h-4 w-4" /></Button>
                  {manager && <Button size="sm" variant="ghost" onClick={() => setEdit(t)}>Edit</Button>}
                  {manager && <Button size="icon" variant="ghost" aria-label="Delete tool" onClick={() => remove(t)}><Trash2 className="h-4 w-4" /></Button>}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {edit && <ToolEditor tool={edit} companyId={profile.company_id} onClose={() => setEdit(null)} onSaved={refresh} />}
      {out && <SignOutDialog tool={out} profile={profile} manager={manager} team={team.data ?? []} onClose={() => setOut(null)} onDone={refresh} />}
      {back && <SignInDialog tool={back} onClose={() => setBack(null)} onDone={refresh} />}
      {hist && <HistoryDialog tool={hist} name={name} onClose={() => setHist(null)} />}
    </div>
  );
}

function ToolEditor({ tool, companyId, onClose, onSaved }: { tool: Partial<Tool>; companyId: string; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState(tool);
  const set = (k: keyof Tool, v: string) => setF({ ...f, [k]: v });
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const row = { tag: f.tag!.trim(), name: f.name!.trim(), model: f.model || null, serial_number: f.serial_number || null, category: f.category || "General", default_location: f.default_location || null, inspection_due: f.inspection_due || null, notes: f.notes || null };
    const status = f.status === "checked_out" ? undefined : f.status;
    const { error } = f.id
      ? await supabase.from("company_tools").update({ ...row, ...(status ? { status } : {}) }).eq("id", f.id)
      : await supabase.from("company_tools").insert({ ...row, company_id: companyId });
    if (error) { toast.error(error.message.includes("duplicate") ? "That tag is already used" : error.message); return; }
    toast.success("Tool saved"); onSaved(); onClose();
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{f.id ? "Edit tool" : "New tool"}</DialogTitle></DialogHeader>
        <form onSubmit={save} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5"><Label>Tag / ID</Label><Input required placeholder="TL-001" value={f.tag ?? ""} onChange={(e) => set("tag", e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Tool name</Label><Input required placeholder="Magnetic drill" value={f.name ?? ""} onChange={(e) => set("name", e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Model</Label><Input value={f.model ?? ""} onChange={(e) => set("model", e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Serial no.</Label><Input value={f.serial_number ?? ""} onChange={(e) => set("serial_number", e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Category</Label>
              <Select value={f.category ?? "General"} onValueChange={(v) => set("category", v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{TOOL_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select>
            </div>
            <div className="space-y-1.5"><Label>Store location</Label><Input placeholder="Central store · Shelf B" value={f.default_location ?? ""} onChange={(e) => set("default_location", e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Inspection / calibration due</Label><Input type="date" value={f.inspection_due ?? ""} onChange={(e) => set("inspection_due", e.target.value)} /></div>
            {f.id && f.status !== "checked_out" && <div className="space-y-1.5"><Label>Status</Label>
              <Select value={f.status ?? "available"} onValueChange={(v) => set("status", v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{(["available", "in_maintenance", "decommissioned"] as ToolStatus[]).map((s) => <SelectItem key={s} value={s}>{TOOL_STATUS_LABEL[s]}</SelectItem>)}</SelectContent></Select>
            </div>}
          </div>
          <div className="space-y-1.5"><Label>Notes</Label><Textarea rows={2} value={f.notes ?? ""} onChange={(e) => set("notes", e.target.value)} /></div>
          <Button type="submit" className="w-full">Save</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function SignOutDialog({ tool, profile, manager, team, onClose, onDone }: { tool: Tool; profile: Profile; manager: boolean; team: { id: string; full_name: string }[]; onClose: () => void; onDone: () => void }) {
  const [holder, setHolder] = useState(profile.id);
  const [dest, setDest] = useState("");
  const [due, setDue] = useState(new Date().toISOString().slice(0, 10));
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    const { error } = await supabase.rpc("tool_sign_out", { _tool: tool.id, _holder: holder, _destination: dest, _expected: due || null as never });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`${tool.tag} signed out`); onDone(); onClose();
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Sign out {tool.tag} · {tool.name}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          {manager ? <div className="space-y-1.5"><Label>Signed out to</Label>
            <Select value={holder} onValueChange={setHolder}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{team.map((u) => <SelectItem key={u.id} value={u.id}>{u.full_name}</SelectItem>)}</SelectContent></Select>
          </div> : <p className="text-sm text-muted-foreground">Signing out to yourself.</p>}
          <div className="space-y-1.5"><Label>Destination / job (optional)</Label><Input placeholder="Site or job sheet" value={dest} onChange={(e) => setDest(e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Expected return</Label><Input type="date" value={due} onChange={(e) => setDue(e.target.value)} /></div>
          <Button className="w-full" disabled={busy} onClick={submit}>Confirm sign out</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SignInDialog({ tool, onClose, onDone }: { tool: Tool; onClose: () => void; onDone: () => void }) {
  const [cond, setCond] = useState<"good" | "needs_maintenance">("good");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (cond === "needs_maintenance" && !notes.trim()) { toast.error("Describe the defect"); return; }
    setBusy(true);
    const { error } = await supabase.rpc("tool_sign_in", { _tool: tool.id, _condition: cond, _notes: notes });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(cond === "good" ? `${tool.tag} back in store` : `${tool.tag} flagged for repair`); onDone(); onClose();
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Return {tool.tag} · {tool.name}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <Button variant={cond === "good" ? "default" : "outline"} onClick={() => setCond("good")}>Good condition</Button>
            <Button variant={cond === "needs_maintenance" ? "destructive" : "outline"} onClick={() => setCond("needs_maintenance")}>Needs repair</Button>
          </div>
          <div className="space-y-1.5"><Label>{cond === "good" ? "Notes (optional)" : "Defect description"}</Label><Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
          <Button className="w-full" disabled={busy} onClick={submit}>Confirm return</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function HistoryDialog({ tool, name, onClose }: { tool: Tool; name: (id?: string | null) => string; onClose: () => void }) {
  const h = useQuery({ queryKey: ["tool-history", tool.id], queryFn: async () => ((await supabase.from("tool_custody_logs").select("*").eq("tool_id", tool.id).order("checked_out_at", { ascending: false }).limit(50)).data ?? []) as Log[] });
  const fmt = (d: string) => new Date(d).toLocaleString([], { dateStyle: "short", timeStyle: "short" });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Custody history · {tool.tag}</DialogTitle></DialogHeader>
        {!h.data?.length ? <p className="text-sm text-muted-foreground">No sign-outs yet.</p> : (
          <ul className="max-h-96 divide-y overflow-y-auto text-sm">
            {h.data.map((l) => <li key={l.id} className="py-2">
              <p className="font-medium">{name(l.holder_id)}{l.destination && <span className="font-normal text-muted-foreground"> · {l.destination}</span>}</p>
              <p className="text-xs text-muted-foreground">Out {fmt(l.checked_out_at)} by {name(l.issued_by)} · {l.returned_at ? `In ${fmt(l.returned_at)}${l.return_condition === "needs_maintenance" ? " · needs repair" : ""}` : "Still out"}</p>
              {l.return_notes && <p className="text-xs">{l.return_notes}</p>}
            </li>)}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function InventoryControlSettings({ companyId }: { companyId: string }) {
  const qc = useQueryClient();
  const modes = useInventoryModes(companyId).data;
  const save = async (k: "tool_checkout_mode" | "parts_control_mode", v: ControlMode) => {
    const { error } = await supabase.from("company_settings").update(k === "tool_checkout_mode" ? { tool_checkout_mode: v } : { parts_control_mode: v }).eq("company_id", companyId);
    if (error) { toast.error(error.message); return; }
    toast.success("Inventory control saved");
    qc.invalidateQueries({ queryKey: ["inventory-modes"] });
  };
  if (!modes) return null;
  const row = (k: "tool_checkout_mode" | "parts_control_mode", title: string, value: ControlMode, managed: string, self: string) => (
    <div className="space-y-2 rounded-xl border bg-card p-4">
      <h3 className="font-medium">{title}</h3>
      <div className="grid gap-2 sm:grid-cols-2">
        {([["managed", "Managed", managed], ["self_service", "Self-service", self]] as const).map(([v, l, d]) => (
          <button key={v} type="button" onClick={() => save(k, v)} aria-pressed={value === v} className={`rounded-lg border p-3 text-left ${value === v ? "border-primary bg-primary/5" : ""}`}>
            <p className="text-sm font-medium">{l}</p><p className="text-xs text-muted-foreground">{d}</p>
          </button>
        ))}
      </div>
    </div>
  );
  return (
    <div className="space-y-4">
      {row("tool_checkout_mode", "Tool sign-out", modes.tools, "Only office and supervisors sign tools out and in. Technicians see availability only.", "Technicians may sign tools out to themselves and return them from their phone.")}
      {row("parts_control_mode", "Parts & consumables", modes.parts, "Only office and supervisors adjust stock quantities.", "Technicians may adjust stock quantities, except parts marked “Requires approval”.")}
    </div>
  );
}
