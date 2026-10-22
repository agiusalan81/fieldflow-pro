import { useCallback } from "react";
import { EmbeddedCheckout, EmbeddedCheckoutProvider } from "@stripe/react-stripe-js";
import { getStripe, getStripeEnvironment } from "@/lib/stripe";
import { createInvoiceCheckout } from "@/lib/payments.functions";

/** Card payment form for one invoice. Mounted once per open dialog so the session never changes underneath it. */
export function InvoiceCheckout({ invoiceId }: { invoiceId: string }) {
  const fetchClientSecret = useCallback(async () => {
    const r = await createInvoiceCheckout({ data: { invoiceId, environment: getStripeEnvironment(), returnUrl: `${window.location.origin}/subscription?paid=${invoiceId}` } });
    if ("error" in r) throw new Error(r.error);
    if (!r.clientSecret) throw new Error("The payment form could not be started");
    return r.clientSecret;
  }, [invoiceId]);
  return <div id="checkout"><EmbeddedCheckoutProvider stripe={getStripe()} options={{ fetchClientSecret }}><EmbeddedCheckout /></EmbeddedCheckoutProvider></div>;
}
