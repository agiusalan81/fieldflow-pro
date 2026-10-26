import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { rawEmail } from "@/lib/sendJobSheetEmail";

/** Emails the signed-in user their own daily works report PDF. Recipient is always the caller's own address. */
export const sendDwrEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { pdfBase64: string; filename: string; date: string }) => {
    if (typeof d.pdfBase64 !== "string" || d.pdfBase64.length > 4_000_000) throw new Error("Report too large");
    if (!/^[\w\-. ]{1,120}\.pdf$/.test(d.filename)) throw new Error("Bad file name");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d.date)) throw new Error("Bad date");
    return d;
  })
  .handler(async ({ data, context }) => {
    const { data: me } = await context.supabase.from("users").select("email, full_name, company_id").eq("id", context.userId).single();
    if (!me?.email) return { sent: false as const };
    const { resolveEmailIdentity } = await import("./email-identity.server");
    const identity = await resolveEmailIdentity(context.supabase, me.company_id);
    const lovableKey = process.env["LOVABLE_API_KEY"];
    const gmailKey = process.env["GOOGLE_MAIL_API_KEY"];
    if (!lovableKey || !gmailKey) return { sent: false as const };
    const bin = atob(data.pdfBase64);
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    const body = `Hi ${me.full_name.split(" ")[0]},\n\nAttached is your daily works report for ${data.date}.\n`;
    const res = await fetch("https://connector-gateway.lovable.dev/google_mail/gmail/v1/users/me/messages/send", {
      method: "POST",
      headers: { Authorization: `Bearer ${lovableKey}`, "X-Connection-Api-Key": gmailKey, "Content-Type": "application/json" },
      body: JSON.stringify({ raw: rawEmail([me.email], `Daily works report — ${data.date}`, body, [{ filename: data.filename, mime: "application/pdf", data: bytes }], identity) }),
    });
    if (!res.ok) { console.error(`DWR email failed [${res.status}]: ${await res.text()}`); return { sent: false as const }; }
    return { sent: true as const };
  });
