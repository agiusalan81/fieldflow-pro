import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Copy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/lib/profile";
import { AppShell, EmptyState } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/estimates")({
  head: () => ({
    meta: [
      { title: "New lift estimates — FieldOps" },
      { name: "description", content: "Compile new lift specs, request supplier quotes and track every step." },
      { property: "og:title", content: "New lift estimates — FieldOps" },
      { property: "og:description", content: "Supplier quote requests with tracking." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Estimates,
});

const STEPS = [
  { key: "draft", label: "Draft" },
  { key: "sent", label: "Sent to supplier" },
  { key: "quoted", label: "Quote received" },
  { key: "client_ready", label: "Client estimate ready" },
  { key: "won", label: "Won" },
  { key: "lost", label: "Lost" },
];
type Ev = { at: string; status: string; by: string };

function Estimates() {
  const { data: profile } = useProfile();
  const qc = useQueryClient();
  const { data = [] } = useQuery({
    queryKey: ["estimates"],
    queryFn: async () => { const { data, error } = await supabase.from("lift_estimates").select("*, clients(name)").order("updated_at", { ascending: false }); if (error) throw error; return data; },
  });
  const { data: clients = [] } = useQuery({ queryKey: ["clients-min"], queryFn: async () => (await supabase.from("clients").select("id, name").order("name")).data ?? [] });
  const [f, setF] = useState({ title: "", client_id: "none", specs: "", supplier_name: "", supplier_email: "" });

  const create = async () => {
    if (!f.title.trim() || !profile) { toast.error("Give the estimate a title"); return; }
    const ev: Ev[] = [{ at: new Date().toISOString(), status: "draft", by: profile.full_name }];
    const { error } = await supabase.from("lift_estimates").insert({ company_id: profile.company_id, title: f.title.trim(), client_id: f.client_id === "none" ? null : f.client_id, specs: f.specs, supplier_name: f.supplier_name || null, supplier_email: f.supplier_email || null, events: ev });
    if (error) { toast.error(error.message); return; }
    setF({ title: "", client_id: "none", specs: "", supplier_name: "", supplier_email: "" });
    qc.invalidateQueries({ queryKey: ["estimates"] });
  };
  const move = async (e: (typeof data)[number], status: string, extra: Record<string, unknown> = {}) => {
    const events = [...((e.events as Ev[]) ?? []), { at: new Date().toISOString(), status, by: profile?.full_name ?? "" }];
    const { error } = await supabase.from("lift_estimates").update({ status, events, ...extra }).eq("id", e.id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["estimates"] });
  };
  const copyRequest = async (e: (typeof data)[number]) => {
    const text = `Quote request — ${e.title}\n${e.clients?.name ? `Project: ${e.clients.name}\n` : ""}\nSpecification:\n${e.specs ?? ""}\n\nPlease send your quotation with lead time.\n${profile?.companies?.name ?? ""}`;
    await navigator.clipboard.writeText(text);
    toast.success("Quote request copied — paste it into an email to the supplier");
  };

  return (
    <AppShell title="New lift estimates">
      <div className="mx-auto grid max-w-6xl gap-5 lg:grid-cols-[360px_minmax(0,1fr)]">
        <section className="space-y-3 rounded-xl border bg-card p-4">
          <h2 className="font-medium text-foreground">New estimate</h2>
          <div className="space-y-1.5"><Label>Title</Label><Input className="h-11" placeholder="e.g. 8-person MRL lift, 5 stops" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Client</Label>
            <Select value={f.client_id} onValueChange={(v) => setF({ ...f, client_id: v })}><SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="none">No client yet</SelectItem>{clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select>
          </div>
          <div className="space-y-1.5"><Label>Specification</Label><Textarea rows={6} placeholder={"Load / persons, stops, travel, shaft size, door type, finishes…"} value={f.specs} onChange={(e) => setF({ ...f, specs: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-2">
            <Input className="h-11" placeholder="Supplier" value={f.supplier_name} onChange={(e) => setF({ ...f, supplier_name: e.target.value })} />
            <Input className="h-11" type="email" placeholder="Supplier email" value={f.supplier_email} onChange={(e) => setF({ ...f, supplier_email: e.target.value })} />
          </div>
          <Button className="h-11 w-full" onClick={create}>Create estimate</Button>
        </section>
        <section className="space-y-3">
          {!data.length ? <EmptyState>No estimates yet.</EmptyState> : data.map((e) => {
            const idx = STEPS.findIndex((s) => s.key === e.status);
            const next = STEPS[idx + 1];
            return (
              <article key={e.id} className="space-y-3 rounded-xl border bg-card p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0"><p className="font-medium text-foreground">{e.title}</p><p className="text-sm text-muted-foreground">{e.clients?.name ?? "No client"} · {e.supplier_name ?? "No supplier"}{e.quoted_amount ? ` · €${Number(e.quoted_amount).toFixed(2)}` : ""}</p></div>
                  <span className="rounded-full bg-primary/15 px-2.5 py-0.5 text-xs font-medium text-primary">{STEPS[idx]?.label ?? e.status}</span>
                </div>
                {e.specs && <p className="line-clamp-3 whitespace-pre-line text-sm text-foreground">{e.specs}</p>}
                <ol className="space-y-1 border-l pl-3 text-xs text-muted-foreground">
                  {((e.events as Ev[]) ?? []).map((ev, i) => <li key={i}>{new Date(ev.at).toLocaleString()} — {STEPS.find((s) => s.key === ev.status)?.label ?? ev.status} · {ev.by}</li>)}
                </ol>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => copyRequest(e)}><Copy className="mr-1 h-4 w-4" />Copy quote request</Button>
                  {next && e.status !== "won" && e.status !== "lost" && next.key !== "lost" && (
                    next.key === "quoted"
                      ? <Button size="sm" onClick={() => { const v = window.prompt("Supplier quote amount (€)"); if (v) move(e, "quoted", { quoted_amount: Number(v) || null }); }}>Mark quote received</Button>
                      : <Button size="sm" onClick={() => move(e, next.key)}>Mark: {next.label}</Button>
                  )}
                  {e.status === "client_ready" && <Button size="sm" variant="outline" onClick={() => move(e, "lost")}>Mark lost</Button>}
                </div>
              </article>
            );
          })}
        </section>
      </div>
    </AppShell>
  );
}
