import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
const tenantSchema = z.object({ id: z.string(), company_id: z.string().nullable(), name: z.string().nullable(), status: z.string(), created_at: z.string(), trial_ends_at: z.string(), first_sign_in: z.string().nullable(), last_seen: z.string().nullable(), work_count: z.number(), active_days: z.number(), contact_email: z.string(), is_test: z.boolean() });
export type AnalyticsTenant = z.infer<typeof tenantSchema>;
export const analyticsOverview = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator(z.object({ productId: z.string().uuid(), days: z.union([z.literal(7), z.literal(30), z.literal(90)]) }))
  .handler(async ({ context, data }) => {
    const summary = await context.supabase.rpc("platform_analytics_summary", { _product: data.productId, _days: data.days });
    if (summary.error) throw new Error(summary.error.message);
    const parsed = z.object({ tenants: z.array(tenantSchema), daily: z.array(z.object({ day: z.string(), feature: z.string(), tenants: z.number(), events: z.number() })) }).parse(summary.data);
    const [templates, actions, feedback, legal] = await Promise.all([
      context.supabase.from("platform_outreach_templates").select("*").eq("product_id", data.productId),
      context.supabase.from("platform_engagement_actions").select("*").in("subscription_id", parsed.tenants.map(t => t.id)).order("created_at", { ascending: false }).limit(100),
      context.supabase.from("platform_feedback").select("*").in("subscription_id", parsed.tenants.map(t => t.id)).order("created_at", { ascending: false }).limit(100),
      context.supabase.from("platform_legal_profiles").select("support_email").eq("product_id", data.productId).maybeSingle(),
    ]);
    const error = [templates, actions, feedback, legal].find(r => r.error)?.error;
    if (error) throw new Error(error.message);
    return { ...parsed, templates: templates.data ?? [], actions: actions.data ?? [], feedback: feedback.data ?? [], supportEmail: legal.data?.support_email ?? "" };
  });