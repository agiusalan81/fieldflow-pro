import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { usePlanFeatures } from "@/lib/plan-features";
import { PpmCoverage } from "@/components/ppm-coverage";
import { PpmVisits } from "@/components/ppm-visits";
import { EquipmentContracts, AgreementAssetLines } from '@/components/equipment-contracts';
import { AssignedEquipmentWork } from '@/components/assigned-equipment-work';
import { ContractTiers } from "@/components/contract-tiers";
import { DocumentMasters } from "@/components/document-masters";
import { supabase } from "@/integrations/supabase/client";
import { useMemberWorkspaces } from "@/lib/member-workspaces";
import { useProfile, isOffice } from "@/lib/profile";
import { EQUIPMENT_CATEGORIES as CONTRACTOR_CATEGORIES } from "@/lib/company";
import { useEdition } from "@/lib/plan-features";
import { isInHouse, EDITION_SPEC } from "@/lib/editions";
function useEquipmentCategories() { const { edition } = useEdition(); return isInHouse(edition) ? [...EDITION_SPEC[edition].assetGroups.map((g) => g.group), "Custom"] : CONTRACTOR_CATEGORIES; }
import { daysUntil, visitsForTier, contractName } from "@/lib/jobsheets";
import { LookupInput, learnLookup, CONTRACT_CATEGORY } from "@/components/role-combobox";
import { RenewalList, useAgreements } from "@/components/renewals";
import { LibraryImport } from "@/components/library-import";
import { extractChecklistItems, extractContractDetails } from "@/lib/document-library.functions";
import { AppShell, EmptyState } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/contracts")({ staticData: { sitemap: false },
  validateSearch: (s: Record<string, unknown>): { tab?: string } => ({ tab: ["renewals", "agreements", "types", "masters", "checklists"].includes(String(s["tab"])) ? String(s["tab"]) : "agreements" }),
  head: () => ({
    meta: [
      { title: "Contracts & checklists — FieldBridge" },
      { name: "description", content: "Maintenance contract types, client agreements, renewals and inspection checklists." },
      { property: "og:title", content: "Contracts & checklists — FieldBridge" },
      { property: "og:description", content: "Maintenance contracts, renewals and checklists." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ContractsPage,
});

function ContractsPage() {
  const { tab = "agreements" } = Route.useSearch();
  const navigate = useNavigate();
  const { data: profile } = useProfile();
  const access = useMemberWorkspaces();
  const office = !!access.data?.contracts;
  if (access.isPending) return <AppShell title="Contracts & checklists"><p>Loading…</p></AppShell>;
  if (!office) return <AppShell title="Contracts & checklists"><p>Contracts & renewals capability required.</p></AppShell>;
  return (
    <AppShell title="Contracts & checklists">
      <Tabs value={tab === "masters" && !office ? "agreements" : tab} onValueChange={tab => void navigate({ to: "/contracts", search: { tab }, replace: true })} className="mx-auto max-w-6xl">
        <TabsList className="h-auto flex-wrap">
          <TabsTrigger value="agreements">Client agreements</TabsTrigger>
          <TabsTrigger value="renewals">Renewals due</TabsTrigger>
          <TabsTrigger value="types">Service tiers</TabsTrigger>
          {isOffice(profile) && <TabsTrigger value="masters">Contracts & checklist masters</TabsTrigger>}
          <TabsTrigger value="checklists">Checklists</TabsTrigger>
        </TabsList>
        <TabsContent value="renewals" className="mt-4"><Renewals office={office} /></TabsContent>
        <TabsContent value="agreements" className="mt-4"><Agreements office={office} companyId={profile?.company_id} /></TabsContent>
        <TabsContent value="types" className="mt-4">{office && profile ? <ContractTiers companyId={profile.company_id} /> : <Types office={office} companyId={profile?.company_id} />}</TabsContent>
        {office && profile && <TabsContent value="masters" className="mt-4"><DocumentMasters companyId={profile.company_id} /></TabsContent>}
        <TabsContent value="checklists" className="mt-4"><Checklists office={office} companyId={profile?.company_id} /></TabsContent>
      </Tabs>
    </AppShell>
  );
}

function Renewals({ office }: { office: boolean }) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">Confirm the price is still the same, send the renewal to the client, then renew once they sign. Automatic client emails and e-signatures will be connected in a later step.</p>
      <RenewalList office={office} />
      {office && <AgreementAssetLines renewalsOnly />}
    </div>
  );
}

function Agreements({ office, companyId }: { office: boolean; companyId?: string | undefined }) {
  const on = usePlanFeatures();
  const { data = [] } = useAgreements();
  return (
    <div className="space-y-4">
      {companyId && office && <EquipmentContracts companyId={companyId} central />}
      {companyId&&office&&<AssignedEquipmentWork companyId={companyId}/>}
      {!data.length ? <EmptyState>No client agreements yet.</EmptyState> : (
        <ul className="divide-y rounded-xl border bg-card">
          {data.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
              <div className="min-w-0 flex-1"><p className="break-words font-medium text-foreground">{a.title || a.clients?.name}</p><p className="text-muted-foreground">{a.clients?.name} · {a.sites?.name} · {a.contract_kind === 'installation' ? 'Installation project' : a.contract_types?.name ?? "Maintenance"} · {a.start_date} → {a.end_date} · €{Number(a.annual_price).toFixed(2)}</p></div>
              <span className="text-xs text-muted-foreground">{daysUntil(a.end_date) < 0 ? "Expired" : `${daysUntil(a.end_date)} days left`}</span>
              {on('ppm_automation') && <PpmCoverage agreementId={a.id} clientId={a.client_id} start={a.start_date} end={a.end_date} canManage={office} />}
              <div className="w-full"><AgreementAssetLines agreementId={a.id} /></div>
            </li>
          ))}
        </ul>
      )}
      {on('ppm_automation') && <PpmVisits canManage={office} />}
    </div>
  );
}

function Types({ office, companyId }: { office: boolean; companyId?: string | undefined }) {
  const EQUIPMENT_CATEGORIES = useEquipmentCategories();
  const qc = useQueryClient();
  const { data = [] } = useQuery({
    queryKey: ["contract-types"],
    queryFn: async () => { const { data, error } = await supabase.from("contract_types").select("*").order("equipment_category").order("name"); if (error) throw error; return data; },
  });
  const empty = { name: "", category: "Residential", other: "", equipment_category: "Elevator", tier: "", visits_per_year: "12", annual_price: "", labour_discount_pct: "0", parts_discount_pct: "0" };
  const [f, setF] = useState(empty);
  const add = async () => {
    const cat = f.category === "Other" ? f.other.trim() : f.category;
    if (!cat) { toast.error("Specify the contract category"); return; }
    const name = f.name.trim() || contractName(cat, f.tier);
    if (!name) { toast.error("Give the contract type a name, e.g. Residential Gold"); return; }
    const { error } = await supabase.from("contract_types").insert({ company_id: companyId!, name, contract_category: cat, equipment_category: f.equipment_category, tier: f.tier || null, visits_per_year: Number(f.visits_per_year) || 0, annual_price: Number(f.annual_price) || 0, labour_discount_pct: Number(f.labour_discount_pct) || 0, parts_discount_pct: Number(f.parts_discount_pct) || 0 });
    if (error) { toast.error(error.message); return; }
    if (f.category === "Other") { const { data: u } = await supabase.auth.getUser(); if (u.user) await learnLookup(CONTRACT_CATEGORY, cat, companyId!, u.user.id); }
    setF(empty);
    qc.invalidateQueries({ queryKey: ["contract-types"] });
  };
  const del = async (id: string) => { const { error } = await supabase.from("contract_types").delete().eq("id", id); if (error) toast.error(error.message); else qc.invalidateQueries({ queryKey: ["contract-types"] }); };
  return (
    <div className="space-y-4">
      {office && (
        <section className="grid gap-2 rounded-xl border bg-card p-4 md:grid-cols-9 md:items-end">
          <div className="space-y-1.5"><Label>Category</Label><Select value={f.category} onValueChange={(v) => setF({ ...f, category: v })}><SelectTrigger className="h-11"><SelectValue /></SelectTrigger><SelectContent>{["Residential", "Commercial", "Other"].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select>{f.category === "Other" && <LookupInput category={CONTRACT_CATEGORY} value={f.other} onChange={(v) => setF({ ...f, other: v })} placeholder="e.g. Industrial" />}</div>
          <div className="space-y-1.5"><Label>Name</Label><Input className="h-11" placeholder={contractName(f.category === "Other" ? f.other : f.category, f.tier) || "Residential Gold"} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Equipment</Label><Select value={f.equipment_category} onValueChange={(v) => setF({ ...f, equipment_category: v })}><SelectTrigger className="h-11"><SelectValue /></SelectTrigger><SelectContent>{EQUIPMENT_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-1.5"><Label>Tier</Label><Select value={f.tier || "none"} onValueChange={(v) => { const tier = v === "none" ? "" : v; setF({ ...f, tier, visits_per_year: String(visitsForTier(tier, Number(f.visits_per_year) || 0)) }); }}><SelectTrigger className="h-11"><SelectValue /></SelectTrigger><SelectContent>{["none", "Bronze", "Silver", "Gold", "Custom"].map((t) => <SelectItem key={t} value={t}>{t === "none" ? "—" : t}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-1.5"><Label>Visits / yr</Label><Input className="h-11" type="number" value={f.visits_per_year} onChange={(e) => setF({ ...f, visits_per_year: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>€ / year</Label><Input className="h-11" type="number" value={f.annual_price} onChange={(e) => setF({ ...f, annual_price: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Labour % off</Label><Input className="h-11" type="number" value={f.labour_discount_pct} onChange={(e) => setF({ ...f, labour_discount_pct: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Parts % off</Label><div className="flex gap-2"><Input className="h-11" type="number" value={f.parts_discount_pct} onChange={(e) => setF({ ...f, parts_discount_pct: e.target.value })} /><Button className="h-11" onClick={add}>Add</Button></div></div>
          <div className="md:col-span-9">
            <LibraryImport label="Import contract type from document library" onPick={async (id) => {
              const d = await extractContractDetails({ data: { documentId: id } });
              const known = ["Residential", "Commercial"].some((c) => c.toLowerCase() === d.contract_category.toLowerCase());
              const tier = ["Bronze", "Silver", "Gold", "Custom"].find((t) => t.toLowerCase() === d.tier.toLowerCase()) ?? "";
              setF({
                ...f,
                name: d.name || f.name,
                category: known ? d.contract_category : d.contract_category ? "Other" : f.category,
                other: known || !d.contract_category ? f.other : d.contract_category,
                tier,
                visits_per_year: d.visits_per_year ? String(d.visits_per_year) : f.visits_per_year,
                annual_price: d.annual_price ? String(d.annual_price) : f.annual_price,
                labour_discount_pct: d.labour_discount_pct ? String(d.labour_discount_pct) : f.labour_discount_pct,
                parts_discount_pct: d.parts_discount_pct ? String(d.parts_discount_pct) : f.parts_discount_pct,
              });
              toast.success("Details read from the document — review and tap Add.");
            }} />
          </div>
        </section>
      )}
      {!data.length ? <EmptyState>No contract types yet. Add e.g. Residential Bronze, Silver, Gold.</EmptyState> : (
        <ul className="divide-y rounded-xl border bg-card">
          {data.map((t) => (
            <li key={t.id} className="flex items-center gap-3 px-4 py-3 text-sm">
              <div className="min-w-0 flex-1"><p className="font-medium text-foreground">{t.name}</p><p className="text-muted-foreground">{t.contract_category ? `${t.contract_category} · ` : ""}{t.equipment_category}{t.tier ? ` · ${t.tier}` : ""} · {t.visits_per_year} visits/yr · €{Number(t.annual_price).toFixed(2)} · labour −{Number(t.labour_discount_pct)}% · parts −{Number(t.parts_discount_pct)}%</p></div>
              {office && <Button size="icon" variant="ghost" aria-label="Delete contract type" onClick={() => del(t.id)}><Trash2 className="h-4 w-4" /></Button>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Checklists({ office, companyId }: { office: boolean; companyId?: string | undefined }) {
  const EQUIPMENT_CATEGORIES = useEquipmentCategories();
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
          <div className="flex flex-wrap gap-2">
            <Button className="h-11" onClick={save}>Save checklist</Button>
            <LibraryImport label="Import checklist from document library" onPick={async (id) => {
              const d = await extractChecklistItems({ data: { documentId: id } });
              if (!d.items.length) throw new Error("No checklist items could be read from that document.");
              setF({ ...f, name: d.name || f.name, items: d.items.join("\n") });
              toast.success(`${d.items.length} items read — review and tap Save checklist.`);
            }} />
          </div>
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
