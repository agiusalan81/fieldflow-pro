import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { withInviteTimeout } from "./invite-loading";
import { inviteSendable, teamInviteDestination } from './invite-delivery';

// Public token lookup deliberately avoids browser auth/storage locks.
export const getInvitation = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ token: z.string().min(1).max(200) }).parse(input))
  .handler(async ({ data }) => {
    const url = process.env["SUPABASE_URL"];
    const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
    if (!url || !key) throw new Error("Could not check your invitation. Please try again.");
    const client = createClient<Database>(url, key, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) headers.delete("Authorization");
        headers.set("apikey", key);
        return fetch(input, { ...init, headers });
      } },
    });
    const result = await withInviteTimeout(
      (signal) => client.rpc("get_invite", { _token: data.token }).abortSignal(signal),
      8_000,
    );
    if (result.error) throw new Error("Could not check your invitation. Please try again.");
    return result.data?.[0] ?? null;
  });
const ROLE_NAMES: Record<string, string> = { technician: "Technician", supervisor: "Supervisor", admin: "Office Admin", superuser: "Company Superuser" };
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] ?? c);
const b64 = (s: string) => btoa(Array.from(new TextEncoder().encode(s), (b) => String.fromCharCode(b)).join(""));
const hdr = (v: string) => (/^[\x00-\x7F]*$/.test(v) ? v : `=?UTF-8?B?${b64(v)}?=`);

// RLS authorizes the invite; recipient and destination are derived on the server.
export const sendInviteEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ token: z.string().min(1).max(200) }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: inv, error } = await context.supabase.from("company_invites").select("email, role, full_name, expires_at, company_id, used_at").eq("token", data.token).maybeSingle();
    if (error || !inv) throw new Error("Invitation not found");
    if (!inviteSendable(inv) || !inv.email) throw new Error("This invitation needs a valid recipient and must be unused and unexpired.");
    const { data: productId, error: productIdError } = await context.supabase.rpc('company_product_id', { _company: inv.company_id });
    if (productIdError || !productId) throw new Error('Company app not found');
    const { data: product, error: productError } = await context.supabase.from('platform_products').select('name,app_url,engine_edition').eq('id', productId).single();
    if (productError || !product) throw new Error('Company app not found');
    const destination = teamInviteDestination(product, data.token);
    const { company } = await companySender(context.supabase, inv.company_id);
    const { resolveEmailIdentity } = await import("./email-identity.server");
    const identity = await resolveEmailIdentity(context.supabase, inv.company_id);
    const role = ROLE_NAMES[inv.role] ?? inv.role;
    const expires = new Date(inv.expires_at).toLocaleDateString("en-GB");
    const { sendTemplateEmail } = await import('./email-templates/send-email');
    try {
      const result = await sendTemplateEmail('team-invite', inv.email, {
        identity, idempotencyKey: `team-invite-${data.token}`,
        templateData: { company, ...destination, name: inv.full_name ?? '', role, expires },
      });
      return { ...result, to: inv.email };
    } catch (error) {
      const { EmailAPIError } = await import('@lovable.dev/email-js');
      if (error instanceof EmailAPIError && error.status === 429) throw new Error(`Email sending is busy. Retry in ${error.retryAfterSeconds ?? 60} seconds, or copy the invitation link.`);
      console.error('Team invitation delivery failed', error instanceof EmailAPIError ? error.code : 'send_failed');
      throw new Error('The invitation was created, but its email could not be sent. Retry or copy the link.');
    }
  });

type Sb = { from: (t: "companies" | "company_settings") => any };
async function companySender(sb: Sb, companyId: string) {
  const [{ data: co }, { data: st }] = await Promise.all([
    sb.from("companies").select("name").eq("id", companyId).maybeSingle(),
    sb.from("company_settings").select("company_email").eq("company_id", companyId).maybeSingle(),
  ]);
  const email = String(st?.company_email ?? "").trim();
  return { company: (co?.name as string) || "Your company", replyTo: /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email) ? email : "" };
}

async function sendMail(m: { to: string; subject: string; text: string; html: string; fromName: string; replyTo: string }, failMsg: string) {
  const boundary = `b_${crypto.randomUUID()}`;
  // The connected mailbox controls From. Only a verified reply address is added here.
  const raw = [`To: ${m.to}`, ...(m.replyTo ? [`Reply-To: ${m.replyTo}`] : []), `Subject: ${hdr(m.subject)}`, "MIME-Version: 1.0", `Content-Type: multipart/alternative; boundary="${boundary}"`, "",
    `--${boundary}`, 'Content-Type: text/plain; charset="UTF-8"', "Content-Transfer-Encoding: base64", "", b64(m.text),
    `--${boundary}`, 'Content-Type: text/html; charset="UTF-8"', "Content-Transfer-Encoding: base64", "", b64(m.html), `--${boundary}--`].join("\r\n");
  const lovableKey = process.env["LOVABLE_API_KEY"]; const gmailKey = process.env["GOOGLE_MAIL_API_KEY"];
  if (!lovableKey || !gmailKey) throw new Error("Email delivery is not configured yet");
  const res = await fetch("https://connector-gateway.lovable.dev/google_mail/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: { Authorization: `Bearer ${lovableKey}`, "X-Connection-Api-Key": gmailKey, "Content-Type": "application/json" },
    body: JSON.stringify({ raw: b64(raw).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "") }),
  });
  if (!res.ok) { console.error(`Email failed [${res.status}]: ${await res.text()}`); throw new Error(failMsg); }
}

// Sends a delivery check to the signed-in user's own address.
export const sendTestEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ companyId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const to = (context.claims as { email?: string }).email;
    if (!to) throw new Error("Your account has no email address");
    const { data: ok } = await context.supabase.from("company_settings").select("company_id").eq("company_id", data.companyId).maybeSingle();
    if (!ok) throw new Error("Company not found");
    const { company } = await companySender(context.supabase, data.companyId);
    const { resolveEmailIdentity } = await import("./email-identity.server");
    const identity = await resolveEmailIdentity(context.supabase, data.companyId); const replyTo = identity.replyTo ?? "";
    const text = `This is a test from FieldBridge.\n\nEmail delivery for ${company} is working. Replies from clients go to ${replyTo || "your company email (not set yet — add it in Company info)"}.`;
    const html = `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;color:#1b2a3d"><h2>Email delivery is working ✅</h2><p>This is a test from FieldBridge for <b>${esc(company)}</b>.</p><p>Client replies go to <b>${esc(replyTo || "your company email (not set yet)")}</b>.</p></div>`;
    await sendMail({ to, subject: `FieldBridge test email for ${company}`, text, html, fromName: identity.name, replyTo }, "The test email could not be sent. Please try again.");
    return { to };
  });
