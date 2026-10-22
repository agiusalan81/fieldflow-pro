import { companySignature, formatOfficeAddress, parseOfficeAddress } from "@/lib/contact-details";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { parseIntegrations, renderTemplate } from "@/lib/integrations";
import { canSendNotice, waNumber } from "@/lib/client-notices";
import { rawEmail } from "@/lib/sendJobSheetEmail";
import { etaText } from "@/lib/travel-eta";

/** Sends the "on the way", "no one to open" or "client left unsigned" message to the client's contacts by email and/or WhatsApp. */
export const sendClientNotice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ sheetId: z.string().uuid(), event: z.enum(["no_access", "unsigned_left", "on_my_way"]), eta: z.object({ km: z.number().min(0).max(500), minutes: z.number().min(1).max(600) }).optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const { data: sheet, error } = await sb.from("job_sheets")
      .select("id, company_id, client_id, site_id, jobsheet_number, technician_name, signature_data, departure_status, client_notices, created_at, clients(name), sites(name, address), assets(reference_number), users!job_sheets_assigned_technician_id_fkey(full_name)")
      .eq("id", data.sheetId).single();
    if (error || !sheet) throw new Error("Job sheet not found");
    const blocked = canSendNotice(data.event, sheet);
    if (blocked) throw new Error(blocked);
    if (data.event === "unsigned_left") {
      const { data: mgr } = await sb.rpc("is_company_manager");
      if (!mgr) throw new Error("Only a supervisor or office admin can send this notice.");
    }
    const [{ data: settings }, { data: company }, { data: contacts }] = await Promise.all([
      sb.from("company_settings").select("integrations, office_phone, company_email, website, office_address, company_address, vat_number").eq("company_id", sheet.company_id).maybeSingle(),
      sb.from("companies").select("name").eq("id", sheet.company_id).single(),
      sb.from("client_contacts").select("first_name, email, phone, has_whatsapp, site_id, is_primary_contact, receives_job_sheets").eq("client_id", sheet.client_id),
    ]);
    const tpl = parseIntegrations(settings?.integrations).templates[data.event];
    if (!tpl.enabled) throw new Error("This message is switched off in Company settings → Messages & emails.");
    const people = (contacts ?? []).filter((c) => !sheet.site_id || !c.site_id || c.site_id === sheet.site_id);
    const first = people.find((c) => c.is_primary_contact) ?? people[0];
    const tz = "Europe/Malta";
    const values = {
      client_name: sheet.clients?.name, contact_name: first?.first_name ?? "", site_name: sheet.sites?.name ?? sheet.sites?.address ?? "",
      site_address: sheet.sites?.address, technician_name: sheet.users?.full_name ?? sheet.technician_name ?? "", asset_reference: sheet.assets?.reference_number ?? "the equipment",
      jobsheet_number: sheet.jobsheet_number, arrival_time: new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: tz }),
      eta_window: data.event === "on_my_way" ? etaText(data.eta ?? null) : "", company_name: company?.name, company_phone: settings?.office_phone ?? "",
    };
    let text = renderTemplate(tpl.body, values);
    // Templates without {{eta_window}} still get the GPS estimate appended.
    if (data.event === "on_my_way" && values.eta_window && !/eta_window/.test(tpl.body)) text += `\nEstimated arrival: ${values.eta_window}.`;
    const result: { channel: string; to: string; ok: boolean; error?: string }[] = [];

    if (tpl.channels.includes("email")) {
      const emails = [...new Set(people.filter((c) => c.email && (c.receives_job_sheets || c.is_primary_contact)).map((c) => c.email!))];
      const a = process.env["LOVABLE_API_KEY"], g = process.env["GOOGLE_MAIL_API_KEY"];
      if (emails.length && a && g) {
        const subject = data.event === "no_access" ? `Visit attempted — ${values.site_name}` : data.event === "on_my_way" ? `Technician on the way — ${values.site_name}` : `Signature needed — Job sheet- ${sheet.jobsheet_number}`;
        const res = await fetch("https://connector-gateway.lovable.dev/google_mail/gmail/v1/users/me/messages/send", {
          method: "POST", headers: { Authorization: `Bearer ${a}`, "X-Connection-Api-Key": g, "Content-Type": "application/json" },
          body: JSON.stringify({ raw: rawEmail(emails, subject, `${text}\n\n${companySignature({ name: company?.name, address: formatOfficeAddress(parseOfficeAddress(settings?.office_address, settings?.company_address ?? "")), phone: settings?.office_phone, email: settings?.company_email, website: settings?.website, vat: settings?.vat_number })}`, []) }),
        });
        if (!res.ok) console.error(`Notice email failed [${res.status}]: ${await res.text()}`);
        result.push({ channel: "email", to: emails.join(", "), ok: res.ok, ...(res.ok ? {} : { error: "Email could not be sent" }) });
      } else result.push({ channel: "email", to: "", ok: false, error: emails.length ? "Email not connected" : "No client email on file" });
    }
    if (tpl.channels.includes("whatsapp")) {
      const nums = [...new Set(people.filter((c) => c.has_whatsapp && c.phone).map((c) => waNumber(c.phone)))].filter(Boolean);
      const a = process.env["LOVABLE_API_KEY"], w = process.env["WHATSAPP_API_KEY"];
      if (!nums.length) result.push({ channel: "whatsapp", to: "", ok: false, error: "No WhatsApp contact on file" });
      else if (!a || !w) result.push({ channel: "whatsapp", to: nums.join(", "), ok: false, error: "WhatsApp not connected" });
      else for (const to of nums) {
        const res = await fetch("https://connector-gateway.lovable.dev/whatsapp/messages", {
          method: "POST", headers: { Authorization: `Bearer ${a}`, "X-Connection-Api-Key": w, "Content-Type": "application/json" },
          body: JSON.stringify({ messaging_product: "whatsapp", to, type: "text", text: { body: text } }),
        });
        const t = await res.text();
        if (!res.ok) console.error(`Notice WhatsApp failed [${res.status}]: ${t}`);
        result.push({ channel: "whatsapp", to, ok: res.ok, ...(res.ok ? {} : { error: "WhatsApp refused it (the wording may need Meta approval first)" }) });
      }
    }
    const log = [...((sheet.client_notices as unknown[]) ?? []), { event: data.event, at: new Date().toISOString(), by: context.userId, result }];
    await sb.from("job_sheets").update({ client_notices: log as never }).eq("id", sheet.id);
    return { text, result };
  });
