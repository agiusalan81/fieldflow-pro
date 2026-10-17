import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2, Pencil } from "lucide-react";
import { ContactsManager, EquipmentManager, PhoneInput } from "@/components/client-manager";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/lib/profile";
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

function Entities() {
  const [q, setQ] = useState("");
  return (
    <AppShell title="Clients & assets">
      <Tabs defaultValue="clients">
        <div className="mb-4 grid gap-2 sm:grid-cols-[auto_minmax(0,1fr)]">
          <TabsList>
            <TabsTrigger value="clients">Clients</TabsTrigger>
            <TabsTrigger value="sites">Sites</TabsTrigger>
            <TabsTrigger value="contacts">Contacts</TabsTrigger>
            <TabsTrigger value="assets">Assets</TabsTrigger>
          </TabsList>
          <Input placeholder="Filter…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <TabsContent value="clients"><ClientsTab q={q} /></TabsContent>
        <TabsContent value="sites"><SitesTab q={q} /></TabsContent>
        <TabsContent value="contacts"><ContactsTab q={q} /></TabsContent>
        <TabsContent value="assets"><AssetsTab q={q} /></TabsContent>
      </Tabs>
    </AppShell>
  );
}

const match = (q: string, ...s: (string | null | undefined)[]) => s.join(" ").toLowerCase().includes(q.toLowerCase());

function ClientsTab({ q }: { q: string }) {
  const { data: clients = [] } = useClients();
  const { data: profile } = useProfile();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [clientId, setClientId] = useState<string | null>(null);
  const [manage, setManage] = useState<{ id: string; name: string } | null>(null);
  const emptyF = { name: "", property_name: "", street_name: "", location: "", first_name: "", last_name: "", email: "", code: "+356", number: "" };
  const [f, setF] = useState(emptyF);
  const refresh = () => { qc.invalidateQueries({ queryKey: ["clients-full"] }); qc.invalidateQueries({ queryKey: ["clients"] }); qc.invalidateQueries({ queryKey: ["contacts"] }); };
  const reset = (o: boolean) => { setOpen(o); if (!o) { setStep(1); setClientId(null); setF(emptyF); } };
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const company_id = profile!.company_id;
    const billing_address = [f.property_name, f.street_name, f.location].filter(Boolean).join(", ");
    const { data: c, error } = await supabase.from("clients").insert({ name: f.name, property_name: f.property_name, street_name: f.street_name, location: f.location, billing_address, company_id }).select("id").single();
    if (error || !c) { toast.error(error?.message ?? "Could not save"); return; }
    const { error: ce } = await supabase.from("client_contacts").insert({ client_id: c.id, company_id, first_name: f.first_name, last_name: f.last_name, email: f.email, phone: `${f.code} ${f.number}`, is_primary_contact: true, receives_job_sheets: true });
    if (ce) { toast.error(ce.message); return; }
    refresh(); setClientId(c.id); setStep(2); toast.success("Client saved — now add equipment");
  };
  const list = clients.filter((c) => match(q, c.name, c.billing_address));
  return (
    <>
      <div className="mb-3 flex justify-end">
        <Dialog open={open} onOpenChange={reset}>
          <DialogTrigger asChild><Button size="sm"><Plus className="mr-1 h-4 w-4" />Add client</Button></DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{step === 1 ? "New client" : `Equipment for ${f.name}`}</DialogTitle></DialogHeader>
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
                <Button type="submit" className="w-full">Save & continue</Button>
              </form>
            ) : clientId && profile ? (
              <div className="space-y-4">
                <EquipmentManager clientId={clientId} companyId={profile.company_id} />
                <Button className="w-full" onClick={() => reset(false)}>Finish</Button>
              </div>
            ) : null}
          </DialogContent>
        </Dialog>
        <Dialog open={!!manage} onOpenChange={(o) => !o && setManage(null)}>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{manage?.name}</DialogTitle></DialogHeader>
            {manage && profile && (
              <div className="space-y-6">
                <ContactsManager clientId={manage.id} companyId={profile.company_id} />
                <EquipmentManager clientId={manage.id} companyId={profile.company_id} />
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
      {list.length === 0 ? <EmptyState>No clients yet.</EmptyState> : (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <Table>
            <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Address</TableHead><TableHead>Added</TableHead><TableHead /></TableRow></TableHeader>
            <TableBody>
              {list.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell className="text-muted-foreground">{c.billing_address || "—"}</TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">{new Date(c.created_at).toLocaleDateString()}</TableCell>
                  <TableCell className="whitespace-nowrap text-right">
                    <Button size="sm" variant="outline" onClick={() => setManage({ id: c.id, name: c.name })}><Pencil className="mr-1 h-4 w-4" />Contacts & equipment</Button>
                    <Button size="icon" variant="ghost" aria-label="Delete" onClick={() => del("clients", c.id, refresh)}><Trash2 className="h-4 w-4" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
}

function ContactsTab({ q }: { q: string }) {
  const { data: clients = [] } = useClients();
  const { data: profile } = useProfile();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const empty = { client_id: "", first_name: "", last_name: "", role_title: "", email: "", phone: "", is_primary_contact: false };
  const [f, setF] = useState(empty);
  const { data: contacts = [] } = useQuery({ queryKey: ["contacts"], queryFn: async () => (await supabase.from("client_contacts").select("*, clients(name)").order("first_name")).data ?? [] });
  const refresh = () => qc.invalidateQueries({ queryKey: ["contacts"] });
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!f.client_id) { toast.error("Pick a client"); return; }
    const { error } = await supabase.from("client_contacts").insert({ ...f, company_id: profile!.company_id });
    if (error) { toast.error(error.message); return; }
    setOpen(false); setF(empty); refresh();
  };
  const list = contacts.filter((c) => match(q, c.first_name, c.last_name, c.email, c.clients?.name));
  return (
    <>
      <div className="mb-3 flex justify-end">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm"><Plus className="mr-1 h-4 w-4" />Add contact</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New contact</DialogTitle></DialogHeader>
            <form onSubmit={save} className="space-y-3">
              <Select value={f.client_id} onValueChange={(v) => setF({ ...f, client_id: v })}>
                <SelectTrigger><SelectValue placeholder="Client" /></SelectTrigger>
                <SelectContent>{clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
              <div className="grid gap-3 sm:grid-cols-2">
                <Input required placeholder="First name" value={f.first_name} onChange={(e) => setF({ ...f, first_name: e.target.value })} />
                <Input placeholder="Last name" value={f.last_name} onChange={(e) => setF({ ...f, last_name: e.target.value })} />
                <Input placeholder="Role / title" value={f.role_title} onChange={(e) => setF({ ...f, role_title: e.target.value })} />
                <Input placeholder="Phone" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
              </div>
              <Input type="email" placeholder="Email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
              <label className="flex items-center gap-2 text-sm"><Checkbox checked={f.is_primary_contact} onCheckedChange={(c) => setF({ ...f, is_primary_contact: !!c })} />Primary contact</label>
              <Button type="submit" className="w-full">Save</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      {list.length === 0 ? <EmptyState>No contacts yet.</EmptyState> : (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <Table>
            <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Client</TableHead><TableHead>Role</TableHead><TableHead>Email</TableHead><TableHead>Phone</TableHead><TableHead /></TableRow></TableHeader>
            <TableBody>
              {list.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="whitespace-nowrap font-medium">{c.first_name} {c.last_name}{c.is_primary_contact && <span className="ml-2 rounded bg-primary/15 px-1.5 text-xs text-primary">Primary</span>}</TableCell>
                  <TableCell>{c.clients?.name}</TableCell>
                  <TableCell className="text-muted-foreground">{c.role_title ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{c.email ?? "—"}</TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">{c.phone ?? "—"}</TableCell>
                  <TableCell className="text-right"><Button size="icon" variant="ghost" aria-label="Delete" onClick={() => del("client_contacts", c.id, refresh)}><Trash2 className="h-4 w-4" /></Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
}

function AssetsTab({ q }: { q: string }) {
  const { data: clients = [] } = useClients();
  const { data: profile } = useProfile();
  const { data: defs = [] } = useFieldDefs("asset");
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [cat, setCat] = useState("all");
  const empty = { client_id: "", reference_number: "", asset_category: "", location_details: "" };
  const [f, setF] = useState(empty);
  const [attrs, setAttrs] = useState<Record<string, unknown>>({});
  const { data: assets = [] } = useQuery({ queryKey: ["assets"], queryFn: async () => (await supabase.from("assets").select("*, clients(name)").order("reference_number")).data ?? [] });
  const refresh = () => { qc.invalidateQueries({ queryKey: ["assets"] }); qc.invalidateQueries({ queryKey: ["assets-all"] }); };
  const categories = Array.from(new Set(assets.map((a) => a.asset_category))).sort();
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!f.client_id) { toast.error("Pick a client"); return; }
    const { error } = await supabase.from("assets").insert({ ...f, custom_attributes: attrs as never, company_id: profile!.company_id });
    if (error) { toast.error(error.message); return; }
    setOpen(false); setF(empty); setAttrs({}); refresh();
  };
  const list = assets.filter((a) => (cat === "all" || a.asset_category === cat) && match(q, a.reference_number, a.asset_category, a.location_details, a.clients?.name));
  return (
    <>
      <div className="mb-3 grid grid-cols-[minmax(0,1fr)_auto] gap-2 sm:flex sm:justify-between">
        <Select value={cat} onValueChange={setCat}>
          <SelectTrigger className="sm:w-56"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm"><Plus className="mr-1 h-4 w-4" />Add asset</Button></DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>New asset</DialogTitle></DialogHeader>
            <form onSubmit={save} className="space-y-3">
              <Select value={f.client_id} onValueChange={(v) => setF({ ...f, client_id: v })}>
                <SelectTrigger><SelectValue placeholder="Client" /></SelectTrigger>
                <SelectContent>{clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
              <div className="grid gap-3 sm:grid-cols-2">
                <Input required placeholder="Reference number" value={f.reference_number} onChange={(e) => setF({ ...f, reference_number: e.target.value })} />
                <Input required list="asset-cats" placeholder="Category" value={f.asset_category} onChange={(e) => setF({ ...f, asset_category: e.target.value })} />
                <datalist id="asset-cats">{categories.map((c) => <option key={c} value={c} />)}</datalist>
              </div>
              <Input placeholder="Location details" value={f.location_details} onChange={(e) => setF({ ...f, location_details: e.target.value })} />
              {defs.length > 0 && <CustomFieldsForm defs={defs} values={attrs} onChange={setAttrs} />}
              <Button type="submit" className="w-full">Save</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      {list.length === 0 ? <EmptyState>No assets found.</EmptyState> : (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <Table>
            <TableHeader><TableRow><TableHead>Reference</TableHead><TableHead>Category</TableHead><TableHead>Client</TableHead><TableHead>Location</TableHead><TableHead>Attributes</TableHead><TableHead /></TableRow></TableHeader>
            <TableBody>
              {list.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="font-medium">{a.reference_number}</TableCell>
                  <TableCell><span className="rounded-full bg-secondary px-2 py-0.5 text-xs">{a.asset_category}</span></TableCell>
                  <TableCell>{a.clients?.name}</TableCell>
                  <TableCell className="text-muted-foreground">{a.location_details ?? "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{renderCustomValues(defs, a.custom_attributes).join(" · ") || "—"}</TableCell>
                  <TableCell className="text-right"><Button size="icon" variant="ghost" aria-label="Delete" onClick={() => del("assets", a.id, refresh)}><Trash2 className="h-4 w-4" /></Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
}

function SitesTab({ q }: { q: string }) {
  const { data: clients = [] } = useClients();
  const { data: profile } = useProfile();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ client_id: "", name: "", address: "" });
  const { data: sites = [] } = useQuery({ queryKey: ["sites-full"], queryFn: async () => (await supabase.from("sites").select("*, clients(name)").order("name")).data ?? [] });
  const refresh = () => { qc.invalidateQueries({ queryKey: ["sites-full"] }); qc.invalidateQueries({ queryKey: ["sites"] }); };
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!f.client_id) { toast.error("Pick a client"); return; }
    const { error } = await supabase.from("sites").insert({ ...f, company_id: profile!.company_id });
    if (error) { toast.error(error.message); return; }
    setOpen(false); setF({ client_id: "", name: "", address: "" }); refresh();
  };
  const list = sites.filter((s) => match(q, s.name, s.address, s.clients?.name));
  return (
    <>
      <div className="mb-3 flex justify-end">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm"><Plus className="mr-1 h-4 w-4" />Add site</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New site</DialogTitle></DialogHeader>
            <form onSubmit={save} className="space-y-3">
              <Select value={f.client_id} onValueChange={(v) => setF({ ...f, client_id: v })}>
                <SelectTrigger><SelectValue placeholder="Client" /></SelectTrigger>
                <SelectContent>{clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
              <Input required placeholder="Site name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
              <Input placeholder="Address" value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} />
              <Button type="submit" className="w-full">Save</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      {list.length === 0 ? <EmptyState>No sites yet.</EmptyState> : (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <Table>
            <TableHeader><TableRow><TableHead>Site</TableHead><TableHead>Client</TableHead><TableHead>Address</TableHead><TableHead /></TableRow></TableHeader>
            <TableBody>
              {list.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell>{s.clients?.name}</TableCell>
                  <TableCell className="text-muted-foreground">{s.address ?? "—"}</TableCell>
                  <TableCell className="text-right"><Button size="icon" variant="ghost" aria-label="Delete" onClick={() => del("sites", s.id, refresh)}><Trash2 className="h-4 w-4" /></Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
}
