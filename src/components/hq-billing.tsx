import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Database, Json } from "@/integrations/supabase/types";
import { billingPeriod, buildInvoice, isOverdue, reminderStage, REMINDER_LABELS, storageLevel, type InvoiceLine } from "@/lib/saas-billing";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";

type Sub = Database["public"]["Tables"]["platform_subscriptions"]["Row"];
type Catalog = Database["public"]["Tables"]["platform_catalog"]["Row"];
type Invoice = Database["public"]["Tables"]["platform_invoices"]["Row"];
const today = () => new Date().toISOString().slice(0, 10);
const priceFor = (c: Catalog, cadence: string) => Number(cadence === "yearly" ? c.yearly_price : cadence === "quarterly" ? c.quarterly_price : c.monthly_price);
const addDays = (d: string, n: number) => new Date(new Date(`${d}T00:00:00Z`).getTime() + n * 86400000).toISOString().slice(0, 10);

export function HQBilling({ subscriptions, catalog, companyName, money }: { subscriptions: Sub[]; catalog: Catalog[]; companyName: (s: Sub) => string; money: (v: number) => string }) {
  const qc = useQueryClient();
  const [pay, setPay] = useState<Invoice | null>(null); const [ref, setRef] = useState("");
  const [vat, setVat] = useState(18); const [terms, setTerms] = useState(14);
  const { data, error } = useQuery({ queryKey: ["hq-invoices"], queryFn: async () => {
    const [i, r] = await Promise.all([supabase.from("platform_invoices").select("*").order("issue_date", { ascending: false }), supabase.from("platform_invoice_reminders").select("*")]);
    if (i.error || r.error) throw i.error || r.error;
    const storage = await Promise.all(subscriptions.filter((s) => s.company_id).map(async (s) => { const u = await supabase.rpc("company_storage_usage", { _company: s.company_id! }); return [s.id, u.data as { used_bytes: number; allowance_gb: number } | null] as const; }));
    return { invoices: i.data, reminders: r.data, storage: Object.fromEntries(storage) };
  } });
  const refresh = () => qc.invalidateQueries({ queryKey: ["hq-invoices"] });
  const run = async (p: PromiseLike<{ error: { message: string } | null }>, ok: string) => { const r = await p; if (r.error) toast.error(r.error.message); else { toast.success(ok); void refresh(); } };

  const generate = (s: Sub) => {
    const last = data?.invoices.filter((x) => x.subscription_id === s.id && x.kind === "renewal" && x.status !== "void").sort((a, b) => b.period_start.localeCompare(a.period_start))[0];
    const start = last ? billingPeriod(last.period_start, s.cadence).next_start : today();
    const period = billingPeriod(start, s.cadence);
    const items = catalog.filter((c) => c.id === s.plan_id || (s.pack_ids ?? []).includes(c.id)).map((c) => ({ name: c.name, price: priceFor(c, s.cadence), billing_basis: c.billing_basis }));
    const inv = buildInvoice(items, s.seats, Number(s.agreed_price) > 0 ? Number(s.agreed_price) : null, vat);
    void run(supabase.from("platform_invoices").insert({ subscription_id: s.id, company_id: s.company_id, period_start: period.period_start, period_end: period.period_end, due_date: addDays(today(), terms), ...inv, lines: inv.lines as unknown as Json }), `Draft invoice created for ${companyName(s)}`);
  };
  const remind = (i: Invoice) => { const st = reminderStage(i, today()) ?? "issued"; void run(supabase.from("platform_invoice_reminders").insert({ invoice_id: i.id, stage: st }), `Reminder recorded: ${REMINDER_LABELS[st]}`); };

  if (error) return <p className="text-destructive">{error.message}</p>;
  const invoices = data?.invoices ?? [];
  const due = invoices.filter((i) => { const st = reminderStage(i, today()); return st && !data?.reminders.some((r) => r.invoice_id === i.id && r.stage === st); });
  return <div className="space-y-6">
    <section className="space-y-2"><h3 className="font-semibold">Create invoices</h3>
      <div className="flex flex-wrap gap-3"><div><Label>VAT %</Label><Input className="w-24" type="number" min={0} value={vat} onChange={(e) => setVat(Number(e.target.value))} /></div><div><Label>Payment terms (days)</Label><Input className="w-24" type="number" min={0} value={terms} onChange={(e) => setTerms(Number(e.target.value))} /></div></div>
      <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b"><th className="py-2">Company</th><th>Package</th><th>Storage</th><th>Automation</th><th /></tr></thead><tbody>{subscriptions.map((s) => { const u = data?.storage[s.id]; const lv = u ? storageLevel(Number(u.used_bytes), u.allowance_gb) : null; return <tr key={s.id} className="border-b"><td className="py-2">{companyName(s)}</td><td>{money(Number(s.agreed_price))} / {s.cadence} · {s.seats} users</td><td className={lv && lv.level !== "ok" ? "text-destructive" : ""}>{u ? `${(Number(u.used_bytes) / 1024 ** 3).toFixed(2)} of ${u.allowance_gb} GB (${lv!.pct}%)` : "—"}</td><td><div className="space-y-1 text-xs"><label className="flex items-center gap-2"><Switch checked={s.auto_issue} onCheckedChange={(v) => void run(supabase.from("platform_subscriptions").update({ auto_issue: v }).eq("id", s.id), v ? "Renewals will be issued automatically" : "Renewals will wait as drafts for your approval")} aria-label="Auto-issue renewals" />Auto-issue renewals</label><label className="flex items-center gap-2"><Switch checked={s.auto_charge} disabled={!s.stripe_customer_id} onCheckedChange={(v) => void run(supabase.from("platform_subscriptions").update({ auto_charge: v }).eq("id", s.id), v ? "Saved card will be charged for issued invoices" : "Automatic card charging off")} aria-label="Charge saved card" />Charge saved card{!s.stripe_customer_id && " (no card yet)"}</label>{s.pending_change && <p className="text-muted-foreground">Downgrade scheduled for next renewal <button type="button" className="underline" onClick={() => void run(supabase.from("platform_subscriptions").update({ pending_change: null }).eq("id", s.id), "Scheduled downgrade cancelled")}>Cancel</button></p>}</div></td><td><Button size="sm" variant="outline" disabled={s.status === "legacy"} onClick={() => generate(s)}>Create next invoice</Button></td></tr>; })}</tbody></table></div>
    </section>
    <section className="space-y-2"><h3 className="font-semibold">Reminders due today ({due.length})</h3>
      {due.length === 0 && <p className="text-sm text-muted-foreground">Nothing to chase today.</p>}
      {due.map((i) => <div key={i.id} className="flex items-center justify-between gap-2 border-b py-2 text-sm"><span>{i.invoice_number} · {companyName(subscriptions.find((s) => s.id === i.subscription_id)!)} · {REMINDER_LABELS[reminderStage(i, today())!]}</span><Button size="sm" variant="outline" onClick={() => remind(i)}>Mark reminder sent</Button></div>)}
    </section>
    <section className="space-y-2"><h3 className="font-semibold">Invoices</h3>
      <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b"><th className="py-2">No.</th><th>Company</th><th>Period</th><th>Total</th><th>Due</th><th>Status</th><th /></tr></thead><tbody>{invoices.map((i) => { const s = subscriptions.find((x) => x.id === i.subscription_id); const late = isOverdue(i, today()); return <tr key={i.id} className="border-b"><td className="py-2">{i.invoice_number}{i.kind === "upgrade" && <span className="ml-1 text-xs text-muted-foreground">upgrade</span>}</td><td>{s ? companyName(s) : "—"}</td><td>{i.period_start} → {i.period_end}</td><td title={(i.lines as unknown as InvoiceLine[]).map((l) => `${l.label} × ${l.quantity}`).join(", ")}>{money(Number(i.total))}</td><td>{i.due_date}</td><td className={late ? "text-destructive" : ""}>{late && i.status === "sent" ? "overdue" : i.status}{i.status === "paid" && i.collection === "auto" && <span className="block text-xs text-muted-foreground">online</span>}{i.payment_error && i.status !== "paid" && <span className="block text-xs text-destructive">{i.payment_error}</span>}</td><td><div className="flex flex-wrap gap-1">
        {i.status === "draft" && <><Button size="sm" onClick={() => void run(supabase.from("platform_invoices").update({ status: "sent", issue_date: today() }).eq("id", i.id), "Invoice issued — amounts are now frozen")}>Issue</Button><Button size="sm" variant="outline" onClick={() => void run(supabase.from("platform_invoices").delete().eq("id", i.id), "Draft deleted")}>Delete</Button></>}
        {(i.status === "sent" || i.status === "overdue" || i.status === "suspended") && <><Button size="sm" onClick={() => { setPay(i); setRef(""); }}>Mark paid</Button>{late && i.status === "sent" && <Button size="sm" variant="outline" onClick={() => void run(supabase.from("platform_invoices").update({ status: "overdue" }).eq("id", i.id), "Marked overdue")}>Mark overdue</Button>}<Button size="sm" variant="outline" onClick={() => void run(supabase.from("platform_invoices").update({ status: "void" }).eq("id", i.id), "Invoice voided")}>Void</Button></>}
      </div></td></tr>; })}</tbody></table></div>
      <p className="text-xs text-muted-foreground">Issued invoices keep their lines and totals even if prices change later. Companies more than 14 days overdue become read-only (records and exports stay available) until paid. Renewals are prepared 7 days before each period ends, and reminder emails go out automatically each morning.</p>
    </section>
    <Dialog open={!!pay} onOpenChange={(o) => !o && setPay(null)}><DialogContent><DialogHeader><DialogTitle>Record payment · {pay?.invoice_number}</DialogTitle></DialogHeader><Label>Payment reference</Label><Input value={ref} onChange={(e) => setRef(e.target.value)} placeholder="Bank transfer ref, card receipt…" /><Button disabled={!ref.trim()} onClick={() => { if (pay) void run(supabase.from("platform_invoices").update({ status: "paid", payment_ref: ref.trim(), collection: "manual" }).eq("id", pay.id), "Payment recorded"); setPay(null); }}>Save payment</Button><DialogFooter><DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose></DialogFooter></DialogContent></Dialog>
  </div>;
}
