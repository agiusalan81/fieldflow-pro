import { useState } from "react";
import { toast } from "sonner";
import { Settings2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Database, Json } from "@/integrations/supabase/types";
import { buildInvoice, classifyChange, upgradeProration } from "@/lib/saas-billing";
import { PLAN_FEATURES } from "@/lib/plan-features";
import { packagePrice, PERMANENT_UNTIL, SETUP_REASON } from "@/lib/platform";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { NativeSelect } from "@/components/ui/native-select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";

type Catalog = Database["public"]["Tables"]["platform_catalog"]["Row"];
type Sub = Database["public"]["Tables"]["platform_subscriptions"]["Row"];
type Override = Database["public"]["Tables"]["platform_overrides"]["Row"];
type Mode = "package" | "on" | "off";

const priceFor = (c: Catalog, cadence: string) => Number(cadence === "yearly" ? c.yearly_price : cadence === "quarterly" ? c.quarterly_price : c.monthly_price);
export const basisLabel = (b: string) => (b === "per_user" ? "per user" : "per company");

export function HQSetupPackage({ subscription, catalog, modules, overrides, companyName, money, onSaved }: {
  subscription: Sub; catalog: Catalog[]; modules: string[]; overrides: Override[]; companyName: string;
  money: (v: number) => string; onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [plan, setPlan] = useState<string | null>(subscription.plan_id);
  const [packs, setPacks] = useState<string[]>(subscription.pack_ids ?? []);
  const [users, setUsers] = useState(subscription.seats);
  const [cadence, setCadence] = useState(subscription.cadence);
  const [price, setPrice] = useState(Number(subscription.agreed_price));
  const [modes, setModes] = useState<Record<string, Mode>>({});
  const [saving, setSaving] = useState(false);
  const [immediate, setImmediate] = useState(false);
  const tiers = catalog.filter((c) => c.kind === "plan"); const packList = catalog.filter((c) => c.kind === "pack");
  const setup = overrides.filter((o) => o.subscription_id === subscription.id && o.reason === SETUP_REASON);

  const start = () => {
    setImmediate(subscription.trial_package_only);
    setPlan(subscription.plan_id); setPacks(subscription.pack_ids ?? []); setUsers(subscription.seats); setCadence(subscription.cadence); setPrice(Number(subscription.agreed_price));
    setModes(Object.fromEntries(modules.map((m) => { const o = setup.find((x) => x.module === m); return [m, o ? (o.enabled ? "on" : "off") : "package"]; })));
    setOpen(true);
  };
  const chosen = catalog.filter((c) => c.id === plan || packs.includes(c.id));
  const included = new Set(["core", ...chosen.flatMap((c) => c.modules)]);
  const suggested = packagePrice(chosen.map((c) => ({ price: priceFor(c, cadence), billing_basis: c.billing_basis })), users);

  const save = async () => {
    setSaving(true);
    try {
      if (immediate) {
        const r = await supabase.rpc('hq_apply_setup_now',{_subscription:subscription.id,_plan:plan as unknown as string,_packs:packs,_seats:users,_cadence:cadence,_price:price,_modes:modes as Json});
        if (r.error) throw r.error;
        toast.success(`Setup package applied immediately for ${companyName}; trial dates and invoices retained.`);
        setOpen(false); onSaved(); return;
      }
      const oldItems = catalog.filter((c) => c.id === subscription.plan_id || (subscription.pack_ids ?? []).includes(c.id));
      const oldPrice = Number(subscription.agreed_price) > 0 ? Number(subscription.agreed_price) : packagePrice(oldItems.map((c) => ({ price: priceFor(c, subscription.cadence), billing_basis: c.billing_basis })), subscription.seats);
      const newPrice = price > 0 ? price : suggested;
      const change = { plan_id: plan, pack_ids: packs, seats: users, cadence, agreed_price: price };
      const kind = cadence !== subscription.cadence ? "downgrade" : classifyChange(oldPrice, newPrice);
      const today = new Date().toISOString().slice(0, 10);
      const cur = await supabase.from("platform_invoices").select("*").eq("subscription_id", subscription.id).eq("kind", "renewal").neq("status", "void").lte("period_start", today).gte("period_end", today).order("period_start", { ascending: false }).limit(1).maybeSingle();
      if (cur.error) throw cur.error;
      let note = "";
      if (kind === "downgrade" && cur.data) {
        // Downgrades and billing-period changes start at the next renewal; the company keeps what it paid for until then.
        const r = await supabase.from("platform_subscriptions").update({ pending_change: change }).eq("id", subscription.id);
        if (r.error) throw r.error;
        note = ` Lower package starts at renewal on ${cur.data.period_end}.`;
      } else {
        const r = await supabase.from("platform_subscriptions").update({ ...change, pending_change: null, trial_package_only: false }).eq("id", subscription.id);
        if (r.error) throw r.error;
        if (kind === "upgrade" && cur.data) {
          const pr = upgradeProration(oldPrice, newPrice, cur.data.period_start, cur.data.period_end, today);
          if (pr.amount > 0) {
            const inv = buildInvoice([{ name: `Upgrade for ${pr.days_left} of ${pr.period_days} days remaining`, price: pr.amount, billing_basis: "company" }], users, null, Number(cur.data.vat_rate));
            const due = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);
            const i = await supabase.from("platform_invoices").insert({ subscription_id: subscription.id, company_id: subscription.company_id, kind: "upgrade", period_start: today, period_end: cur.data.period_end, issue_date: today, due_date: due, status: subscription.auto_issue ? "sent" : "draft", currency: cur.data.currency, ...inv, lines: inv.lines as unknown as Json });
            if (i.error) throw i.error;
            note = ` Upgrade invoice for ${money(inv.total)} ${subscription.auto_issue ? "issued" : "created as a draft"}.`;
          }
        }
      }
      if (setup.length) { const d = await supabase.from("platform_overrides").delete().in("id", setup.map((o) => o.id)); if (d.error) throw d.error; }
      const rows = Object.entries(modes).filter(([m, v]) => v !== "package" && m !== "core").map(([module, v]) => ({ subscription_id: subscription.id, module, enabled: v === "on", starts_at: new Date().toISOString(), ends_at: PERMANENT_UNTIL, reason: SETUP_REASON }));
      if (rows.length) { const i = await supabase.from("platform_overrides").insert(rows); if (i.error) throw i.error; }
      toast.success(`Setup package saved for ${companyName}.${note}`); setOpen(false); onSaved();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not save the setup package"); } finally { setSaving(false); }
  };

  return <>
    <Button size="sm" variant="outline" onClick={start}><Settings2 className="mr-1 h-4 w-4" />Setup package</Button>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle>Setup package · {companyName}</DialogTitle></DialogHeader>
      <Label>Tier</Label>
      <NativeSelect aria-label="Tier" value={plan ?? "none"} onValueChange={(v) => setPlan(v === "none" ? null : v)}><option value="none">Full trial / custom</option>{tiers.map((t) => <option key={t.id} value={t.id} disabled={t.state !== "active" && t.id !== subscription.plan_id}>{t.name} · {money(priceFor(t, cadence))} {basisLabel(t.billing_basis)}</option>)}</NativeSelect>
      <Label>Module packs</Label>
      <div className="space-y-1">{packList.length === 0 && <p className="text-sm text-muted-foreground">No packs yet.</p>}{packList.map((p) => <label key={p.id} className="flex items-center gap-2 text-sm"><Checkbox disabled={p.state !== "active" && !packs.includes(p.id)} checked={packs.includes(p.id)} onCheckedChange={(v) => setPacks(v ? [...packs, p.id] : packs.filter((x) => x !== p.id))} />{p.name} · {money(priceFor(p, cadence))} {basisLabel(p.billing_basis)}</label>)}</div>
      <Label>Modules</Label>
      <p className="text-xs text-muted-foreground">"From package" follows the tier and packs. Force a module on or off for this company only.</p>
      <div className="space-y-2">{modules.filter((m) => m !== "core").map((m) => <div key={m} className="flex items-center justify-between gap-2 text-sm"><span>{PLAN_FEATURES.find((f) => f.key === m)?.label ?? m}<span className="ml-2 text-xs text-muted-foreground">{included.has(m) ? "in package" : "not in package"}</span></span><NativeSelect aria-label={`${m} access`} value={modes[m] ?? "package"} onValueChange={(v) => setModes({ ...modes, [m]: v as Mode })}><option value="package">From package</option><option value="on">Always on</option><option value="off">Always off</option></NativeSelect></div>)}</div>
      <div className="grid grid-cols-2 gap-2"><div><Label>Users</Label><Input type="number" min={0} value={users} onChange={(e) => setUsers(Number(e.target.value))} /></div><div><Label>Billing period</Label><NativeSelect aria-label="Billing period" value={cadence} onValueChange={setCadence}>{["monthly", "quarterly", "yearly"].map((x) => <option key={x} value={x}>{x}</option>)}</NativeSelect></div></div>
      <div className="flex flex-wrap items-end gap-2"><div className="flex-1"><Label>Agreed price / period</Label><Input type="number" min={0} value={price} onChange={(e) => setPrice(Number(e.target.value))} /></div><Button type="button" variant="outline" onClick={() => setPrice(suggested)}>Use suggested {money(suggested)}</Button></div>
      <label className="flex items-start gap-3 border-y py-3 text-sm"><Checkbox checked={immediate} onCheckedChange={v=>setImmediate(!!v)}/><span><span className="font-medium">Apply package access immediately</span><span className="block text-xs text-muted-foreground">Trial → Basic and other tier changes take effect now, without full-trial features overriding the package. Existing invoices and trial dates stay unchanged; no automatic refund or upgrade invoice.</span></span></label>
      <p className="text-xs text-muted-foreground">Otherwise upgrades apply now with a remaining-period invoice; downgrades and billing-period changes start at renewal.</p>
      <Button disabled={saving} onClick={save}>{saving ? "Saving…" : "Save setup package"}</Button>
      <DialogFooter><DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose></DialogFooter>
    </DialogContent></Dialog>
  </>;
}
