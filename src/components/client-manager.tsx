import { EquipmentQr } from "@/components/equipment-qr";
import { ClientPortalInvitationGate } from '@/components/client-portal-invitation-gate';
import { useClientPortalAccess } from '@/lib/client-portal-access';
import { usePlanFeatures } from '@/lib/plan-features';
import { PORTAL_URL } from '@/lib/client-routing';
import { labelKey, uniqueLabels } from "@/lib/attention-rules";
import { parsePhone } from "@/lib/contact-details";
import { tenantLocale } from "@/lib/locale";
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Pencil, Plus, Trash2, Check, X, Copy, ChevronDown, BookOpen } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { isOffice, useProfile } from "@/lib/profile";
import { ClientContractDocuments } from "@/components/client-contract-documents";
import { EquipmentContracts } from '@/components/equipment-contracts';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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

/** Staff contacts never depend on an external portal workspace. */
export { StaffContacts as ContactsManager } from '@/components/staff-contacts';

type EqDraft = { asset_category: string; reference_number: string; serial_number: string };
const emptyEq: EqDraft = { asset_category: "", reference_number: "", serial_number: "" };

/** siteId: undefined = all client equipment, string = equipment at that site. */
export function EquipmentManager({ clientId, companyId, siteId }: { clientId: string; companyId: string; siteId?: string }) {
  const qc = useQueryClient();
  const { data: profile } = useProfile();
  const hasPassport = usePlanFeatures()("lift_pack");
  const [documentEquipment, setDocumentEquipment] = useState<{ id: string; site_id: string | null; reference_number: string } | null>(null);
  const key = ["client-assets", clientId];
  const { data: allAssets = [] } = useQuery({ queryKey: key, queryFn: async () => (await supabase.from("assets").select("*").eq("client_id", clientId).order("reference_number")).data ?? [] });
  const assets = siteId === undefined ? allAssets : allAssets.filter((a) => a.site_id === siteId);
  const [editing, setEditing] = useState<string | null>(null);
  const [f, setF] = useState<EqDraft>(emptyEq);
  const [other, setOther] = useState("");
  const { data: learnt = [] } = useLookup(EQUIPMENT_TYPE);
  const types = [...uniqueLabels([...EQUIPMENT_TYPES.filter(t=>t!=="Other"), ...learnt.filter(l=>l.is_approved).map(l=>l.label_value), ...allAssets.map(a=>a.asset_category)]).filter(t=>labelKey(t)!=="other"), "Other"];
  const refresh = () => { qc.invalidateQueries({ queryKey: key }); qc.invalidateQueries({ queryKey: ["assets"] }); qc.invalidateQueries({ queryKey: ["assets-all"] }); qc.invalidateQueries({ queryKey: ["entities-unified"] }); };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!f.asset_category) { toast.error("Pick an equipment type"); return; }
    const raw = f.asset_category === "Other" ? other.trim() : f.asset_category;
    const category = types.find(t=>labelKey(t)===labelKey(raw)) ?? raw;
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
        <div key={a.id} className="flex flex-wrap items-center gap-2 rounded-lg border p-2 text-sm">
          <div className="min-w-0 flex-1">
            <div className="font-medium">{a.asset_category}</div>
            <div className="text-muted-foreground">Ref {a.reference_number} · S/N {a.serial_number ?? "—"}</div>
          </div>
          <EquipmentQr assetId={a.id} reference={a.reference_number}/>
          <Button asChild size="sm" variant="outline"><Link to="/equipment/$assetId" params={{ assetId: a.id }} hash={hasPassport ? "passport" : undefined} aria-label={`${hasPassport ? "Passport" : "View equipment"} ${a.reference_number}`}><BookOpen className="mr-1 h-4 w-4" />{hasPassport ? "Passport" : "View equipment"}</Link></Button>
          <EquipmentContracts companyId={companyId} clientId={clientId} siteId={a.site_id ?? undefined} assetId={a.id} />
          {isOffice(profile) && <Button size="sm" variant="outline" aria-label={`Add document to equipment ${a.reference_number}`} onClick={() => setDocumentEquipment(a)}><Plus className="mr-1 h-4 w-4" />Add document</Button>}
          <Button size="icon" variant="ghost" aria-label="Edit" onClick={() => { const canonical = types.find(t=>labelKey(t)===labelKey(a.asset_category)); const known = !!canonical; setOther(known ? "" : a.asset_category); setF({ asset_category: canonical ?? "Other", reference_number: a.reference_number, serial_number: a.serial_number ?? "" }); setEditing(a.id); }}><Pencil className="h-4 w-4" /></Button>
          <Button size="icon" variant="ghost" aria-label="Delete" onClick={() => remove(a.id)}><Trash2 className="h-4 w-4" /></Button>
        </div>
      ))}
      <Dialog open={!!documentEquipment} onOpenChange={(open) => { if (!open) setDocumentEquipment(null); }}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader><DialogTitle>Equipment documents · {documentEquipment?.reference_number}</DialogTitle></DialogHeader>
          {documentEquipment && <ClientContractDocuments key={documentEquipment.id} companyId={companyId} clientId={clientId} siteId={documentEquipment.site_id ?? undefined} assetId={documentEquipment.id} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
