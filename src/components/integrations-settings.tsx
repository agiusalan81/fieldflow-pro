import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, Download, Mail, Plus, Trash2 } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { sendTestEmail } from "@/lib/invites.functions";
import { supabase } from "@/integrations/supabase/client";
import { ACCOUNTING, ACCOUNTING_GUIDES, CHANNELS, EVENTS, MERGE_TAGS, SAMPLE, TAG_LABELS, toFriendly, fromFriendly, parseIntegrations, renderTemplate, type AccountingKey, type Integrations, type ChannelKey } from "@/lib/integrations";
import { accountingGuidePdf } from "@/lib/accounting-guide-pdf";
import { useCompanyTitle } from "@/lib/company-name";
import { parseRates, ZERO_RATES, type Rates } from "@/lib/billing";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { WhatsAppTemplateStudio, type StudioPrefill } from "@/components/whatsapp-template-studio";

const WA_TYPE: Record<string, string> = { on_my_way: "on_my_way", job_completed: "job_completed", renewal_notice: "renewal", estimate_sent: "estimate", no_access: "custom_update", unsigned_left: "custom_update" };

export function RatesFields({ value, onChange }: { value: Rates; onChange: (r: Rates) => void }) {
  const f = (k: keyof Rates, l: string) => (
    <div className="space-y-1.5"><Label>{l}</Label><Input type="number" min="0" step="0.5" inputMode="decimal" value={value[k] || ""} onChange={(e) => onChange({ ...value, [k]: Number(e.target.value) || 0 })} /></div>
  );
  return <div className="grid gap-3 sm:grid-cols-4">{f("standard", "Standard 1.0× / h")}{f("ot15", "Overtime 1.5× / h")}{f("ot20", "Overtime 2.0× / h")}{f("callout", "Call-out fee")}</div>;
}

function EmailDeliveryCard({ companyId }: { companyId: string }) {
  const send = useServerFn(sendTestEmail);
  const [busy, setBusy] = useState(false);
  const { data } = useQuery({
    queryKey: ["company-email", companyId],
    queryFn: async () => (await supabase.from("company_settings").select("company_email").eq("company_id", companyId).maybeSingle()).data,
  });
  const reply = data?.company_email?.trim();
  const test = async () => {
    setBusy(true);
    try { const r = await send({ data: { companyId } }); toast.success(`Test email sent to ${r.to} — check your inbox`); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Test email failed"); }
    finally { setBusy(false); }
  };
  return (
    <section className="space-y-4 rounded-xl border bg-card p-5">
      <div className="flex items-start gap-3">
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
        <div className="space-y-1">
          <h2 className="font-medium text-foreground">Email delivery: active and ready</h2>
          <p className="text-sm text-muted-foreground">Team invites and client emails send automatically — nothing to set up. Your company name is shown on every email.</p>
          <p className="text-sm text-foreground">Client replies go to: <b>{reply || "not set yet"}</b>{!reply && <span className="text-muted-foreground"> — add your company email in Company info.</span>}</p>
        </div>
      </div>
      <Button variant="outline" onClick={test} disabled={busy}><Mail className="mr-2 h-4 w-4" />{busy ? "Sending…" : "Send test email to me"}</Button>
      <div className="space-y-2 border-t pt-4">
        <p className="text-sm font-medium text-foreground">Optional: send from your own mailbox</p>
        <p className="text-sm text-muted-foreground">Want emails to come straight from your own Google or Microsoft address? One-click sign-in is coming soon — no passwords or server settings needed.</p>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" disabled>Connect Google / Gmail · soon</Button>
          <Button variant="secondary" disabled>Connect Microsoft 365 / Outlook · soon</Button>
        </div>
      </div>
    </section>
  );
}

function AccountingGuide({ provider }: { provider: AccountingKey }) {
  const g = ACCOUNTING_GUIDES[provider];
  const company = useCompanyTitle("").trim();
  const name = ACCOUNTING.find((a) => a.key === provider)?.label ?? provider;
  const download = async () => {
    try {
      const pdf = await accountingGuidePdf(provider, company);
      const url = URL.createObjectURL(new Blob([pdf as unknown as BlobPart], { type: "application/pdf" }));
      const a = document.createElement("a"); a.href = url; a.download = `Connect_${name.replace(/\W+/g, "_")}_guide.pdf`; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
    } catch { toast.error("Could not create the guide"); }
  };
  return (
    <details className="rounded-lg border bg-muted/40 p-4 text-sm" open>
      <summary className="cursor-pointer font-medium text-foreground">How to connect {name}</summary>
      <p className="mt-2 text-muted-foreground">{g.intro}</p>
      <p className="mt-3 font-medium text-foreground">Before you start</p>
      <ul className="list-disc pl-5 text-muted-foreground">{g.before.map((b) => <li key={b}>{b}</li>)}</ul>
      <p className="mt-3 font-medium text-foreground">Steps</p>
      <ol className="list-decimal space-y-1 pl-5 text-muted-foreground">{g.steps.map((s) => <li key={s}>{s}</li>)}</ol>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" onClick={download}><Download className="mr-1 h-4 w-4" />Download guide (PDF)</Button>
        <Button asChild size="sm" variant="ghost"><a href={g.link} target="_blank" rel="noreferrer">{name} help centre</a></Button>
      </div>
    </details>
  );
}

export function IntegrationsSettings({ companyId, part }: { companyId: string; part: "messaging" | "accounting" }) {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["integrations", companyId],
    queryFn: async () => (await supabase.from("company_settings").select("integrations, default_rates").eq("company_id", companyId).maybeSingle()).data,
  });
  const [s, setS] = useState<Integrations | null>(null);
  const [rates, setRates] = useState<Rates>(ZERO_RATES);
  const [cf, setCf] = useState<string[]>([]);
  useEffect(() => { if (data !== undefined && !s) { setS(parseIntegrations(data?.integrations)); setRates(parseRates(data?.default_rates) ?? ZERO_RATES); } }, [data, s]);
  useEffect(() => { supabase.from("custom_field_definitions").select("field_label").then(({ data }) => setCf((data ?? []).map((d) => d.field_label))); }, []);
  const [prefill, setPrefill] = useState<StudioPrefill | null>(null);
  const refs = useRef<Record<string, HTMLTextAreaElement | null>>({});
  if (!s) return null;

  const save = async () => {
    const { error } = await supabase.from("company_settings").upsert({ company_id: companyId, integrations: s as never, default_rates: rates as never });
    if (error) { toast.error(error.message); return; }
    toast.success("Integrations saved");
    qc.invalidateQueries({ queryKey: ["integrations", companyId] });
  };
  const insertTag = (ev: string, tag: string) => {
    const el = refs.current[ev]; const t = s.templates[ev as keyof Integrations["templates"]];
    const f = toFriendly(t.body); const pos = el?.selectionStart ?? f.length;
    const label = `[${TAG_LABELS[tag as keyof typeof TAG_LABELS]}]`;
    setS({ ...s, templates: { ...s.templates, [ev]: { ...t, body: fromFriendly(`${f.slice(0, pos)}${label}${f.slice(pos)}`) } } });
  };
  const acc = s.accounting;
  const setAcc = (p: Partial<Integrations["accounting"]>) => setS({ ...s, accounting: { ...acc, ...p } });

  return (
    <div className="space-y-5">
      {part === "messaging" && <>
      <EmailDeliveryCard companyId={companyId} />
      <WhatsAppTemplateStudio prefill={prefill} />
      <section className="space-y-4 rounded-xl border bg-card p-5">
        <div><h2 className="font-medium text-foreground">Messaging channels</h2><p className="text-sm text-muted-foreground">All optional. Turn on the channels your company uses. Live sending starts once each provider account is connected.</p></div>
        <div className="grid gap-3 md:grid-cols-2">
          {CHANNELS.map((c) => {
            const v = s.channels[c.key];
            const set = (p: Partial<typeof v>) => setS({ ...s, channels: { ...s.channels, [c.key]: { ...v, ...p } } });
            return (
              <div key={c.key} className="space-y-2 rounded-lg border p-3">
                <div className="flex items-center justify-between"><p className="text-sm font-medium text-foreground">{c.label}</p><Switch checked={v.enabled} onCheckedChange={(b) => set({ enabled: b })} /></div>
                {v.enabled && (<>
                  <Select value={v.provider} onValueChange={(p) => set({ provider: p })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{c.providers.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent></Select>
                  <Input placeholder={c.key === "email" ? "Send from (email)" : c.key === "signal" ? "Webhook / chat ID" : "Sender number"} value={v.sender} onChange={(e) => set({ sender: e.target.value })} />
                  <p className="text-xs text-muted-foreground">{c.key === "email" ? "Emails already send automatically — see Email delivery above" : "Status: not connected yet"}</p>
                </>)}
              </div>
            );
          })}
        </div>
      </section>

      <section className="space-y-4 rounded-xl border bg-card p-5">
        <div><h2 className="font-medium text-foreground">Message templates</h2><p className="text-sm text-muted-foreground">Write each message in your own words and language. Tap a blue button to drop in details like the contact name. The preview shows exactly what the client receives.</p></div>
        {EVENTS.map((e) => {
          const t = s.templates[e.key];
          const set = (p: Partial<typeof t>) => setS({ ...s, templates: { ...s.templates, [e.key]: { ...t, ...p } } });
          return (
            <div key={e.key} className="space-y-2 rounded-lg border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium text-foreground">{e.label}</p>
                <div className="flex items-center gap-2 text-sm"><span className="text-muted-foreground">On</span><Switch checked={t.enabled} onCheckedChange={(b) => set({ enabled: b })} /></div>
              </div>
              {e.key === "emergency_dispatch" ? <p className="text-xs text-muted-foreground">Sent only inside the app, to the assigned technician's Team Chat. Never by SMS or WhatsApp.</p> : <div className="flex flex-wrap gap-3 text-sm">
                {CHANNELS.map((c) => (
                  <label key={c.key} className="flex items-center gap-1.5"><Checkbox checked={t.channels.includes(c.key)} onCheckedChange={(b) => set({ channels: b ? [...t.channels, c.key] : t.channels.filter((x: ChannelKey) => x !== c.key) })} />{c.label.split(" ")[0]}</label>
                ))}
              </div>}
              {e.key !== "emergency_dispatch" && t.channels.includes("whatsapp") && (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                  <span>WhatsApp needs Meta to approve this wording before it can be sent to clients.</span>
                  <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={() => setPrefill({ type: WA_TYPE[e.key] ?? "custom_update", wording: renderTemplate(t.body, SAMPLE), nonce: Date.now() })}>Get Meta approval</Button>
                </div>
              )}
              <div className="grid gap-3 md:grid-cols-2">
                <Textarea ref={(el) => { refs.current[e.key] = el; }} rows={4} value={toFriendly(t.body)} onChange={(ev) => set({ body: fromFriendly(ev.target.value) })} />
                <div className="rounded-lg bg-muted/50 p-3 text-sm text-foreground"><p className="mb-1 text-xs text-muted-foreground">What the client sees</p><p className="whitespace-pre-wrap rounded-2xl rounded-tl-sm bg-card p-3 shadow-sm">{renderTemplate(t.body, SAMPLE)}</p></div>
              </div>
              <div className="flex flex-wrap gap-1">
                {MERGE_TAGS.map((tag) => <button key={tag} type="button" onClick={() => insertTag(e.key, tag)} className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary hover:bg-primary/20">+ {TAG_LABELS[tag]}</button>)}
                <Button type="button" size="sm" variant="ghost" className="h-6 text-xs" onClick={() => set({ body: e.body })}>Reset</Button>
              </div>
            </div>
          );
        })}
      </section>

      </>}
      {part === "accounting" && <>
      <section className="space-y-4 rounded-xl border bg-card p-5">
        <div><h2 className="font-medium text-foreground">Default labour rates</h2><p className="text-sm text-muted-foreground">Used when a client has no rate card of its own and no fixed estimate or contract applies.</p></div>
        <RatesFields value={rates} onChange={setRates} />
      </section>

      <section className="space-y-4 rounded-xl border bg-card p-5">
        <div><h2 className="font-medium text-foreground">Accounting software</h2><p className="text-sm text-muted-foreground">Clients, addresses, job sheet numbers, parts and hours are matched automatically. Pick your accounts once below.</p></div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5"><Label>Connected software</Label>
            <Select value={acc.provider || "none"} onValueChange={(v) => setAcc({ provider: v === "none" ? "" : (v as typeof acc.provider) })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="none">None</SelectItem>{ACCOUNTING.filter((a) => a.key === "zoho" || a.key === acc.provider).map((a) => <SelectItem key={a.key} value={a.key}>{a.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <label className="flex items-center gap-2 self-end pb-2 text-sm"><Switch checked={acc.require_review} onCheckedChange={(b) => setAcc({ require_review: b })} />Office admin reviews every job sheet before export</label>
        </div>
        {acc.provider && <AccountingGuide provider={acc.provider} />}
        {acc.provider && (<>
          {acc.provider === "webhook" ? (
            <div className="space-y-1.5"><Label>Webhook URL</Label><Input placeholder="https://…" value={acc.webhook_url} onChange={(e) => setAcc({ webhook_url: e.target.value })} /></div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-3">
              {([["income_account", "Income account"], ["labour_item", "Standard labour item"], ["ot15_item", "Overtime 1.5× item"], ["ot20_item", "Overtime 2.0× item"], ["tax_rate", "Tax / VAT rate"], ["payment_terms", "Payment terms"]] as const).map(([k, l]) => (
                <div key={k} className="space-y-1.5"><Label>{l}</Label><Input placeholder="Picked from your accounts once connected" value={acc[k]} onChange={(e) => setAcc({ [k]: e.target.value })} /></div>
              ))}
            </div>
          )}
          <div className="space-y-2">
            <Label>Custom field mapping (optional)</Label>
            {acc.field_map.map((m, i) => (
              <div key={i} className="flex gap-2">
                <Select value={m.from} onValueChange={(v) => setAcc({ field_map: acc.field_map.map((x, j) => (j === i ? { ...x, from: v } : x)) })}>
                  <SelectTrigger><SelectValue placeholder="Our field" /></SelectTrigger>
                  <SelectContent>{cf.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
                <Input placeholder="Their field name" value={m.to} onChange={(e) => setAcc({ field_map: acc.field_map.map((x, j) => (j === i ? { ...x, to: e.target.value } : x)) })} />
                <Button size="icon" variant="ghost" aria-label="Remove" onClick={() => setAcc({ field_map: acc.field_map.filter((_, j) => j !== i) })}><Trash2 className="h-4 w-4" /></Button>
              </div>
            ))}
            <Button size="sm" variant="outline" disabled={!cf.length} onClick={() => setAcc({ field_map: [...acc.field_map, { from: "", to: "" }] })}><Plus className="mr-1 h-4 w-4" />Add mapping</Button>
            {!cf.length && <p className="text-xs text-muted-foreground">Create custom fields in Fields & lookups to map them.</p>}
          </div>
          <p className="text-xs text-muted-foreground">Status: not connected yet — exports are prepared and marked in the app until the account is linked.</p>
        </>)}
      </section>
      </>}
      <Button onClick={save}>{part === "messaging" ? "Save messages" : "Save accounting"}</Button>
    </div>
  );
}

export function ClientRates({ clientId }: { clientId: string }) {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["client-rates", clientId], queryFn: async () => (await supabase.from("clients").select("labor_rates").eq("id", clientId).single()).data });
  const [on, setOn] = useState<boolean | null>(null);
  const [r, setR] = useState<Rates>(ZERO_RATES);
  useEffect(() => { if (data && on === null) { const p = parseRates(data.labor_rates); setOn(!!p); setR(p ?? ZERO_RATES); } }, [data, on]);
  if (on === null) return null;
  const save = async () => {
    const { error } = await supabase.from("clients").update({ labor_rates: on ? (r as never) : null }).eq("id", clientId);
    if (error) { toast.error(error.message); return; }
    toast.success("Client rates saved");
    qc.invalidateQueries({ queryKey: ["client-rates", clientId] });
  };
  return (
    <div className="space-y-3">
      <label className="flex items-center gap-2 text-sm"><Switch checked={on} onCheckedChange={setOn} />Custom labour rates for this client</label>
      <p className="text-xs text-muted-foreground">{on ? "These rates replace the company defaults on this client's job sheets. Fixed estimates and contracts still take priority." : "Using company default rates."}</p>
      {on && <RatesFields value={r} onChange={setR} />}
      <Button size="sm" onClick={save}>Save rates</Button>
    </div>
  );
}
