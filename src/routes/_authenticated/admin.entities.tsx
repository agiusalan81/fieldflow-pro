import { ClientRates } from "@/components/integrations-settings";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { EquipmentManager, PhoneInput, WhatsAppBadge } from "@/components/client-manager";
import { SiteHierarchy } from "@/components/site-hierarchy";
import { supabase } from "@/integrations/supabase/client";
import { useProfile, isOffice } from "@/lib/profile";
import { AppShell, EmptyState } from "@/components/app-shell";
import { CustomFieldsForm, useFieldDefs, renderCustomValues } from "@/components/custom-fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/admin/entities")({
  head: () => ({
    meta: [
      { title: "Clients, contacts & assets — FieldOps" },
      { name: "description", content: "Manage clients, their contacts and serviced assets." },
      { property: "og:title", content: "Clients, contacts & assets — FieldOps" },
      { property: "og:description", content: "Manage clients, contacts and assets." },
    ],
  }),
  component: Entities,
});

function useClients() {
  return useQuery({ queryKey: ["clients-full"], queryFn: async () => (await supabase.from("clients").select("*").order("name")).data ?? [] });
}

function del(table: "sites" | "clients" | "client_contacts" | "assets", id: string, done: () => void) {
  if (!confirm("Delete this record?")) return;
  supabase.from(table).delete().eq("id", id).then(({ error }) => { if (error) toast.error(error.message); else done(); });
}

const ROW = "cursor-pointer hover:bg-muted/50";
type Open = { id: string; name: string };
type RecordTab = "sites" | "contacts" | "equipment";
type TabProps = { q: string; onOpen: (c: Open, tab: RecordTab) => void };

function Entities() {
  const [q, setQ] = useState("");
  const [manage, setManage] = useState<(Open & { tab: RecordTab }) | null>(null);
  const { data: profile } = useProfile();
  const onOpen = (c: Open, tab: RecordTab) => setManage({ ...c, tab });
  return (
    <AppShell title="Clients, sites & assets">
      <div className="mb-3"><Input placeholder="Search client, address, contact, lift reference or serial…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      <ClientsTab q={q} onOpen={onOpen} />
      <Dialog open={!!manage} onOpenChange={(o) => !o && setManage(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader><DialogTitle>{manage?.name}</DialogTitle></DialogHeader>
          {manage && profile && (
            <Tabs defaultValue={manage.tab === "equipment" ? "equipment" : "sites"}>
              <TabsList className="mb-3">
                <TabsTrigger value="sites">Sites & contacts</TabsTrigger>
                <TabsTrigger value="equipment">All equipment</TabsTrigger>
                {isOffice(profile) && <TabsTrigger value="rates">Labour rates</TabsTrigger>}
              </TabsList>
              <TabsContent value="sites"><SiteHierarchy clientId={manage.id} companyId={profile.company_id} /></TabsContent>
              <TabsContent value="equipment"><EquipmentManager clientId={manage.id} companyId={profile.company_id} /></TabsContent>
              {isOffice(profile) && <TabsContent value="rates"><ClientRates clientId={manage.id} /></TabsContent>}
            </Tabs>
          )}
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

const match = (q: string, ...s: (string | null | undefined)[]) => s.join(" ").toLowerCase().includes(q.toLowerCase());

function ClientsTab({ q, onOpen }: TabProps) {
  const { data: clients = [] } = useClients();
  const { data: profile } = useProfile();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [clientId, setClientId] = useState<string | null>(null);
  const emptyF = { name: "", property_name: "", street_name: "", location: "", first_name: "", last_name: "", email: "", code: "+356", number: "", whatsapp: false };
  const [f, setF] = useState(emptyF);
  const refresh = () => { qc.invalidateQueries({ queryKey: ["clients-full"] }); qc.invalidateQueries({ queryKey: ["clients"] }); qc.invalidateQueries({ queryKey: ["contacts"] }); qc.invalidateQueries({ queryKey: ["sites-full"] }); qc.invalidateQueries({ queryKey: ["sheet-refs"] }); qc.invalidateQueries({ queryKey: ["entities-unified"] }); };
  const reset = (o: boolean) => { setOpen(o); if (!o) { setStep(1); setClientId(null); setF(emptyF); } };
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const company_id = profile!.company_id;
    const billing_address = [f.property_name, f.street_name, f.location].filter(Boolean).join(", ");
    const { data: c, error } = await supabase.from("clients").insert({ name: f.name, property_name: f.property_name, street_name: f.street_name, location: f.location, billing_address, company_id }).select("id").single();
    if (error || !c) { toast.error(error?.message ?? "Could not save"); return; }
    const { error: ce } = await supabase.from("client_contacts").insert({ client_id: c.id, company_id, first_name: f.first_name, last_name: f.last_name, email: f.email, phone: `${f.code} ${f.number}`, is_primary_contact: true, receives_job_sheets: true, has_whatsapp: f.whatsapp });
    if (ce) { toast.error(ce.message); return; }
    if (billing_address) {
      const { error: se } = await supabase.from("sites").insert({ client_id: c.id, company_id, name: f.property_name || "Main site", address: billing_address });
      if (se) toast.error(se.message);
    }
    refresh(); setClientId(c.id); setStep(2); toast.success("Client saved — now add sites, contacts and equipment");
  };
  const list = clients;
  return (
    <>
      <div className="mb-3 flex justify-end">
        <Dialog open={open} onOpenChange={reset}>
          <DialogTrigger asChild><Button size="sm"><Plus className="mr-1 h-4 w-4" />Add client</Button></DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{step === 1 ? "New client" : `Sites, contacts & equipment for ${f.name}`}</DialogTitle></DialogHeader>
            {step === 1 ? (
              <form onSubmit={save} className="space-y-3">
                <div className="space-y-1.5"><Label>Client name *</Label><Input required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>Property name / number</Label><Input value={f.property_name} onChange={(e) => setF({ ...f, property_name: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>Street name</Label><Input value={f.street_name} onChange={(e) => setF({ ...f, street_name: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>Location</Label><Input value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })} /></div>
                <h3 className="pt-2 font-medium">Primary contact</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input required placeholder="Name *" value={f.first_name} onChange={(e) => setF({ ...f, first_name: e.target.value })} />
                  <Input required placeholder="Surname *" value={f.last_name} onChange={(e) => setF({ ...f, last_name: e.target.value })} />
                </div>
                <Input required type="email" placeholder="Contact email *" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
                <PhoneInput required code={f.code} number={f.number} onChange={(code, number) => setF({ ...f, code, number })} />
                <label className="flex items-center gap-2 text-sm"><Checkbox checked={f.whatsapp} onCheckedChange={(c) => setF({ ...f, whatsapp: !!c })} />This number is on WhatsApp</label>
                <Button type="submit" className="w-full">Save & continue</Button>
              </form>
            ) : clientId && profile ? (
              <div className="space-y-4">
                <SiteHierarchy clientId={clientId} companyId={profile.company_id} />
                <Button className="w-full" onClick={() => reset(false)}>Finish</Button>
              </div>
            ) : null}
          </DialogContent>
        </Dialog>
      </div>
      <UnifiedTable q={q} onOpen={onOpen} clients={list} onDelete={(id) => del("clients", id, refresh)} />
    </>
  );
}

type Row = { key: string; clientId: string; client: string; contact: string; whatsapp: boolean; site: string; address: string; asset: string; category: string; serial: string };

function UnifiedTable({ q, onOpen, clients, onDelete }: { q: string; onOpen: (c: Open, tab: RecordTab) => void; clients: { id: string; name: string; billing_address: string | null }[]; onDelete: (id: string) => void }) {
  const [client, setClient] = useState("all");
  const [cat, setCat] = useState("all");
  const { data } = useQuery({
    queryKey: ["entities-unified"],
    queryFn: async () => {
      const [s, c, a] = await Promise.all([
        supabase.from("sites").select("id, client_id, name, address"),
        supabase.from("client_contacts").select("client_id, first_name, last_name, phone, is_primary_contact, has_whatsapp"),
        supabase.from("assets").select("id, client_id, site_id, reference_number, asset_category, serial_number"),
      ]);
      return { sites: s.data ?? [], contacts: c.data ?? [], assets: a.data ?? [] };
    },
  });
  const rows: Row[] = clients.flatMap((c) => {
    const contacts = (data?.contacts ?? []).filter((x) => x.client_id === c.id);
    const pc = contacts.find((x) => x.is_primary_contact) ?? contacts[0];
    const contact = pc ? `${pc.first_name} ${pc.last_name ?? ""} · ${pc.phone ?? ""}`.trim() : "—";
    const sites = (data?.sites ?? []).filter((x) => x.client_id === c.id);
    const assets = (data?.assets ?? []).filter((x) => x.client_id === c.id);
    const base = { clientId: c.id, client: c.name, contact, whatsapp: !!pc?.has_whatsapp };
    if (!assets.length) return [{ ...base, key: c.id, site: sites[0]?.name ?? "—", address: sites[0]?.address ?? c.billing_address ?? "", asset: "", category: "", serial: "" }];
    return assets.map((a) => {
      const st = sites.find((x) => x.id === a.site_id) ?? sites[0];
      return { ...base, key: a.id, site: st?.name ?? "—", address: st?.address ?? c.billing_address ?? "", asset: a.reference_number, category: a.asset_category, serial: a.serial_number ?? "" };
    });
  });
  const categories = Array.from(new Set((data?.assets ?? []).map((a) => a.asset_category))).sort();
  const list = rows.filter((r) => (client === "all" || r.clientId === client) && (cat === "all" || r.category === cat) && match(q, r.client, r.contact, r.site, r.address, r.asset, r.category, r.serial));
  return (
    <>
      <div className="mb-3 grid gap-2 sm:grid-cols-2">
        <Select value={client} onValueChange={setClient}><SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">All clients</SelectItem>{clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select>
        <Select value={cat} onValueChange={setCat}><SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">All equipment types</SelectItem>{categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select>
      </div>
      {list.length === 0 ? <EmptyState>Nothing matches these filters.</EmptyState> : (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <Table>
            <TableHeader><TableRow><TableHead>Client</TableHead><TableHead>Primary contact</TableHead><TableHead>Site / address</TableHead><TableHead>Equipment</TableHead><TableHead /></TableRow></TableHeader>
            <TableBody>
              {list.map((r) => (
                <TableRow key={r.key} className={ROW} onClick={() => onOpen({ id: r.clientId, name: r.client }, r.asset ? "equipment" : "sites")}>
                  <TableCell className="font-medium">{r.client}</TableCell>
                  <TableCell className="text-sm">{r.contact}{r.whatsapp && <WhatsAppBadge />}</TableCell>
                  <TableCell className="text-sm"><span className="text-foreground">{r.site}</span><span className="block text-xs text-muted-foreground">{r.address || "—"}</span></TableCell>
                  <TableCell className="text-sm">{r.asset ? <><span className="font-mono">{r.asset}</span> <span className="rounded-full bg-secondary px-2 py-0.5 text-xs">{r.category}</span>{r.serial && <span className="block text-xs text-muted-foreground">S/N {r.serial}</span>}</> : <span className="text-muted-foreground">No equipment</span>}</TableCell>
                  <TableCell className="text-right"><Button size="icon" variant="ghost" aria-label="Delete client" onClick={(e) => { e.stopPropagation(); onDelete(r.clientId); }}><Trash2 className="h-4 w-4" /></Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
}
