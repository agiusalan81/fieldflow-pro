import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const b64 = (s: string) =>
  btoa(Array.from(new TextEncoder().encode(s), (b) => String.fromCharCode(b)).join(""));
const header = (v: string) => (/^[\x00-\x7F]*$/.test(v) ? v : `=?UTF-8?B?${b64(v)}?=`);

function rawEmail(to: string[], subject: string, body: string) {
  const msg = [
    `To: ${to.join(", ")}`,
    `Subject: ${header(subject)}`,
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
    "",
    body,
  ].join("\r\n");
  return b64(msg).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Emails a completed job sheet to the client contacts ticked "Send job sheet" via the connected Gmail account. */
export const sendJobSheetEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { sheetId: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: sheet, error } = await supabase
      .from("job_sheets")
      .select("jobsheet_number, status, reported_fault, repairs_performed, technician_name, client_full_name, created_at, clients(name, property_name, street_name, location), sites(name, address), assets(reference_number, serial_number)")
      .eq("id", data.sheetId)
      .single();
    if (error || !sheet) throw new Error("Job sheet not found");
    if (sheet.status !== "completed") throw new Error("Job sheet must be completed before emailing");

    const client = sheet.clients as { name: string; property_name: string | null; street_name: string | null; location: string | null } | null;
    const site = sheet.sites as { name: string; address: string | null } | null;
    const asset = sheet.assets as { reference_number: string; serial_number: string | null } | null;

    const { data: contacts } = await supabase
      .from("client_contacts")
      .select("email, first_name, last_name")
      .eq("client_id", (sheet as unknown as { client_id: string }).client_id ?? "")
      .eq("receives_job_sheets", true);

    // RLS-safe fallback: look up client_id explicitly if not embedded
    let emails = (contacts ?? []).map((c) => c.email).filter((e): e is string => !!e);
    if (!emails.length) {
      const { data: js } = await supabase.from("job_sheets").select("client_id").eq("id", data.sheetId).single();
      if (js) {
        const { data: cs } = await supabase.from("client_contacts").select("email").eq("client_id", js.client_id).eq("receives_job_sheets", true);
        emails = (cs ?? []).map((c) => c.email).filter((e): e is string => !!e);
      }
    }
    if (!emails.length) return { sent: false as const, recipients: [] as string[], reason: "no_recipients" };

    const address = [site?.name, site?.address, client?.property_name, client?.street_name, client?.location].filter(Boolean).join(", ");
    const body = [
      `Dear ${client?.name ?? "customer"},`,
      "",
      `Please find below the completed job sheet #${sheet.jobsheet_number}.`,
      "",
      `Date: ${new Date(sheet.created_at).toLocaleDateString()}`,
      address ? `Site: ${address}` : null,
      asset ? `Equipment: ${asset.reference_number}${asset.serial_number ? ` (S/N ${asset.serial_number})` : ""}` : null,
      sheet.technician_name ? `Technician: ${sheet.technician_name}` : null,
      "",
      sheet.reported_fault ? `Reported fault:\n${sheet.reported_fault}\n` : null,
      sheet.repairs_performed ? `Work carried out:\n${sheet.repairs_performed}\n` : null,
      sheet.client_full_name ? `Signed off by: ${sheet.client_full_name}` : null,
      "",
      "Thank you for your business.",
    ].filter((l): l is string => l != null).join("\n");

    const lovableKey = process.env["LOVABLE_API_KEY"];
    const gmailKey = process.env["GOOGLE_MAIL_API_KEY"];
    if (!lovableKey || !gmailKey) throw new Error("Email connection is not configured");

    const res = await fetch("https://connector-gateway.lovable.dev/google_mail/gmail/v1/users/me/messages/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "X-Connection-Api-Key": gmailKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ raw: rawEmail(emails, `Job sheet #${sheet.jobsheet_number} — ${client?.name ?? "completed job"}`, body) }),
    });
    if (!res.ok) {
      const text = await res.text();
      console.error(`Gmail send failed [${res.status}]: ${text}`);
      throw new Error(`Email send failed [${res.status}]: ${text}`);
    }
    return { sent: true as const, recipients: emails };
  });
