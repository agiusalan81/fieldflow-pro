import { useEdition } from '@/lib/plan-features';
import { isInHouse } from '@/lib/editions';
import { defaultRenewalDates, renewalDatesValid } from '@/lib/renewal-dates';
import { CoverageDatePicker } from '@/components/coverage-date-picker';
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyRules } from "@/lib/company";
import { daysUntil, dueForRenewal } from "@/lib/jobsheets";
import { EmptyState } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SignaturePad } from "@/components/signature-pad";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CommercialRecipients } from '@/components/commercial-recipients';

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

export function RenewalList({ office, limit }: { office: boolean; limit?: number }) {
  const inhouse=isInHouse(useEdition().edition);
  const { data = [] } = useAgreements();
  const { data: c } = useCompanyRules();
  const qc = useQueryClient();
  const coverage = useQuery({ queryKey: ['renewal-covered-agreements'], queryFn: async () => { const r = await supabase.from('agreement_assets').select('agreement_id'); if (r.error) throw r.error; return new Set(r.data.map(x => x.agreement_id)); } });
  const due = data.filter((a) => !coverage.data?.has(a.id) && a.status === "active" && (dueForRenewal(a.end_date, c?.renewalDays ?? 30) || daysUntil(a.end_date) < 0));
  const act = async (id: string, patch: Record<string, string | null>, msg: string) => {
    const { error } = await supabase.from("maintenance_agreements").update(patch as never).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success(msg);
    qc.invalidateQueries({ queryKey: ["agreements"] });
  };
  const [pack, setPack] = useState<(typeof data)[number] | null>(null);
  const [busy,setBusy]=useState(false);
  const renew = async (a: (typeof data)[number], values: { signature: string; name: string; start: string; end: string }) => {
    setBusy(true);
    try { const r=await supabase.rpc('renew_contract_coverage',{_id:a.id,_expected_end:a.end_date,_start:values.start,_end:values.end,_signature:values.signature,_name:values.name}); if(r.error)throw r.error; await qc.invalidateQueries({queryKey:['agreements']}); setPack(null); toast.success('Coverage renewed with selected dates'); }
    catch(e){toast.error((e as {message?:string}).message??'Could not renew coverage');} finally{setBusy(false);}
  };
  if (!due.length) return <EmptyState>No coverage expiring in the next {c?.renewalDays ?? 30} days.</EmptyState>;
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
                {!inhouse && !a.price_confirmed_at && <Button size="sm" onClick={() => act(a.id, { price_confirmed_at: new Date().toISOString() }, "Price confirmed")}>Confirm price</Button>}
                {!inhouse && a.price_confirmed_at && !a.renewal_sent_at && <Button size="sm" onClick={() => act(a.id, { renewal_sent_at: new Date().toISOString() }, "Marked as sent to client")}>Mark renewal sent</Button>}
                <Button size="sm" variant="outline" onClick={() => setPack(a)}>{inhouse?'Renew coverage':'Renewal pack & signature'}</Button>
                {!inhouse&&<CommercialRecipients clientId={a.client_id} siteId={a.site_id} purpose="contract" title={`Contract renewal · ${a.clients?.name??''}`} body={`Contract renewal for ${a.clients?.name??''}${a.sites?.name?` · ${a.sites.name}`:''}. Current agreement ends ${a.end_date}. Annual price €${Number(a.annual_price).toFixed(2)}.`}/> }
              </div>
            )}
          </li>
        );
      })}
      {pack && <RenewalPack a={pack} onClose={() => setPack(null)} busy={busy} inhouse={inhouse} onSign={values => renew(pack, values)} />}
    </ul>
  );
}

type Agreement = NonNullable<ReturnType<typeof useAgreements>["data"]>[number];
/** Unchanged contract + equipment checklist shown to the client, who signs digitally to renew. */
function RenewalPack({ a, onClose, onSign, busy, inhouse }: { a: Agreement; onClose: () => void; busy:boolean; inhouse:boolean; onSign: (s: { signature: string; name: string; start:string; end:string }) => Promise<void> }) {
  const cat = a.contract_types?.equipment_category;
  const { data: lists = [] } = useQuery({ queryKey: ["renewal-checklist", cat], enabled: !!cat,
    queryFn: async () => (await supabase.from("checklist_templates").select("name, items").eq("equipment_category", cat??'')).data ?? [] });
  const [sig, setSig] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [dates,setDates]=useState(()=>defaultRenewalDates(a.end_date));
  const items = (l: { items: unknown }) => (Array.isArray(l.items) ? l.items : []).map((i) => (typeof i === "string" ? i : (i as { label?: string })?.label ?? "")).filter(Boolean);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{inhouse?'Coverage renewal':'Contract renewal'} — {a.title||a.clients?.name}</DialogTitle></DialogHeader>
        <section className="space-y-1 rounded-lg border p-3 text-sm">
          <p className="font-medium">Same terms as the current contract</p>
          <p>{a.contract_types?.name ?? "Custom"}{a.contract_types?.tier ? ` · ${a.contract_types.tier}` : ""}{a.sites?.name ? ` · ${a.sites.name}` : ""}</p>
          <p>€{Number(a.annual_price).toFixed(2)} annual price · {dates.start} → {dates.end}</p>
          {a.notes && <p className="whitespace-pre-wrap text-muted-foreground">{a.notes}</p>}
        </section>
        <section className="space-y-1 rounded-lg border p-3 text-sm">
          <p className="font-medium">Maintenance checklist</p>
          {lists.length === 0 ? <p className="text-muted-foreground">No checklist set up for this equipment type.</p> : lists.map((l) => (
            <div key={l.name}><p className="text-muted-foreground">{l.name}</p><ul className="list-disc pl-5">{items(l).map((i) => <li key={i}>{i}</li>)}</ul></div>
          ))}
        </section>
        <CoverageDatePicker label="Renewal start date" value={dates.start} onChange={start=>setDates({...dates,start})}/><CoverageDatePicker label="Renewal expiry date" value={dates.end} onChange={end=>setDates({...dates,end})}/>{!renewalDatesValid(dates.start,dates.end)&&<p role="alert" className="text-destructive">Expiry must be after start date.</p>}
        {!inhouse&&<><div className="space-y-1.5"><Label>Client full name *</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div className="space-y-1.5"><Label>Client signature *</Label><SignaturePad value={sig} onChange={setSig} /></div></>}
        <DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button disabled={busy||!renewalDatesValid(dates.start,dates.end)||(!inhouse&&(!sig||!name.trim()))} onClick={() => {if(!inhouse&&(!sig||!name.trim()))return;void onSign({ signature: sig??'', name: name.trim(), ...dates });}}>{busy?'Saving…':inhouse?'Confirm renewal':'Sign & renew'}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

