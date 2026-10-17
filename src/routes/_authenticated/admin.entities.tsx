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
            <Tabs defaultValue={manage.tab}>
              <TabsList className="mb-3">
                <TabsTrigger value="sites">Sites</TabsTrigger>
                <TabsTrigger value="contacts">Contacts</TabsTrigger>
                <TabsTrigger value="equipment">Equipment</TabsTrigger>
              </TabsList>
              <TabsContent value="sites"><SitesManager clientId={manage.id} companyId={profile.company_id} /></TabsContent>
              <TabsContent value="contacts"><ContactsManager clientId={manage.id} companyId={profile.company_id} /></TabsContent>
              <TabsContent value="equipment"><EquipmentManager clientId={manage.id} companyId={profile.company_id} /></TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

function SitesManager({ clientId, companyId }: { clientId: string; companyId: string }) {
  const qc = useQueryClient();
  const key = ["client-sites", clientId];
  const { data: sites = [] } = useQuery({ queryKey: key, queryFn: async () => (await supabase.from("sites").select("*").eq("client_id", clientId).order("name")).data ?? [] });
  const [edit, setEdit] = useState<{ id?: string; name: string; address: string } | null>(null);
  const refresh = () => { qc.invalidateQueries({ queryKey: key }); qc.invalidateQueries({ queryKey: ["sites-full"] }); qc.invalidateQueries({ queryKey: ["sheet-refs"] }); };
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!edit) return;
    const res = edit.id
      ? await supabase.from("sites").update({ name: edit.name, address: edit.address }).eq("id", edit.id)
      : await supabase.from("sites").insert({ name: edit.name, address: edit.address, client_id: clientId, company_id: companyId });
    if (res.error) { toast.error(res.error.message); return; }
    setEdit(null); refresh();
  };
  return (
    <div className="space-y-2">
      {sites.length === 0 && <p className="text-sm text-muted-foreground">No sites yet.</p>}
      {sites.map((s) => (
        <div key={s.id} className={`flex items-center gap-2 rounded-lg border p-3 ${ROW}`} onClick={() => setEdit({ id: s.id, name: s.name, address: s.address ?? "" })}>
          <div className="min-w-0 flex-1"><p className="font-medium">{s.name}</p><p className="truncate text-sm text-muted-foreground">{s.address || "—"}</p></div>
          <Button size="icon" variant="ghost" aria-label="Edit"><Pencil className="h-4 w-4" /></Button>
          <Button size="icon" variant="ghost" aria-label="Delete" onClick={(e) => { e.stopPropagation(); del("sites", s.id, refresh); }}><Trash2 className="h-4 w-4" /></Button>
        </div>
      ))}
      {edit ? (
        <form onSubmit={save} className="space-y-2 rounded-lg border p-3">
          <Input required placeholder="Site name" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
          <Input placeholder="Address" value={edit.address} onChange={(e) => setEdit({ ...edit, address: e.target.value })} />
          <div className="flex gap-2"><Button type="submit" size="sm">Save</Button><Button type="button" size="sm" variant="ghost" onClick={() => setEdit(null)}>Cancel</Button></div>
        </form>
      ) : <Button variant="outline" size="sm" className="w-full" onClick={() => setEdit({ name: "", address: "" })}><Plus className="mr-1 h-4 w-4" />Add site</Button>}
    </div>
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
  const emptyF = { name: "", property_name: "", street_name: "", location: "", first_name: "", last_name: "", email: "", code: "+356", number: "" };
  const [f, setF] = useState(emptyF);
  const refresh = () => { qc.invalidateQueries({ queryKey: ["clients-full"] }); qc.invalidateQueries({ queryKey: ["clients"] }); qc.invalidateQueries({ queryKey: ["contacts"] }); qc.invalidateQueries({ queryKey: ["sites-full"] }); qc.invalidateQueries({ queryKey: ["sheet-refs"] }); };
  const reset = (o: boolean) => { setOpen(o); if (!o) { setStep(1); setClientId(null); setF(emptyF); } };
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const company_id = profile!.company_id;
    const billing_address = [f.property_name, f.street_name, f.location].filter(Boolean).join(", ");
    const { data: c, error } = await supabase.from("clients").insert({ name: f.name, property_name: f.property_name, street_name: f.street_name, location: f.location, billing_address, company_id }).select("id").single();
    if (error || !c) { toast.error(error?.message ?? "Could not save"); return; }
    const { error: ce } = await supabase.from("client_contacts").insert({ client_id: c.id, company_id, first_name: f.first_name, last_name: f.last_name, email: f.email, phone: `${f.code} ${f.number}`, is_primary_contact: true, receives_job_sheets: true });
    if (ce) { toast.error(ce.message); return; }
    if (billing_address) {
      const { error: se } = await supabase.from("sites").insert({ client_id: c.id, company_id, name: f.property_name || "Main site", address: billing_address });
      if (se) toast.error(se.message);
    }
    refresh(); setClientId(c.id); setStep(2); toast.success("Client and site saved — now add equipment");
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
      </div>
      <UnifiedTable q={q} onOpen={onOpen} clients={list} onDelete={(id) => del("clients", id, refresh)} />
    </>
  );
}
