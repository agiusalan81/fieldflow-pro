import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

export const Route = createFileRoute("/api/public/jobs/billing-daily")({ staticData: { sitemap: false },
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authFailure = await authenticateCronRequest(request);
        if (authFailure) return authFailure;
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { runDailyBilling } = await import("@/lib/saas-billing.server");
        // One shared database: charge live once live payments exist, otherwise test.
        const env = process.env["STRIPE_LIVE_API_KEY"] ? "live" : "sandbox";
        const summary = await runDailyBilling(supabaseAdmin, env, "https://fieldbridgeapp.com");
        return Response.json({ success: true, ...summary, errors: summary.errors.length });
      },
    },
  },
});
