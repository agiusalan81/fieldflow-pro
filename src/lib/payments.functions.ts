import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isPayable, toMinorUnits } from "@/lib/saas-billing";
import { createStripeClient, getStripeErrorMessage, type StripeEnv } from "@/lib/stripe.server";

/** Embedded checkout for one issued FieldBridge invoice. Only the company's superuser can read (and so pay) its invoices. */
export const createInvoiceCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { invoiceId: string; returnUrl: string; environment: StripeEnv }) => {
    if (!/^[0-9a-f-]{36}$/i.test(d.invoiceId)) throw new Error("Invalid invoice");
    if (d.environment !== "sandbox" && d.environment !== "live") throw new Error("Invalid environment");
    if (!/^https?:\/\//.test(d.returnUrl)) throw new Error("Invalid return URL");
    return d;
  })
  .handler(async ({ data, context }): Promise<{ clientSecret: string } | { error: string }> => {
    const { data: inv, error } = await context.supabase.from("platform_invoices").select("*").eq("id", data.invoiceId).maybeSingle();
    if (error || !inv) return { error: "Invoice not found" };
    if (!isPayable(inv)) return { error: "This invoice is not awaiting payment" };
    const { data: isSuper } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "superuser" });
    if (!isSuper) return { error: "Only the Company Superuser can pay invoices" };
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { customerRef, parseCustomerRef } = await import("@/lib/saas-billing.server");
      const { data: sub } = await supabaseAdmin.from("platform_subscriptions").select("id, company_id, stripe_customer_id").eq("id", inv.subscription_id).single();
      if (!sub) return { error: "Subscription not found" };
      const stripe = createStripeClient(data.environment);
      let customer = parseCustomerRef(sub.stripe_customer_id, data.environment);
      if (!customer) {
        const { data: { user } } = await context.supabase.auth.getUser();
        const found = await stripe.customers.search({ query: `metadata['companyId']:'${sub.company_id}'`, limit: 1 });
        customer = found.data[0]?.id ?? (await stripe.customers.create({ email: user?.email ?? undefined, metadata: { companyId: sub.company_id ?? "", userId: context.userId } })).id;
        await supabaseAdmin.from("platform_subscriptions").update({ stripe_customer_id: customerRef(data.environment, customer) }).eq("id", sub.id);
      }
      const description = `FieldBridge invoice ${inv.invoice_number}`;
      const session = await stripe.checkout.sessions.create({
        mode: "payment", ui_mode: "embedded_page", return_url: data.returnUrl, customer,
        line_items: [{ quantity: 1, price_data: { currency: inv.currency.toLowerCase(), unit_amount: toMinorUnits(Number(inv.total)), product_data: { name: description, description: `${inv.period_start} to ${inv.period_end} (VAT included)` } } }],
        // Saves the card so HQ can switch on automatic charging later.
        payment_intent_data: { description, setup_future_usage: "off_session", metadata: { invoice_id: inv.id } },
        metadata: { invoice_id: inv.id, companyId: sub.company_id ?? "" },
      });
      await supabaseAdmin.from("platform_invoices").update({ stripe_session_id: session.id }).eq("id", inv.id);
      return { clientSecret: session.client_secret ?? "" };
    } catch (e) {
      return { error: getStripeErrorMessage(e) };
    }
  });
