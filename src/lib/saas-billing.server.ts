// Server-only FieldBridge billing engine: settles payments, prepares renewals, charges saved cards, sends reminders.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/integrations/supabase/types";
import { billingPeriod, buildInvoice, isPayable, paymentMatches, REMINDER_LABELS, reminderStage, renewalDue, toMinorUnits, isLapsed } from "@/lib/saas-billing";
import { createStripeClient, getStripeErrorMessage, type StripeEnv } from "@/lib/stripe.server";

type Admin = SupabaseClient<Database>;
type Catalog = Database["public"]["Tables"]["platform_catalog"]["Row"];
type Sub = Database["public"]["Tables"]["platform_subscriptions"]["Row"];
type Invoice = Database["public"]["Tables"]["platform_invoices"]["Row"];

const iso = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (d: string, n: number) => iso(new Date(new Date(`${d}T00:00:00Z`).getTime() + n * 86400000));
export const PAYMENT_TERMS_DAYS = 14;
const priceFor = (c: Catalog, cadence: string) => Number(cadence === "yearly" ? c.yearly_price : cadence === "quarterly" ? c.quarterly_price : c.monthly_price);

/** Saved provider customers are tagged with their environment so test customers are never used live. */
export const customerRef = (env: StripeEnv, id: string) => `${env}:${id}`;
export function parseCustomerRef(ref: string | null | undefined, env: StripeEnv) {
  if (!ref) return null; const [e, id] = ref.split(":"); return e === env && id ? id : null;
}

/** Marks an invoice paid only when the provider confirms the exact amount and currency. Idempotent. */
export async function settleInvoice(admin: Admin, o: { invoiceId: string; amountMinor: number | null; currency: string | null; paymentIntent: string | null }) {
  const { data: inv } = await admin.from("platform_invoices").select("*").eq("id", o.invoiceId).maybeSingle();
  if (!inv || inv.status === "paid") return;
  if (!paymentMatches(inv, o.amountMinor, o.currency)) {
    await admin.from("platform_invoices").update({ payment_error: `Payment amount did not match invoice (${o.amountMinor ?? 0} ${o.currency ?? ""})` }).eq("id", inv.id);
    return;
  }
  const r = await admin.from("platform_invoices").update({ status: "paid", collection: "auto", payment_ref: o.paymentIntent, stripe_payment_intent: o.paymentIntent, payment_error: null }).eq("id", inv.id);
  if (r.error) throw new Error(r.error.message);
}

function packageItems(sub: Sub, catalog: Catalog[]) {
  return catalog.filter((c) => c.id === sub.plan_id || (sub.pack_ids ?? []).includes(c.id)).map((c) => ({ name: c.name, price: priceFor(c, sub.cadence), billing_basis: c.billing_basis }));
}

async function recipients(admin: Admin, companyId: string) {
  const { data: roles } = await admin.from("user_roles").select("user_id").eq("company_id", companyId).eq("role", "superuser").is("terminated_at", null);
  const ids = (roles ?? []).map((r) => r.user_id);
  if (!ids.length) return [];
  const { data: users } = await admin.from("users").select("email").in("id", ids);
  return (users ?? []).map((u) => u.email).filter(Boolean);
}

async function chargeSavedCard(admin: Admin, env: StripeEnv, sub: Sub, inv: Invoice) {
  const customer = parseCustomerRef(sub.stripe_customer_id, env);
  if (!customer) return;
  try {
    const stripe = createStripeClient(env);
    const c = await stripe.customers.retrieve(customer);
    const pm = !("deleted" in c && c.deleted) ? (c.invoice_settings?.default_payment_method as string | null) : null;
    if (!pm) { await admin.from("platform_invoices").update({ payment_error: "No saved card — pay online or by bank transfer" }).eq("id", inv.id); return; }
    const pi = await stripe.paymentIntents.create({
      amount: toMinorUnits(Number(inv.total)), currency: inv.currency.toLowerCase(), customer, payment_method: pm, off_session: true, confirm: true,
      description: `FieldBridge invoice ${inv.invoice_number}`, metadata: { invoice_id: inv.id },
    }, { idempotencyKey: `invoice-charge-${inv.id}` });
    await admin.from("platform_invoices").update({ stripe_payment_intent: pi.id }).eq("id", inv.id);
    if (pi.status === "succeeded") await settleInvoice(admin, { invoiceId: inv.id, amountMinor: pi.amount_received, currency: pi.currency, paymentIntent: pi.id });
  } catch (e) {
    await admin.from("platform_invoices").update({ payment_error: getStripeErrorMessage(e) }).eq("id", inv.id);
  }
}

/** Daily run. Prepares renewals 7 days ahead (draft, or issued when auto-issue is on), marks overdue, charges saved cards and emails reminders. */
export async function runDailyBilling(admin: Admin, env: StripeEnv, appUrl: string, today = iso(new Date())) {
  const summary = { renewals: 0, issued: 0, overdue: 0, charged: 0, reminders: 0, errors: [] as string[] };
  const [{ data: subs }, { data: catalog }, { data: invoices }, { data: reminders }] = await Promise.all([
    admin.from("platform_subscriptions").select("*").eq("status", "active").not("company_id", "is", null),
    admin.from("platform_catalog").select("*"),
    admin.from("platform_invoices").select("*"),
    admin.from("platform_invoice_reminders").select("invoice_id, stage"),
  ]);
  const { data: companies } = await admin.from("companies").select("id, name");
  const name = (id: string | null) => companies?.find((c) => c.id === id)?.name ?? "your company";

  for (const s0 of subs ?? []) {
    let sub = s0;
    try {
      const own = (invoices ?? []).filter((i) => i.subscription_id === sub.id);
      const last = own.filter((i) => i.kind === "renewal" && i.status !== "void").sort((a, b) => b.period_start.localeCompare(a.period_start))[0];
      if (last && renewalDue(last.period_end, today)) {
        const next = billingPeriod(last.period_end, "monthly").period_start === last.period_end ? addDays(last.period_end, 1) : addDays(last.period_end, 1);
        if (!own.some((i) => i.kind === "renewal" && i.period_start === next)) {
          if (sub.pending_change && typeof sub.pending_change === "object") {
            const p = sub.pending_change as Partial<Sub>;
            const u = await admin.from("platform_subscriptions").update({ plan_id: p.plan_id ?? sub.plan_id, pack_ids: p.pack_ids ?? sub.pack_ids, seats: p.seats ?? sub.seats, cadence: p.cadence ?? sub.cadence, agreed_price: p.agreed_price ?? sub.agreed_price, pending_change: null }).eq("id", sub.id).select("*").single();
            if (u.error) throw new Error(u.error.message);
            sub = u.data;
          }
          const period = billingPeriod(next, sub.cadence);
          const inv = buildInvoice(packageItems(sub, catalog ?? []), sub.seats, Number(sub.agreed_price) > 0 ? Number(sub.agreed_price) : null, Number(last.vat_rate));
          const ins = await admin.from("platform_invoices").insert({ subscription_id: sub.id, company_id: sub.company_id, kind: "renewal", period_start: period.period_start, period_end: period.period_end, issue_date: today, due_date: addDays(today, PAYMENT_TERMS_DAYS), status: sub.auto_issue ? "sent" : "draft", currency: last.currency, ...inv, lines: inv.lines as unknown as Json }).select("*").single();
          if (ins.error) throw new Error(ins.error.message);
          own.push(ins.data); (invoices ?? []).push(ins.data); summary.renewals++; if (sub.auto_issue) summary.issued++;
        }
      }
      for (const inv of own) {
        if (inv.status === "sent" && inv.due_date < today) { await admin.from("platform_invoices").update({ status: "overdue" }).eq("id", inv.id); inv.status = "overdue"; summary.overdue++; }
        if (sub.auto_charge && isPayable(inv) && !inv.stripe_payment_intent && !inv.payment_error) { await chargeSavedCard(admin, env, sub, inv); summary.charged++; }
        const stage = reminderStage(inv, today);
        if (!stage || (reminders ?? []).some((r) => r.invoice_id === inv.id && r.stage === stage)) continue;
        const { data: fresh } = await admin.from("platform_invoices").select("status").eq("id", inv.id).single();
        if (fresh?.status === "paid") continue;
        const rec = await admin.from("platform_invoice_reminders").insert({ invoice_id: inv.id, stage });
        if (rec.error) continue; // already sent by another run
        const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
        const money = new Intl.NumberFormat("en-GB", { style: "currency", currency: inv.currency }).format(Number(inv.total));
        for (const to of await recipients(admin, sub.company_id!)) {
          await sendTemplateEmail("invoice-reminder", to, { idempotencyKey: `inv-${inv.id}-${stage}-${to}`, templateData: { companyName: name(sub.company_id), invoiceNumber: inv.invoice_number, stage: REMINDER_LABELS[stage], total: money, dueDate: inv.due_date, payUrl: `${appUrl}/subscription`, readOnly: isLapsed(inv, today) } });
        }
        summary.reminders++;
      }
    } catch (e) { summary.errors.push(`${sub.id}: ${e instanceof Error ? e.message : String(e)}`); }
  }
  return summary;
}
