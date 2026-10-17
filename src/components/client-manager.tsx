import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Pencil, Plus, Trash2, Check, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const COUNTRY_CODES = ["+356", "+44", "+353", "+39", "+49", "+33", "+34", "+1", "+61", "+971"];
export const EQUIPMENT_TYPES = ["Passenger Lift", "Goods Lift", "Platform Lift", "Escalator", "Dumbwaiter", "HVAC", "Generator", "Other"];

export function splitPhone(p: string | null | undefined) {
  const m = (p ?? "").match(/^(\+\d{1,4})\s*(.*)$/);
  return m ? { code: m[1], number: m[2] } : { code: "+356", number: p ?? "" };
}

export function PhoneInput({ code, number, onChange, required }: { code: string; number: string; onChange: (code: string, number: string) => void; required?: boolean }) {
  return (
    <div className="flex gap-2">
      <Select value={code} onValueChange={(v) => onChange(v, number)}>
        <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
        <SelectContent>{COUNTRY_CODES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
      </Select>
      <Input required={required} type="tel" inputMode="tel" pattern="[0-9 ]{4,}" title="Digits only" placeholder="Phone number" value={number} onChange={(e) => onChange(code, e.target.value)} />
    </div>
  );
}

type ContactDraft = { first_name: string; last_name: string; email: string; code: string; number: string; role_title: string; is_primary_contact: boolean; receives_job_sheets: boolean };
const emptyContact: ContactDraft = { first_name: "", last_name: "", email: "", code: "+356", number: "", role_title: "", is_primary_contact: false, receives_job_sheets: false };

export function ContactsManager({ clientId, companyId }: { clientId: string; companyId: string }) {
  const qc = useQueryClient();
  const key = ["client-contacts", clientId];
  const { data: contacts = [] } = useQuery({ queryKey: key, queryFn: async () => (await supabase.from("client_contacts").select("*").eq("client_id", clientId).order("is_primary_contact", { ascending: false })).data ?? [] });
  const [editing, setEditing] = useState<string | null>(null);
  const [f, setF] = useState<ContactDraft>(emptyContact);
  const refresh = () => { qc.invalidateQueries({ queryKey: key }); qc.invalidateQueries({ queryKey: ["contacts"] }); };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const row = { first_name: f.first_name, last_name: f.last_name, email: f.email, phone: `${f.code} ${f.number}`.trim(), role_title: f.role_title || null, is_primary_contact: f.is_primary_contact, receives_job_sheets: f.receives_job_sheets };
    const { error } = editing === "new"
      ? await supabase.from("client_contacts").insert({ ...row, client_id: clientId, company_id: companyId })
      : await supabase.from("client_contacts").update(row).eq("id", editing!);
    if (error) { toast.error(error.message); return; }
    setEditing(null); refresh();
  };
  const toggleRecipient = async (id: string, v: boolean) => {
    const { error } = await supabase.from("client_contacts").update({ receives_job_sheets: v }).eq("id", id);
    if (error) toast.error(error.message); else refresh();
  };
  const remove = async (id: string) => {
    if (!confirm("Delete this contact?")) return;
    const { error } = await supabase.from("client_contacts").delete().eq("id", id);
    if (error) toast.error(error.message); else refresh();
  };

  const form = (
    <form onSubmit={save} className="space-y-2 rounded-lg border bg-muted/30 p-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <Input required placeholder="Name *" value={f.first_name} onChange={(e) => setF({ ...f, first_name: e.target.value })} />
        <Input required placeholder="Surname *" value={f.last_name} onChange={(e) => setF({ ...f, last_name: e.target.value })} />
        <Input required type="email" placeholder="Email *" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
        <Input placeholder="Role / title" value={f.role_title} onChange={(e) => setF({ ...f, role_title: e.target.value })} />
      </div>
      <PhoneInput required code={f.code} number={f.number} onChange={(code, number) => setF({ ...f, code, number })} />
      <div className="flex flex-wrap gap-4 text-sm">
        <label className="flex items-center gap-2"><Checkbox checked={f.is_primary_contact} onCheckedChange={(c) => setF({ ...f, is_primary_contact: !!c })} />Primary contact</label>
        <label className="flex items-center gap-2"><Checkbox checked={f.receives_job_sheets} onCheckedChange={(c) => setF({ ...f, receives_job_sheets: !!c })} />Send job sheets</label>
      </div>
      <div className="flex gap-2"><Button type="submit" size="sm"><Check className="mr-1 h-4 w-4" />Save</Button><Button type="button" size="sm" variant="ghost" onClick={() => setEditing(null)}><X className="mr-1 h-4 w-4" />Cancel</Button></div>
    </form>
  );

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="font-medium">Contacts</h3>
        {editing === null && <Button size="sm" variant="outline" onClick={() => { setF(emptyContact); setEditing("new"); }}><Plus className="mr-1 h-4 w-4" />Add contact</Button>}
      </div>
      <p className="text-xs text-muted-foreground">Tick “Send” for each contact who should receive the job sheet when the technician submits it.</p>
      {editing === "new" && form}
      {contacts.length === 0 && editing !== "new" && <p className="text-sm text-muted-foreground">No contacts yet.</p>}
      {contacts.map((c) => editing === c.id ? <div key={c.id}>{form}</div> : (
        <div key={c.id} className="flex items-center gap-3 rounded-lg border p-2">
          <label className="flex flex-col items-center text-[10px] text-muted-foreground"><Checkbox aria-label="Send job sheets" checked={c.receives_job_sheets} onCheckedChange={(v) => toggleRecipient(c.id, !!v)} />Send</label>
          <div className="min-w-0 flex-1 text-sm">
            <div className="font-medium">{c.first_name} {c.last_name}{c.is_primary_contact && <span className="ml-2 rounded bg-primary/15 px-1.5 text-xs text-primary">Primary</span>}</div>
            <div className="truncate text-muted-foreground">{c.email} · {c.phone}</div>
          </div>
          <Button size="icon" variant="ghost" aria-label="Edit" onClick={() => { const p = splitPhone(c.phone); setF({ first_name: c.first_name, last_name: c.last_name ?? "", email: c.email ?? "", code: p.code, number: p.number, role_title: c.role_title ?? "", is_primary_contact: c.is_primary_contact, receives_job_sheets: c.receives_job_sheets }); setEditing(c.id); }}><Pencil className="h-4 w-4" /></Button>
          <Button size="icon" variant="ghost" aria-label="Delete" onClick={() => remove(c.id)}><Trash2 className="h-4 w-4" /></Button>
        </div>
      ))}
    </div>
  );
}

type EqDraft = { asset_category: string; reference_number: string; serial_number: string };
const emptyEq: EqDraft = { asset_category: "", reference_number: "", serial_number: "" };

export function EquipmentManager({ clientId, companyId }: { clientId: string; companyId: string }) {
  const qc = useQueryClient();
  const key = ["client-assets", clientId];
  const { data: assets = [] } = useQuery({ queryKey: key, queryFn: async () => (await supabase.from("assets").select("*").eq("client_id", clientId).order("reference_number")).data ?? [] });
  const [editing, setEditing] = useState<string | null>(null);
  const [f, setF] = useState<EqDraft>(emptyEq);
  const refresh = () => { qc.invalidateQueries({ queryKey: key }); qc.invalidateQueries({ queryKey: ["assets"] }); qc.invalidateQueries({ queryKey: ["assets-all"] }); };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!f.asset_category) { toast.error("Pick an equipment type"); return; }
    const row = { asset_category: f.asset_category, reference_number: f.reference_number, serial_number: f.serial_number || null };
    const { error } = editing === "new"
      ? await supabase.from("assets").insert({ ...row, client_id: clientId, company_id: companyId })
      : await supabase.from("assets").update(row).eq("id", editing!);
    if (error) { toast.error(error.message); return; }
    setEditing(null); refresh();
  };
  const remove = async (id: string) => {
    if (!confirm("Delete this equipment?")) return;
    const { error } = await supabase.from("assets").delete().eq("id", id);
    if (error) toast.error(error.message); else refresh();
  };

  const form = (
    <form onSubmit={save} className="space-y-2 rounded-lg border bg-muted/30 p-3">
      <div className="space-y-1"><Label>Equipment type *</Label>
        <Select value={f.asset_category} onValueChange={(v) => setF({ ...f, asset_category: v })}>
          <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
          <SelectContent>{EQUIPMENT_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="space-y-1"><Label>Reference *</Label><Input required value={f.reference_number} onChange={(e) => setF({ ...f, reference_number: e.target.value })} /></div>
        <div className="space-y-1"><Label>Serial No.</Label><Input value={f.serial_number} onChange={(e) => setF({ ...f, serial_number: e.target.value })} /></div>
      </div>
      <div className="flex gap-2"><Button type="submit" size="sm"><Check className="mr-1 h-4 w-4" />Save</Button><Button type="button" size="sm" variant="ghost" onClick={() => setEditing(null)}><X className="mr-1 h-4 w-4" />Cancel</Button></div>
    </form>
  );

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="font-medium">Equipment</h3>
        {editing === null && <Button size="sm" variant="outline" onClick={() => { setF(emptyEq); setEditing("new"); }}><Plus className="mr-1 h-4 w-4" />Add equipment</Button>}
      </div>
      {editing === "new" && form}
      {assets.length === 0 && editing !== "new" && <p className="text-sm text-muted-foreground">No equipment yet.</p>}
      {assets.map((a) => editing === a.id ? <div key={a.id}>{form}</div> : (
        <div key={a.id} className="flex items-center gap-3 rounded-lg border p-2 text-sm">
          <div className="min-w-0 flex-1">
            <div className="font-medium">{a.asset_category}</div>
            <div className="text-muted-foreground">Ref {a.reference_number} · S/N {a.serial_number ?? "—"}</div>
          </div>
          <Button size="icon" variant="ghost" aria-label="Edit" onClick={() => { setF({ asset_category: a.asset_category, reference_number: a.reference_number, serial_number: a.serial_number ?? "" }); setEditing(a.id); }}><Pencil className="h-4 w-4" /></Button>
          <Button size="icon" variant="ghost" aria-label="Delete" onClick={() => remove(a.id)}><Trash2 className="h-4 w-4" /></Button>
        </div>
      ))}
    </div>
  );
}
