import { createFileRoute } from "@tanstack/react-router";
import { type StripeEnv, verifyWebhook, createStripeClient } from "@/lib/stripe.server";

async function handle(event: { id: string; type: string; data: { object: any } }, env: StripeEnv) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { settleInvoice } = await import("@/lib/saas-billing.server");
  const seen = await supabaseAdmin.from("platform_payment_events").select("event_id").eq("event_id", event.id).maybeSingle();
  if (seen.data) return;
  const o = event.data.object;
  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded": {
      const invoiceId = o.metadata?.invoice_id;
      if (!invoiceId || o.payment_status === "unpaid") break;
      const pi = typeof o.payment_intent === "string" ? o.payment_intent : o.payment_intent?.id ?? null;
      await settleInvoice(supabaseAdmin, { invoiceId, amountMinor: o.amount_total, currency: o.currency, paymentIntent: pi });
      if (pi && o.customer) {
        // Keep the card on file as the default for automatic charging.
        const stripe = createStripeClient(env);
        const intent = await stripe.paymentIntents.retrieve(pi);
        const pm = typeof intent.payment_method === "string" ? intent.payment_method : intent.payment_method?.id;
        if (pm) await stripe.customers.update(o.customer, { invoice_settings: { default_payment_method: pm } });
      }
      break;
    }
    case "checkout.session.async_payment_failed":
      if (o.metadata?.invoice_id) await supabaseAdmin.from("platform_invoices").update({ payment_error: "Bank payment failed" }).eq("id", o.metadata.invoice_id).neq("status", "paid");
      break;
    case "payment_intent.succeeded":
      if (o.metadata?.invoice_id) await settleInvoice(supabaseAdmin, { invoiceId: o.metadata.invoice_id, amountMinor: o.amount_received, currency: o.currency, paymentIntent: o.id });
      break;
    case "payment_intent.payment_failed":
      if (o.metadata?.invoice_id) await supabaseAdmin.from("platform_invoices").update({ payment_error: o.last_payment_error?.message ?? "Card payment failed" }).eq("id", o.metadata.invoice_id).neq("status", "paid");
      break;
    default:
      console.log("Unhandled payment event:", event.type);
  }
  await supabaseAdmin.from("platform_payment_events").insert({ event_id: event.id, event_type: event.type });
}

export const Route = createFileRoute("/api/public/payments/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rawEnv = new URL(request.url).searchParams.get("env");
        if (rawEnv !== "sandbox" && rawEnv !== "live") return Response.json({ received: true, ignored: "invalid env" });
        try {
          const event = await verifyWebhook(request, rawEnv);
          await handle(event, rawEnv);
          return Response.json({ received: true });
        } catch (e) {
          console.error("Payment webhook error:", e);
          return new Response("Webhook error", { status: 400 });
        }
      },
    },
  },
});
