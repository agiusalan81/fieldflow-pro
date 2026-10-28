import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// HQ owner-only: signs into a TEST company through a dedicated test Superuser account.
// Production companies are refused; the owner's own membership is never changed.
export const openTestCompany = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ companyId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: owner } = await context.supabase.rpc("is_platform_owner");
    if (owner !== true) throw new Error("Platform-owner access required");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: co } = await supabaseAdmin.from("companies").select("id,name").eq("id", data.companyId).maybeSingle();
    if (!co) throw new Error("Company not found");
    const { data: ctl } = await supabaseAdmin.from("platform_company_controls").select("is_test").eq("company_id", co.id).maybeSingle();
    if (!ctl?.is_test) throw new Error("Only test companies can be opened from HQ");
    if (co.id === (await context.supabase.rpc("current_company_id")).data) throw new Error("You are already signed into this company");
    // Reuse the test company's existing active Superuser when one exists; otherwise create a dedicated one.
    const { data: su } = await supabaseAdmin.from("user_roles").select("user_id").eq("company_id", co.id).eq("role", "superuser").eq("registration_status", "active").limit(1).maybeSingle();
    let email = `hq-test+${co.id.slice(0, 8)}@fieldbridgeapp.com`;
    if (su) {
      const { data: u } = await supabaseAdmin.auth.admin.getUserById(su.user_id);
      if (!u.user?.email) throw new Error("The test Superuser has no email");
      email = u.user.email;
    } else {
      const { data: inv, error } = await context.supabase.rpc("platform_initial_superuser_invite", { _company: co.id, _name: `HQ Test · ${co.name}` });
      if (error) throw new Error(error.message);
      const token = (inv as { token?: string } | null)?.token;
      if (!token) throw new Error("Could not prepare the test account");
      const created = await supabaseAdmin.auth.admin.createUser({ email, email_confirm: true, user_metadata: { invite_token: token, full_name: `HQ Test · ${co.name}` } });
      if (created.error) throw new Error(created.error.message);
    }
    const link = await supabaseAdmin.auth.admin.generateLink({ type: "magiclink", email });
    if (link.error || !link.data.properties?.hashed_token) throw new Error(link.error?.message ?? "Could not open the test company");
    await supabaseAdmin.from("platform_audit").insert({ actor_id: context.userId, entity: "company_setup", entity_id: co.id, action: "SWITCH_TEST", after_value: { email } });
    return { tokenHash: link.data.properties.hashed_token, name: co.name };
  });
