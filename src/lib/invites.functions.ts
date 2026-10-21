import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { withInviteTimeout } from "./invite-loading";

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
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
const b64 = (s: string) => btoa(Array.from(new TextEncoder().encode(s), (b) => String.fromCharCode(b)).join(""));
const hdr = (v: string) => (/^[\x00-\x7F]*$/.test(v) ? v : `=?UTF-8?B?${b64(v)}?=`);

// Sends a team invitation from the connected company mailbox. RLS limits the caller to their own company's invites.
export const sendInviteEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ token: z.string().min(1).max(200), link: z.string().url().max(500) }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: inv, error } = await context.supabase.from("company_invites").select("email, role, full_name, expires_at, company_id, used_at").eq("token", data.token).maybeSingle();
    if (error || !inv || inv.used_at) throw new Error("Invitation not found");
    if (!inv.email) throw new Error("This invitation has no recipient email");
    if (!new URL(data.link).pathname.endsWith(`/join/${data.token}`)) throw new Error("Invalid invitation link");
    const { company, replyTo } = await companySender(context.supabase, inv.company_id);
    const role = ROLE_NAMES[inv.role] ?? inv.role;
    const expires = new Date(inv.expires_at).toLocaleDateString("en-GB");
    const greet = inv.full_name ? `Hi ${inv.full_name},` : "Hello,";
    const subject = `${company} invited you to join FieldBridge`;
    const text = `${greet}\n\n${company} has invited you to join their team on FieldBridge as ${role}.\n\nRegister using this email address (${inv.email}) with Google, Microsoft or email sign-in:\n${data.link}\n\nThis link works once and expires on ${expires}.`;
    const html = `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;color:#1b2a3d"><h2 style="color:#1b2a3d">Join ${esc(company)} on FieldBridge</h2><p>${esc(greet)}</p><p>${esc(company)} has invited you to join their team as <b>${esc(role)}</b>.</p><p>Register using <b>${esc(inv.email)}</b>.</p><p style="margin:28px 0"><a href="${esc(data.link)}" style="background:#d97706;color:#ffffff;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:bold">Accept invitation &amp; join</a></p><p style="font-size:13px;color:#5b6b7f">This link works once and expires on ${esc(expires)}.<br>${esc(data.link)}</p></div>`;
    await sendMail({ to: inv.email, subject, text, html, fromName: company, replyTo }, "The invitation email could not be sent. Copy the link instead.");
    return { sent: true, to: inv.email };
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
    const { company, replyTo } = await companySender(context.supabase, data.companyId);
    const text = `This is a test from FieldBridge.\n\nEmail delivery for ${company} is working. Replies from clients go to ${replyTo || "your company email (not set yet — add it in Company info)"}.`;
    const html = `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;color:#1b2a3d"><h2>Email delivery is working ✅</h2><p>This is a test from FieldBridge for <b>${esc(company)}</b>.</p><p>Client replies go to <b>${esc(replyTo || "your company email (not set yet)")}</b>.</p></div>`;
    await sendMail({ to, subject: `FieldBridge test email for ${company}`, text, html, fromName: company, replyTo }, "The test email could not be sent. Please try again.");
    return { to };
  });
