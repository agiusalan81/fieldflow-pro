import { parsePhone } from "@/lib/contact-details";
import { tenantLocale } from "@/lib/locale";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Pencil, Plus, Trash2, Check, X, Copy, ChevronDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/lib/profile";
import { RoleCombobox, learnContactRole, LookupInput, learnLookup, useLookup, EQUIPMENT_TYPE } from "@/components/role-combobox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const COUNTRIES: [string, string][] = [["+356", "Malta"], ["+44", "UK"], ["+353", "Ireland"], ["+39", "Italy"], ["+49", "Germany"], ["+33", "France"], ["+34", "Spain"], ["+351", "Portugal"], ["+30", "Greece"], ["+31", "Netherlands"], ["+32", "Belgium"], ["+41", "Switzerland"], ["+43", "Austria"], ["+48", "Poland"], ["+40", "Romania"], ["+359", "Bulgaria"], ["+381", "Serbia"], ["+90", "Turkey"], ["+1", "USA / Canada"], ["+61", "Australia"], ["+971", "UAE"], ["+966", "Saudi Arabia"], ["+20", "Egypt"], ["+218", "Libya"], ["+216", "Tunisia"], ["+91", "India"], ["+63", "Philippines"], ["+977", "Nepal"], ["+880", "Bangladesh"], ["+234", "Nigeria"]];
export const COUNTRY_CODES = COUNTRIES.map((c) => c[0]);
export const EQUIPMENT_TYPES = ["Passenger Lift", "Goods Lift", "Platform Lift", "Escalator", "Dumbwaiter", "HVAC", "Generator", "Other"];

export function splitPhone(p: string | null | undefined) {
  return parsePhone(p, tenantLocale().countryCode, COUNTRY_CODES);
}

/** Filters countries by name or dial code ("malta", "356", "+44"). */
export function searchCountries(q: string): [string, string][] {
  const s = q.trim().toLowerCase().replace(/^\+/, "");
  if (!s) return COUNTRIES;
  return COUNTRIES.filter(([c, n]) => n.toLowerCase().includes(s) || c.slice(1).startsWith(s));
}

export function PhoneInput({ code, number, onChange, required }: { code: string; number: string; onChange: (code: string, number: string) => void; required?: boolean }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const list = searchCountries(q);
  const custom = /^\+?\d{1,4}$/.test(q.trim()) && !list.some(([c]) => c === `+${q.trim().replace(/^\+/, "")}`) ? `+${q.trim().replace(/^\+/, "")}` : null;
  const pick = (c: string) => { onChange(c, number); setOpen(false); setQ(""); };
  return (
    <div className="flex min-w-0 gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" className="h-11 w-20 shrink-0 justify-between px-2 font-normal" aria-label="Country code">{code}<ChevronDown className="h-4 w-4 opacity-50" /></Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-2" align="start">
          <Input autoFocus placeholder="Search country or code" value={q} onChange={(e) => setQ(e.target.value)} className="mb-2 h-9" />
          <div className="max-h-60 overflow-y-auto">
            {custom && <button type="button" className="w-full rounded px-2 py-1.5 text-left text-sm hover:bg-accent" onClick={() => pick(custom)}>Use {custom}</button>}
            {list.map(([c, n]) => (
              <button key={c} type="button" onClick={() => pick(c)} className={`flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-sm hover:bg-accent ${c === code ? "bg-accent" : ""}`}>
                <span>{n}</span><span className="text-muted-foreground">{c}</span>
              </button>
            ))}
            {!list.length && !custom && <p className="px-2 py-1.5 text-sm text-muted-foreground">No country found</p>}
          </div>
        </PopoverContent>
      </Popover>
      <Input className="h-11 min-w-0 flex-1" aria-label="Phone number" required={required} type="tel" inputMode="tel" pattern="[0-9 ]{4,}" title="Digits only" placeholder="Phone number" value={number} onChange={(e) => onChange(code, e.target.value)} />
    </div>
  );
}

export function WhatsAppBadge() {
  return <span className="ml-2 rounded bg-success/15 px-1.5 text-xs text-success">WhatsApp</span>;
}

type ContactDraft = { first_name: string; last_name: string; email: string; code: string; number: string; role_title: string; is_primary_contact: boolean; receives_job_sheets: boolean; has_whatsapp: boolean };
const emptyContact = (): ContactDraft => ({ first_name: "", last_name: "", email: "", code: tenantLocale().countryCode, number: "", role_title: "", is_primary_contact: false, receives_job_sheets: false, has_whatsapp: false });

/** siteId: undefined = every contact of the client, null = head-office contacts, string = that site's contacts. */
export function ContactsManager({ clientId, companyId, siteId, title = "Contacts" }: { clientId: string; companyId: string; siteId?: string | null; title?: string }) {
  const qc = useQueryClient();
  const { data: profile } = useProfile();
  const key = ["client-contacts", clientId];
  const { data: allContacts = [] } = useQuery({ queryKey: key, queryFn: async () => (await supabase.from("client_contacts").select("*").eq("client_id", clientId).order("is_primary_contact", { ascending: false })).data ?? [] });
  const contacts = siteId === undefined ? allContacts : allContacts.filter((c) => (c.site_id ?? null) === siteId);
  const others = allContacts.filter((c) => !contacts.some((x) => x.id === c.id));
  const [editing, setEditing] = useState<string | null>(null);
  const [f, setF] = useState<ContactDraft>(emptyContact);
  const refresh = () => { qc.invalidateQueries({ queryKey: key }); qc.invalidateQueries({ queryKey: ["contacts"] }); qc.invalidateQueries({ queryKey: ["entities-unified"] }); qc.invalidateQueries({ queryKey: ["lookup", "contact_role"] }); };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const row = { first_name: f.first_name, last_name: f.last_name, email: f.email, phone: `${f.code} ${f.number}`.trim(), role_title: f.role_title.trim() || null, is_primary_contact: f.is_primary_contact, receives_job_sheets: f.receives_job_sheets, has_whatsapp: f.has_whatsapp };
    const { error } = editing === "new"
      ? await supabase.from("client_contacts").insert({ ...row, client_id: clientId, company_id: companyId, site_id: siteId ?? null })
      : await supabase.from("client_contacts").update(row).eq("id", editing!);
    if (error) { toast.error(error.message); return; }
    if (profile && row.role_title) await learnContactRole(row.role_title, companyId, profile.id);
    setEditing(null); refresh();
  };
  const clone = async (id: string) => {
    const c = allContacts.find((x) => x.id === id);
    if (!c) return;
    const { id: _id, ...rest } = c;
    const { error } = await supabase.from("client_contacts").insert({ ...rest, site_id: siteId ?? null, is_primary_contact: false });
    if (error) toast.error(error.message); else { toast.success(`${c.first_name} copied here`); refresh(); }
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
        <RoleCombobox value={f.role_title} onChange={(v) => setF({ ...f, role_title: v })} />
      </div>
      <PhoneInput required code={f.code} number={f.number} onChange={(code, number) => setF({ ...f, code, number })} />
      <div className="flex flex-wrap gap-4 text-sm">
        <label className="flex items-center gap-2"><Checkbox checked={f.is_primary_contact} onCheckedChange={(c) => setF({ ...f, is_primary_contact: !!c })} />Primary contact</label>
        <label className="flex items-center gap-2"><Checkbox checked={f.receives_job_sheets} onCheckedChange={(c) => setF({ ...f, receives_job_sheets: !!c })} />Send job sheets</label>
        <label className="flex items-center gap-2"><Checkbox checked={f.has_whatsapp} onCheckedChange={(c) => setF({ ...f, has_whatsapp: !!c })} />Available on WhatsApp</label>
      </div>
      <div className="flex gap-2"><Button type="submit" size="sm"><Check className="mr-1 h-4 w-4" />Save</Button><Button type="button" size="sm" variant="ghost" onClick={() => setEditing(null)}><X className="mr-1 h-4 w-4" />Cancel</Button></div>
    </form>
  );

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-medium">{title}</h3>
        {editing === null && (
          <div className="flex gap-2">
            {siteId !== undefined && others.length > 0 && (
              <Select value="" onValueChange={clone}>
                <SelectTrigger className="h-9 w-40"><Copy className="mr-1 h-3.5 w-3.5" /><SelectValue placeholder="Copy contact" /></SelectTrigger>
                <SelectContent>{others.map((c) => <SelectItem key={c.id} value={c.id}>{c.first_name} {c.last_name}{c.role_title ? ` · ${c.role_title}` : ""}</SelectItem>)}</SelectContent>
              </Select>
            )}
            <Button size="sm" variant="outline" onClick={() => { setF(emptyContact()); setEditing("new"); }}><Plus className="mr-1 h-4 w-4" />Add contact</Button>
          </div>
        )}
      </div>
      {editing === "new" && form}
      {contacts.length === 0 && editing !== "new" && <p className="text-sm text-muted-foreground">No contacts yet.</p>}
      {contacts.map((c) => editing === c.id ? <div key={c.id}>{form}</div> : (
        <div key={c.id} className="flex items-center gap-3 rounded-lg border p-2">
          <label className="flex flex-col items-center text-[10px] text-muted-foreground"><Checkbox aria-label="Send job sheets" checked={c.receives_job_sheets} onCheckedChange={(v) => toggleRecipient(c.id, !!v)} />Send</label>
          <div className="min-w-0 flex-1 text-sm">
            <div className="font-medium">{c.first_name} {c.last_name}{c.role_title && <span className="ml-2 text-xs font-normal text-muted-foreground">{c.role_title}</span>}{c.is_primary_contact && <span className="ml-2 rounded bg-primary/15 px-1.5 text-xs text-primary">Primary</span>}{c.has_whatsapp && <WhatsAppBadge />}</div>
            <div className="truncate text-muted-foreground">{c.email} · {c.phone}</div>
          </div>
          <Button size="icon" variant="ghost" aria-label="Edit" onClick={() => { const p = splitPhone(c.phone); setF({ first_name: c.first_name, last_name: c.last_name ?? "", email: c.email ?? "", code: p.code, number: p.number, role_title: c.role_title ?? "", is_primary_contact: c.is_primary_contact, receives_job_sheets: c.receives_job_sheets, has_whatsapp: c.has_whatsapp }); setEditing(c.id); }}><Pencil className="h-4 w-4" /></Button>
          <Button size="icon" variant="ghost" aria-label="Delete" onClick={() => remove(c.id)}><Trash2 className="h-4 w-4" /></Button>
        </div>
      ))}
    </div>
  );
}

type EqDraft = { asset_category: string; reference_number: string; serial_number: string };
const emptyEq: EqDraft = { asset_category: "", reference_number: "", serial_number: "" };

/** siteId: undefined = all client equipment, string = equipment at that site. */
export function EquipmentManager({ clientId, companyId, siteId }: { clientId: string; companyId: string; siteId?: string }) {
  const qc = useQueryClient();
  const key = ["client-assets", clientId];
  const { data: allAssets = [] } = useQuery({ queryKey: key, queryFn: async () => (await supabase.from("assets").select("*").eq("client_id", clientId).order("reference_number")).data ?? [] });
  const assets = siteId === undefined ? allAssets : allAssets.filter((a) => a.site_id === siteId);
  const [editing, setEditing] = useState<string | null>(null);
  const [f, setF] = useState<EqDraft>(emptyEq);
  const [other, setOther] = useState("");
  const { data: learnt = [] } = useLookup(EQUIPMENT_TYPE);
  const types = [...EQUIPMENT_TYPES.filter((t) => t !== "Other"), ...learnt.filter((l) => l.is_approved && !EQUIPMENT_TYPES.includes(l.label_value)).map((l) => l.label_value), "Other"];
  const refresh = () => { qc.invalidateQueries({ queryKey: key }); qc.invalidateQueries({ queryKey: ["assets"] }); qc.invalidateQueries({ queryKey: ["assets-all"] }); qc.invalidateQueries({ queryKey: ["entities-unified"] }); };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!f.asset_category) { toast.error("Pick an equipment type"); return; }
    const category = f.asset_category === "Other" ? other.trim() : f.asset_category;
    if (!category) { toast.error("Specify the equipment type"); return; }
    const row = { asset_category: category, reference_number: f.reference_number, serial_number: f.serial_number || null };
    const { error } = editing === "new"
      ? await supabase.from("assets").insert({ ...row, client_id: clientId, company_id: companyId, site_id: siteId ?? null })
      : await supabase.from("assets").update(row).eq("id", editing!);
    if (error) { toast.error(error.message); return; }
    if (f.asset_category === "Other") { const { data: u } = await supabase.auth.getUser(); if (u.user) await learnLookup(EQUIPMENT_TYPE, category, companyId, u.user.id); setOther(""); }
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
          <SelectContent>{types.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
        </Select>
        {f.asset_category === "Other" && <LookupInput category={EQUIPMENT_TYPE} value={other} onChange={setOther} placeholder="Specify type (e.g. Car lift, Dock leveller)" />}
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
          <Button size="icon" variant="ghost" aria-label="Edit" onClick={() => { const known = types.includes(a.asset_category); setOther(known ? "" : a.asset_category); setF({ asset_category: known ? a.asset_category : "Other", reference_number: a.reference_number, serial_number: a.serial_number ?? "" }); setEditing(a.id); }}><Pencil className="h-4 w-4" /></Button>
          <Button size="icon" variant="ghost" aria-label="Delete" onClick={() => remove(a.id)}><Trash2 className="h-4 w-4" /></Button>
        </div>
      ))}
    </div>
  );
}
