import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useProfile, isOffice } from "@/lib/profile";
import { useCompanyRules, EQUIPMENT_CATEGORIES } from "@/lib/company";
import { daysUntil, dueForRenewal } from "@/lib/jobsheets";
import { AppShell, EmptyState } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/contracts")({
  head: () => ({
    meta: [
      { title: "Contracts & checklists — FieldOps" },
      { name: "description", content: "Maintenance contract types, client agreements, renewals and inspection checklists." },
      { property: "og:title", content: "Contracts & checklists — FieldOps" },
      { property: "og:description", content: "Maintenance contracts, renewals and checklists." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ContractsPage,
});

export function useAgreements() {
  return useQuery({
    queryKey: ["agreements"],
    queryFn: async () => {
      const { data, error } = await supabase.from("maintenance_agreements").select("*, clients(name), sites(name), contract_types(name, tier, equipment_category)").order("end_date");
      if (error) throw error;
      return data;
    },
  });
}

function ContractsPage() {
  const { data: profile } = useProfile();
  const office = isOffice(profile);
  return (
    <AppShell title="Contracts & checklists">
      <Tabs defaultValue="renewals" className="mx-auto max-w-6xl">
        <TabsList className="flex-wrap">
          <TabsTrigger value="renewals">Renewals due</TabsTrigger>
          <TabsTrigger value="agreements">Client agreements</TabsTrigger>
          <TabsTrigger value="types">Contract types</TabsTrigger>
          <TabsTrigger value="checklists">Checklists</TabsTrigger>
        </TabsList>
        <TabsContent value="renewals" className="mt-4"><Renewals office={office} /></TabsContent>
        <TabsContent value="agreements" className="mt-4"><Agreements office={office} companyId={profile?.company_id} /></TabsContent>
        <TabsContent value="types" className="mt-4"><Types office={office} companyId={profile?.company_id} /></TabsContent>
        <TabsContent value="checklists" className="mt-4"><Checklists office={office} companyId={profile?.company_id} /></TabsContent>
      </Tabs>
    </AppShell>
  );
}

export function RenewalList({ office, limit }: { office: boolean; limit?: number }) {
  const { data = [] } = useAgreements();
  const { data: c } = useCompanyRules();
  const qc = useQueryClient();
  const due = data.filter((a) => a.status === "active" && (dueForRenewal(a.end_date, c?.renewalDays ?? 30) || daysUntil(a.end_date) < 0));
  const act = async (id: string, patch: Record<string, unknown>, msg: string) => {
    const { error } = await supabase.from("maintenance_agreements").update(patch).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success(msg);
    qc.invalidateQueries({ queryKey: ["agreements"] });
  };
  const renew = (a: (typeof data)[number]) => {
    const s = new Date(a.end_date + "T00:00:00Z"); s.setUTCDate(s.getUTCDate() + 1);
    const e = new Date(s); e.setUTCFullYear(e.getUTCFullYear() + 1); e.setUTCDate(e.getUTCDate() - 1);
    act(a.id, { start_date: s.toISOString().slice(0, 10), end_date: e.toISOString().slice(0, 10), price_confirmed_at: null, renewal_sent_at: null }, "Agreement renewed for another year");
  };
  if (!due.length) return <EmptyState>No contracts expiring in the next {c?.renewalDays ?? 30} days.</EmptyState>;
  return (
    <ul className="space-y-2">
      {due.slice(0, limit).map((a) => {
        const d = daysUntil(a.end_date);
        return (
          <li key={a.id} className="grid gap-3 rounded-xl border bg-card p-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
            <div className="min-w-0">
              <p className="truncate font-medium text-foreground">{a.clients?.name}{a.sites?.name ? ` · ${a.sites.name}` : ""}</p>
              <p className="text-sm text-muted-foreground">{a.contract_types?.name ?? "Custom"} · €{Number(a.annual_price).toFixed(2)}/yr · ends {a.end_date} · <span className={d < 0 ? "text-destructive" : "text-foreground"}>{d < 0 ? `expired ${-d} days ago` : `${d} days left`}</span></p>
              <p className="text-xs text-muted-foreground">{a.price_confirmed_at ? `Price confirmed ${new Date(a.price_confirmed_at).toLocaleDateString()}` : "Price not confirmed yet"}{a.renewal_sent_at ? ` · Renewal sent ${new Date(a.renewal_sent_at).toLocaleDateString()}` : ""}</p>
            </div>
            {office && (
              <div className="flex flex-wrap gap-2">
                {!a.price_confirmed_at && <Button size="sm" onClick={() => act(a.id, { price_confirmed_at: new Date().toISOString() }, "Price confirmed")}>Confirm price</Button>}
                {a.price_confirmed_at && !a.renewal_sent_at && <Button size="sm" onClick={() => act(a.id, { renewal_sent_at: new Date().toISOString() }, "Marked as sent to client")}>Mark renewal sent</Button>}
                <Button size="sm" variant="outline" onClick={() => renew(a)}>Client signed — renew</Button>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function Renewals({ office }: { office: boolean }) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">Confirm the price is still the same, send the renewal to the client, then renew once they sign. Automatic client emails and e-signatures will be connected in a later step.</p>
      <RenewalList office={office} />
    </div>
  );
}

function Agreements({ office, companyId }: { office: boolean; companyId?: string }) {
  const qc = useQueryClient();
  const { data = [] } = useAgreements();
  const { data: opts } = useQuery({
    queryKey: ["agreement-opts"],
    queryFn: async () => {
      const [c, t] = await Promise.all([supabase.from("clients").select("id, name").order("name"), supabase.from("contract_types").select("id, name, annual_price").order("name")]);
      return { clients: c.data ?? [], types: t.data ?? [] };
    },
  });
  const today = new Date().toISOString().slice(0, 10);
  const [f, setF] = useState({ client_id: "", contract_type_id: "", start_date: today, end_date: "", annual_price: "" });
  const add = async () => {
    if (!f.client_id || !f.end_date) { toast.error("Choose a client and an end date"); return; }
    if (f.end_date <= f.start_date) { toast.error("End date must be after the start date"); return; }
    const { error } = await supabase.from("maintenance_agreements").insert({ company_id: companyId!, client_id: f.client_id, contract_type_id: f.contract_type_id || null, start_date: f.start_date, end_date: f.end_date, annual_price: Number(f.annual_price) || 0 });
    if (error) { toast.error(error.message); return; }
    toast.success("Agreement added");
    setF({ ...f, client_id: "", end_date: "", annual_price: "" });
    qc.invalidateQueries({ queryKey: ["agreements"] });
  };
  return (
    <div className="space-y-4">
      {office && (
        <section className="grid gap-2 rounded-xl border bg-card p-4 md:grid-cols-6 md:items-end">
          <div className="space-y-1.5 md:col-span-2"><Label>Client</Label>
            <Select value={f.client_id} onValueChange={(v) => setF({ ...f, client_id: v })}><SelectTrigger className="h-11"><SelectValue placeholder="Choose client" /></SelectTrigger>
              <SelectContent>{opts?.clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select>
          </div>
          <div className="space-y-1.5"><Label>Contract type</Label>
            <Select value={f.contract_type_id} onValueChange={(v) => setF({ ...f, contract_type_id: v, annual_price: f.annual_price || String(opts?.types.find((t) => t.id === v)?.annual_price ?? "") })}><SelectTrigger className="h-11"><SelectValue placeholder="Type" /></SelectTrigger>
              <SelectContent>{opts?.types.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent></Select>
          </div>
          <div className="space-y-1.5"><Label>Start</Label><Input className="h-11" type="date" value={f.start_date} onChange={(e) => setF({ ...f, start_date: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>End</Label><Input className="h-11" type="date" value={f.end_date} onChange={(e) => setF({ ...f, end_date: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>€ / year</Label><div className="flex gap-2"><Input className="h-11" type="number" value={f.annual_price} onChange={(e) => setF({ ...f, annual_price: e.target.value })} /><Button className="h-11" onClick={add}>Add</Button></div></div>
        </section>
      )}
      {!data.length ? <EmptyState>No client agreements yet.</EmptyState> : (
        <ul className="divide-y rounded-xl border bg-card">
          {data.map((a) => (
            <li key={a.id} className="flex items-center gap-3 px-4 py-3 text-sm">
              <div className="min-w-0 flex-1"><p className="truncate font-medium text-foreground">{a.clients?.name}</p><p className="text-muted-foreground">{a.contract_types?.name ?? "Custom"} · {a.start_date} → {a.end_date} · €{Number(a.annual_price).toFixed(2)}</p></div>
              <span className="text-xs text-muted-foreground">{daysUntil(a.end_date) < 0 ? "Expired" : `${daysUntil(a.end_date)} days left`}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Types({ office, companyId }: { office: boolean; companyId?: string }) {
  const qc = useQueryClient();
  const { data = [] } = useQuery({
    queryKey: ["contract-types"],
    queryFn: async () => { const { data, error } = await supabase.from("contract_types").select("*").order("equipment_category").order("name"); if (error) throw error; return data; },
  });
  const empty = { name: "", equipment_category: "Elevator", tier: "", visits_per_year: "12", annual_price: "", labour_discount_pct: "0", parts_discount_pct: "0" };
  const [f, setF] = useState(empty);
  const add = async () => {
    if (!f.name.trim()) { toast.error("Give the contract type a name, e.g. Residential Gold"); return; }
    const { error } = await supabase.from("contract_types").insert({ company_id: companyId!, name: f.name.trim(), equipment_category: f.equipment_category, tier: f.tier || null, visits_per_year: Number(f.visits_per_year) || 0, annual_price: Number(f.annual_price) || 0, labour_discount_pct: Number(f.labour_discount_pct) || 0, parts_discount_pct: Number(f.parts_discount_pct) || 0 });
    if (error) { toast.error(error.message); return; }
    setF(empty);
    qc.invalidateQueries({ queryKey: ["contract-types"] });
  };
  const del = async (id: string) => { const { error } = await supabase.from("contract_types").delete().eq("id", id); if (error) toast.error(error.message); else qc.invalidateQueries({ queryKey: ["contract-types"] }); };
  return (
    <div className="space-y-4">
      {office && (
        <section className="grid gap-2 rounded-xl border bg-card p-4 md:grid-cols-8 md:items-end">
          <div className="space-y-1.5 md:col-span-2"><Label>Name</Label><Input className="h-11" placeholder="Residential Gold" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Equipment</Label><Select value={f.equipment_category} onValueChange={(v) => setF({ ...f, equipment_category: v })}><SelectTrigger className="h-11"><SelectValue /></SelectTrigger><SelectContent>{EQUIPMENT_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-1.5"><Label>Tier</Label><Select value={f.tier || "none"} onValueChange={(v) => setF({ ...f, tier: v === "none" ? "" : v })}><SelectTrigger className="h-11"><SelectValue /></SelectTrigger><SelectContent>{["none", "Bronze", "Silver", "Gold", "Custom"].map((t) => <SelectItem key={t} value={t}>{t === "none" ? "—" : t}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-1.5"><Label>Visits / yr</Label><Input className="h-11" type="number" value={f.visits_per_year} onChange={(e) => setF({ ...f, visits_per_year: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>€ / year</Label><Input className="h-11" type="number" value={f.annual_price} onChange={(e) => setF({ ...f, annual_price: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Labour % off</Label><Input className="h-11" type="number" value={f.labour_discount_pct} onChange={(e) => setF({ ...f, labour_discount_pct: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Parts % off</Label><div className="flex gap-2"><Input className="h-11" type="number" value={f.parts_discount_pct} onChange={(e) => setF({ ...f, parts_discount_pct: e.target.value })} /><Button className="h-11" onClick={add}>Add</Button></div></div>
        </section>
      )}
      {!data.length ? <EmptyState>No contract types yet. Add e.g. Residential Bronze, Silver, Gold.</EmptyState> : (
        <ul className="divide-y rounded-xl border bg-card">
          {data.map((t) => (
            <li key={t.id} className="flex items-center gap-3 px-4 py-3 text-sm">
              <div className="min-w-0 flex-1"><p className="font-medium text-foreground">{t.name}</p><p className="text-muted-foreground">{t.equipment_category}{t.tier ? ` · ${t.tier}` : ""} · {t.visits_per_year} visits/yr · €{Number(t.annual_price).toFixed(2)} · labour −{Number(t.labour_discount_pct)}% · parts −{Number(t.parts_discount_pct)}%</p></div>
              {office && <Button size="icon" variant="ghost" aria-label="Delete contract type" onClick={() => del(t.id)}><Trash2 className="h-4 w-4" /></Button>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Checklists({ office, companyId }: { office: boolean; companyId?: string }) {
  const qc = useQueryClient();
  const { data = [] } = useQuery({
    queryKey: ["checklists"],
    queryFn: async () => { const { data, error } = await supabase.from("checklist_templates").select("*").order("equipment_category"); if (error) throw error; return data; },
  });
  const [f, setF] = useState({ equipment_category: "Elevator", name: "", items: "" });
  const save = async () => {
    const items = f.items.split("\n").map((s) => s.trim()).filter(Boolean);
    if (!items.length) { toast.error("Add at least one checklist item"); return; }
    const existing = data.find((c) => c.equipment_category === f.equipment_category);
    const row = { company_id: companyId!, equipment_category: f.equipment_category, name: f.name || `${f.equipment_category} maintenance`, items };
    const { error } = existing ? await supabase.from("checklist_templates").update(row).eq("id", existing.id) : await supabase.from("checklist_templates").insert(row);
    if (error) { toast.error(error.message); return; }
    toast.success("Checklist saved");
    qc.invalidateQueries({ queryKey: ["checklists"] });
  };
  const load = (cat: string) => {
    const c = data.find((x) => x.equipment_category === cat);
    setF({ equipment_category: cat, name: c?.name ?? "", items: ((c?.items as string[]) ?? []).join("\n") });
  };
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
      {office ? (
        <section className="space-y-3 rounded-xl border bg-card p-4">
          <p className="text-sm text-muted-foreground">One checklist per equipment type. Technicians must tick every item before submitting a maintenance job sheet for that equipment.</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <Select value={f.equipment_category} onValueChange={load}><SelectTrigger className="h-11"><SelectValue /></SelectTrigger><SelectContent>{EQUIPMENT_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select>
            <Input className="h-11" placeholder="Checklist name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
          </div>
          <Textarea rows={10} placeholder={"One item per line, e.g.\nCheck door operation\nTest emergency alarm\nInspect brakes"} value={f.items} onChange={(e) => setF({ ...f, items: e.target.value })} />
          <Button className="h-11" onClick={save}>Save checklist</Button>
        </section>
      ) : <div />}
      <aside className="space-y-3">
        {!data.length ? <EmptyState>No checklists yet.</EmptyState> : data.map((c) => (
          <button key={c.id} type="button" onClick={() => load(c.equipment_category)} className="w-full rounded-xl border bg-card p-4 text-left">
            <p className="font-medium text-foreground">{c.equipment_category}</p>
            <p className="text-sm text-muted-foreground">{c.name} · {(c.items as string[]).length} items</p>
          </button>
        ))}
      </aside>
    </div>
  );
}
