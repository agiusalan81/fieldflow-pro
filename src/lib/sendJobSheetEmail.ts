import { customerNotes } from "@/lib/service-sheet";
import {formatSiteDisplay} from "@/lib/site-display";
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { clientPhotos, parsePhotos, labourHours, technicianCount, validateCombinedSheets, dayLabourHours } from "@/lib/jobsheets";
import { parseTemplate, parseTerms, termsFor, visibleBlocks, documentLabel, type PdfTemplate } from "@/lib/documents";
import { buildServicePdf } from "@/lib/service-sheet-pdf";
import { serviceEquipment, type PdfSheetData } from "@/lib/service-sheet";
import { companySignature, formatOfficeAddress, parseOfficeAddress } from "@/lib/contact-details";
import { sheetTitle } from "@/lib/dwr";
import { validateMonthlyQueue } from "@/lib/monthly-signing";
import { pdfFonts, pdfLayerFonts, pdfPageDecoration, resolveDocumentAssets } from "@/lib/branding-assets";
import { clientRecipients } from '@/lib/client-recipients';
import { PORTAL_URL, commonRecipients } from '@/lib/client-routing';

const b64 = (s: string) =>
  btoa(Array.from(new TextEncoder().encode(s), (b) => String.fromCharCode(b)).join(""));
const header = (v: string) => (/^[\x00-\x7F]*$/.test(v) ? v : `=?UTF-8?B?${b64(v)}?=`);

function bytesB64(bytes: Uint8Array) {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin).replace(/.{76}/g, "$&\r\n");
}

export type Attachment = { filename: string; mime: string; data: Uint8Array };

export function rawEmail(to: string[], subject: string, body: string, attachments: Attachment[], identity?: import("./email-identity").EmailIdentity) {
  const boundary = `b_${crypto.randomUUID()}`;
  const parts = [
    `To: ${to.join(", ")}`,
    ...(identity ? [`From: ${header(identity.name)} <noreply@notify.fieldbridgeapp.com>`, ...(identity.replyTo ? [`Reply-To: ${identity.replyTo}`] : [])] : []),
    `Subject: ${header(subject)}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    b64(body),
  ];
  for (const a of attachments) {
    parts.push(
      `--${boundary}`,
      `Content-Type: ${a.mime}; name="${a.filename}"`,
      `Content-Disposition: attachment; filename="${a.filename}"`,
      "Content-Transfer-Encoding: base64",
      "",
      bytesB64(a.data),
    );
  }
  parts.push(`--${boundary}--`);
  return b64(parts.join("\r\n")).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Standard PDF fonts only cover WinAnsi; replace anything else. */
const safe = (s: unknown) =>
  String(s ?? "").replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, "-").replace(/[^\x0A\x20-\x7E\xA0-\xFF]/g, "?");

export async function buildPdf(d: PdfSheetData) {
  if (d.template.stylePreset === "service") return buildServicePdf(d);
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const doc = await PDFDocument.create();
  const { font, bold } = await pdfFonts(doc, d.template);
  const layers = await pdfLayerFonts(doc, d.template, { font, bold });
  const decorate = await pdfPageDecoration(doc, d.template);
  const W = 595, H = 842, M = 48;
  let page = doc.addPage([W, H]);
  decorate(page);
  let y = H - M;
  const colour = (hex: string) => rgb(parseInt(hex.slice(1, 3), 16) / 255, parseInt(hex.slice(3, 5), 16) / 255, parseInt(hex.slice(5, 7), 16) / 255);
  const grey = colour(d.template.primaryColor);
  const need = (h: number) => { if (y - h < M) { page = doc.addPage([W, H]); decorate(page); y = H - M; } };
  const wrap = (text: string, size: number, width: number, mf = font) => {
    const out: string[] = [];
    for (const para of safe(text).split("\n")) {
      let line = "";
      for (const w of para.split(" ")) {
        const t = line ? `${line} ${w}` : w;
        if (mf.widthOfTextAtSize(t, size) > width && line) { out.push(line); line = w; } else line = t;
      }
      out.push(line);
    }
    return out;
  };
  const text = (t: string, x: number, size = 10, f = font, color = colour(d.template.fieldText ?? "#202020")) => page.drawText(safe(t), { x, y, size, font: f, color });
  const labelFill = d.template.textStyles?.label?.background;
  const label = (t: string) => { need(30); y -= d.template.stylePreset === "compact" ? 3 : 8; const v = safe(t.toUpperCase()); if (labelFill) page.drawRectangle({ x: M - 3, y: y - 3, width: layers.label.font.widthOfTextAtSize(v, 8) + 6, height: 12, color: colour(labelFill) }); text(v, M, 8, layers.label.font, layers.label.color); y -= 14; };
  const para = (t: string) => { for (const l of wrap(t || "-", 10, W - 2 * M, layers.detail.font)) { need(14); page.drawRectangle({x:M,y:y-3,width:W-2*M,height:14,color:colour(d.template.fieldBackground ?? "#ffffff")}); text(l, M, 10, layers.detail.font, layers.detail.color); y -= 14; } };

  if (d.logo?.startsWith("data:image/png")) {
    const logo = await doc.embedPng(d.logo);
    const scale = Math.min(100 / logo.width, 45 / logo.height);
    page.drawImage(logo, { x: M, y: y - 45, width: logo.width * scale, height: logo.height * scale }); y -= 60;
  }
  if (d.template.stylePreset === "bold") { page.drawRectangle({ x: M - 8, y: y - 36, width: W - 2 * M + 16, height: 48, color: grey, opacity: 0.12 }); }
  if (d.template.stylePreset === "technical") page.drawLine({ start: { x: M - 8, y }, end: { x: M - 8, y: M }, thickness: 2, color: colour(d.template.accentColor) });
  for (const l of wrap(d.company, 12, W / 2, layers.company.font)) { text(l, M, 12, layers.company.font, layers.company.color); y -= 14; }
  y += 14;
  text(sheetTitle(d.number), W - M - bold.widthOfTextAtSize(safe(sheetTitle(d.number)), 12), 12, bold);
  y -= 16; text("Job sheet - client copy", M, 10, font, grey); text(d.date, W - M - font.widthOfTextAtSize(safe(d.date), 10), 10, font, grey);
  y -= 12; page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.5, color: grey }); y -= 10;

  if (d.template.header) { text(d.template.header, M, 9, font, grey); y -= 14; }
  const signoff = async () => {
    need(130);
    y -= 10; page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.5, color: grey }); y -= 18;
    text("TECHNICIAN", M, 8, bold, grey); text("CLIENT SIGN-OFF", W / 2, 8, bold, grey); y -= 14;
    text(d.technician || "-", M); text(`${d.signedBy || "-"}  -  ID ${d.idCard || "-"}`, W / 2); y -= 8;
    let signatureHeight = 0;
    for (const [signature, x] of [[d.technicianSignature, M], [d.signature, W / 2]] as const) {
      if (!signature?.startsWith("data:image/png")) continue;
      try {
        const img = await doc.embedPng(signature);
        const scale = Math.min(200 / img.width, 60 / img.height);
        const h = img.height * scale, w = img.width * scale;
        page.drawImage(img, { x, y: y - h, width: w, height: h });
        signatureHeight = Math.max(signatureHeight, h);
      } catch { /* ignore bad signature image */ }
    }
    y -= signatureHeight;
    y -= 10;
  };
  for (const b of visibleBlocks(d.template)) {
    if (b === "client") { label(documentLabel(d.template, b)); para(d.client); }
    else if (b === "address") { label(documentLabel(d.template, b)); para(d.address); }
    else if (b === "equipment") { label(documentLabel(d.template, b)); para(d.asset); }
    else if (b === "fault") { label(documentLabel(d.template, b)); para(d.fault); }
    else if (b === "work") { label(documentLabel(d.template, b)); para(d.repairs); }
    else if (b === "notes" && d.notes) { label(documentLabel(d.template, b)); para(d.notes); }
    else if (b === "timesheet" && d.logs.length) {
      label(documentLabel(d.template, b));
      const showT = d.template.showTravel;
      const heads = showT ? ["Date", "In", "Out", "Travel h", "Total h"] : ["Date", "In", "Out", "Total h"];
      const cols = [M, M + 110, M + 180, M + 250, M + 330];
      heads.forEach((h, i) => text(h, cols[i] ?? M, 9, bold)); y -= 14;
      for (const l of d.logs) {
        need(14);
        const vals = showT ? [l.date, l.in, l.out, String(l.travel), l.total.toFixed(2)] : [l.date, l.in, l.out, l.total.toFixed(2)];
        vals.forEach((v, i) => text(v, cols[i] ?? M, 9)); y -= 14;
        para(`Technicians (${l.count}): ${l.techs || "-"}`);
      }
    }
    else if (b === "parts" && d.parts.length) {
      label(documentLabel(d.template, b));
      text("Description", M, 9, bold); text("Unit", M + 360, 9, bold); text("Qty", M + 430, 9, bold); y -= 14;
      for (const p of d.parts) {
        const lines = wrap(p.desc, 9, 340);
        need(lines.length * 12 + 2);
        text(p.unit, M + 360, 9); text(String(p.qty), M + 430, 9);
        for (const l of lines) { text(l, M, 9); y -= 12; }
        y -= 2;
      }
    }
    else if (b === "signoff") await signoff();
  }
  if (d.terms) { label("Terms & conditions"); for (const l of wrap(d.terms, 8, W - 2 * M)) { need(11); text(l, M, 8, font, grey); y -= 11; } }
  if (d.template.footer) { y -= 8; for (const l of d.template.footer.split("\n").flatMap((p) => wrap(p, 9, W - 2 * M))) { need(12); text(l, M, 9, font, grey); y -= 12; } }
  if (d.portalUrl) { label('Client portal'); para(d.portalUrl); }
  return doc.save();
}

type AuthClient = import("@supabase/supabase-js").SupabaseClient<import("@/integrations/supabase/types").Database>;
async function prepareSheet(supabase: AuthClient, sheetId: string, recipients?: string[]) {

    const { data: sheet, error } = await supabase
      .from("job_sheets")
      .select("client_id, site_id, company_id, special_notes, special_notes_in_pdf, special_notes_in_email, maintenance_notes, jobsheet_number, status, reported_fault, repairs_performed, technician_name, client_full_name, client_id_card_no, signature_data, photo_paths, asset_type, asset_type_other, lift_model, serial_number, created_at, is_tech_assistance, is_maintenance, is_installation, job_type_other, assigned_technician_id, clients(name, billing_address, property_name, street_name, location), sites(name, address, store_code), assets(reference_number, serial_number), companies(name)")
      .eq("id", sheetId)
      .single();
    if (error || !sheet) throw new Error("Job sheet not found");
    if (sheet.status !== "completed") throw new Error("Job sheet must be completed before emailing");

    const contacts = await clientRecipients(supabase,sheet.client_id,sheet.site_id,'job_sheet','email');
    const { data: portalOn } = await supabase.rpc('company_module_access',{_company:sheet.company_id,_module:'client_portal'});
    const { data: settings } = await supabase.from("company_settings").select("pdf_template, terms, logo_data, office_address, company_address, vat_number, office_phone, company_email, website").eq("company_id", sheet.company_id).maybeSingle();
    const notes = sheet.special_notes?.trim() || null;
    const emails = recipients?.length ? [...new Set(recipients.map((e) => e.trim().toLowerCase()))] : contacts.map(c=>c.email).filter((e):e is string=>!!e);


    const client = sheet.clients as { name: string; billing_address: string | null } | null;
    const site = sheet.sites;
    const asset = sheet.assets as { reference_number: string } | null;
    const company = (sheet.companies as { name: string } | null)?.name ?? "";
    const address = site ? formatSiteDisplay({...site,address:site.address||client?.billing_address||null}) : client?.billing_address??"";
    const date = new Date(sheet.created_at).toLocaleDateString("en-GB");

    const [{ data: logs }, { data: parts }] = await Promise.all([
      supabase.from("jobsheet_time_logs").select("log_date, time_in, time_out, traveling_time_hours, technician_initials, technician_count").eq("jobsheet_id", sheetId).order("sort_order"),
      supabase.from("jobsheet_parts").select("part_description, unit, quantity").eq("jobsheet_id", sheetId).order("sort_order"),
    ]);

    const assetType = sheet.asset_type === "Other" ? sheet.asset_type_other : sheet.asset_type;
    const { data: technicianProfile } = sheet.assigned_technician_id ? await supabase.from("users").select("signature_on_file").eq("id",sheet.assigned_technician_id).maybeSingle() : { data: null };
    const pdf = await buildPdf({
      officeAddress: formatOfficeAddress(parseOfficeAddress(settings?.office_address,settings?.company_address ?? "")), vatNumber: settings?.vat_number ?? "", contact: [settings?.office_phone, settings?.company_email].filter(Boolean).join("\n"),
      workType: [sheet.is_tech_assistance && "Technical assistance",sheet.is_maintenance && "Maintenance",sheet.is_installation && "Installation",sheet.job_type_other].filter(Boolean).join(", "), technicianSignature: technicianProfile?.signature_on_file,

      ...(portalOn ? {portalUrl:PORTAL_URL} : {}), company, logo: settings?.logo_data ?? "", number: sheet.jobsheet_number, date, client: client?.name ?? "-", address: address || "-",
      asset: serviceEquipment(assetType, asset?.reference_number, sheet.lift_model, sheet.serial_number),
      fault: sheet.reported_fault ?? "", repairs: sheet.repairs_performed ?? "", technician: sheet.technician_name ?? "",
      signedBy: sheet.client_full_name ?? "", idCard: sheet.client_id_card_no ?? "", signature: sheet.signature_data,
      logs: (logs ?? []).map((l) => {
        const travel = Number(l.traveling_time_hours) || 0;
        return { date: l.log_date, in: l.time_in?.slice(0, 5) ?? "", out: l.time_out?.slice(0, 5) ?? "", travel, total: dayLabourHours(l.time_in, l.time_out, travel, l.technician_count, l.technician_initials), count: technicianCount(l.technician_count, l.technician_initials), techs: l.technician_initials.join(", ") };
      }),
      parts: (parts ?? []).map((p) => ({ desc: p.part_description, unit: p.unit ?? "", qty: Number(p.quantity) })),
      notes: customerNotes(sheet.maintenance_notes, sheet.special_notes_in_pdf ? notes : null),
      terms: termsFor(parseTerms(settings?.terms), "job_sheet"),
      template: await resolveDocumentAssets(supabase, parseTemplate(settings?.pdf_template)),
    });

    const attachments: Attachment[] = [{ filename: `${sheetTitle(sheet.jobsheet_number)}.pdf`, mime: "application/pdf", data: pdf }];
    const counts = { damage: 0, part: 0, other: 0 };
    for (const p of clientPhotos(parsePhotos(sheet.photo_paths))) {
      const { data: file } = await supabase.storage.from("job-photos").download(p.path);
      if (!file) continue;
      counts[p.kind] += 1;
      const name = p.kind === "damage" ? "damage_found" : p.kind === "part" ? "part_replaced" : "photo";
      attachments.push({ filename: `${name}_${counts[p.kind]}.jpg`, mime: "image/jpeg", data: new Uint8Array(await file.arrayBuffer()) });
    }

    const photoCount = attachments.length - 1;
    const body = [
      `Dear ${client?.name ?? "customer"},`,
      "",
      `Please find attached the completed ${sheetTitle(sheet.jobsheet_number)} for work carried out${address ? ` at ${address}` : ""} on ${date}.`,
      sheet.maintenance_notes?.trim() ? `\nMaintenance notes:\n${sheet.maintenance_notes.trim()}\n` : null,
      sheet.special_notes_in_email && notes ? `\n${notes}\n` : null,
      photoCount ? `${photoCount} photo${photoCount > 1 ? "s" : ""} of the work are also attached.` : null,
      "",
      "Thank you for your business.",
      portalOn ? `Client portal: ${PORTAL_URL}\nSign in with your invited account to manage contacts and delivery preferences.` : null,
      "",
      companySignature({ name: company, address: formatOfficeAddress(parseOfficeAddress(settings?.office_address, settings?.company_address ?? "")), phone: settings?.office_phone, email: settings?.company_email, website: settings?.website, vat: settings?.vat_number }),
    ].filter((l): l is string => l != null).join("\n");

    const { resolveEmailIdentity } = await import("./email-identity.server");
    const identity = await resolveEmailIdentity(supabase, sheet.company_id);
    return { identity, sheet, emails, attachments, body, clientName: client?.name ?? "customer" };
}

function validateRecipients(recipients?: string[]) {
  if (recipients?.some((e) => typeof e !== "string" || e.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e))) throw new Error("Invalid email address");
}
async function sendMail(emails: string[], subject: string, body: string, attachments: Attachment[], identity: import("./email-identity").EmailIdentity) {
    const lovableKey = process.env["LOVABLE_API_KEY"];
    const gmailKey = process.env["GOOGLE_MAIL_API_KEY"];
    if (!lovableKey || !gmailKey) throw new Error("Email connection is not configured");

    const res = await fetch("https://connector-gateway.lovable.dev/google_mail/gmail/v1/users/me/messages/send", {
      method: "POST",
      headers: { Authorization: `Bearer ${lovableKey}`, "X-Connection-Api-Key": gmailKey, "Content-Type": "application/json" },
      body: JSON.stringify({ raw: rawEmail(emails, subject, body, attachments, identity) }),
    });
    if (!res.ok) {
      const t = await res.text();
      console.error(`Gmail send failed [${res.status}]: ${t}`);
      throw new Error("Email could not be sent. Check your email connection and try again.");
    }
}

export const sendJobSheetEmail = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((d: { sheetId: string; recipients?: string[] }) => { validateRecipients(d.recipients); return d; })
  .handler(async ({ data, context }) => {
    const pack = await prepareSheet(context.supabase, data.sheetId, data.recipients);
    if (!pack.emails.length) return { sent: false as const, recipients: [] as string[] };
    await sendMail(pack.emails, `${sheetTitle(pack.sheet.jobsheet_number)} — ${pack.clientName}`, pack.body, pack.attachments, pack.identity);
    return { sent: true as const, recipients: pack.emails };
  });

export const combinedJobSheets = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((d: { sheetIds: string[]; recipients?: string[]; email?: boolean }) => {
    if (!Array.isArray(d.sheetIds) || !d.sheetIds.length || d.sheetIds.some((id) => !/^[0-9a-f-]{36}$/i.test(id))) throw new Error("Select valid job sheets");
    validateRecipients(d.recipients); return d;
  })
  .handler(async ({ data, context }) => {
    const { data: office, error } = await context.supabase.rpc("my_role");
    if (error || (office !== "admin" && office !== "superuser")) throw new Error("Only office admins can combine job sheets");
    const ids = [...new Set(data.sheetIds)];
    const { data: rows, error: readError } = await context.supabase.from("job_sheets").select("id, client_id, status, created_at").in("id", ids).order("created_at");
    if (readError || !rows || rows.length !== ids.length) throw new Error("Some selected sheets are not available");
    validateCombinedSheets(rows);
    const { PDFDocument } = await import("pdf-lib");
    const doc = await PDFDocument.create();
    let clientName = "customer"; let emails: string[] = []; let identity: import("./email-identity").EmailIdentity = { name: "FieldBridge" };
    for (const row of rows) {
      const pack = await prepareSheet(context.supabase, row.id, data.recipients);
      clientName = pack.clientName; emails = pack.emails; identity = pack.identity;
      for (const a of pack.attachments) {
        if (a.mime === "application/pdf") {
          const source = await PDFDocument.load(a.data);
          for (const page of await doc.copyPages(source, source.getPageIndices())) doc.addPage(page);
        } else {
          const image = a.data[0] === 137 ? await doc.embedPng(a.data) : await doc.embedJpg(a.data);
          const page = doc.addPage([595, 842]);
          const scale = Math.min(499 / image.width, 746 / image.height);
          page.drawImage(image, { x: (595 - image.width * scale) / 2, y: (842 - image.height * scale) / 2, width: image.width * scale, height: image.height * scale });
        }
      }
    }
    const pdf = await doc.save();
    const filename = `Job sheets - ${rows[0]?.created_at.slice(0, 10)} to ${rows[rows.length - 1]?.created_at.slice(0, 10)}.pdf`;
    if (data.email) {
      if (!data.recipients?.length) throw new Error("Pick at least one recipient");
      await sendMail(emails, `Job sheets — ${clientName}`, `Dear ${clientName},\n\nPlease find your ${rows.length} completed job sheets attached as one PDF.\n\nThank you.`, [{ filename, mime: "application/pdf", data: pdf }], identity);
      return { filename, base64: "", sent: true, recipients: emails };
    }
    return { filename, base64: bytesB64(pdf).replace(/\s/g, ""), sent: false, recipients: [] as string[] };
  });

export const startMonthlySigning = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((d: { clientId: string; month: string; sheetIds: string[] }) => {
    if (!Array.isArray(d.sheetIds) || !d.sheetIds.length || d.sheetIds.length > 100) throw new Error("Select between 1 and 100 sheets");
    return d;
  }).handler(async ({ data, context }) => {
    const ids = [...new Set(data.sheetIds)];
    const { data: rows, error } = await context.supabase.from("job_sheets").select("id, client_id, created_at, status, signature_data").in("id", ids).order("created_at");
    if (error || rows?.length !== ids.length) throw new Error("Some sheets are unavailable");
    validateMonthlyQueue(rows, data.clientId, data.month);
    const { data: existing } = await context.supabase.from("signing_batches").select("*").eq("created_by", context.userId).eq("client_id", data.clientId).eq("month", data.month).eq("status", "signing").order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (existing && existing.sheet_ids.length === ids.length && existing.sheet_ids.every((id) => ids.includes(id))) return existing;
    const { data: client } = await context.supabase.from("clients").select("company_id").eq("id", data.clientId).single();
    if (!client) throw new Error("Client unavailable");
    const { data: batch, error: insertError } = await context.supabase.from("signing_batches").insert({ company_id: client.company_id, client_id: data.clientId, created_by: context.userId, month: data.month, sheet_ids: rows.map((r) => r.id) }).select("*").single();
    if (insertError) throw insertError; return batch;
  });

export const signMonthlySheet = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((d: { batchId: string; sheetId: string; name: string; card: string; signature: string }) => d)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("sign_batch_sheet", { _batch: data.batchId, _sheet: data.sheetId, _name: data.name, _card: data.card, _signature: data.signature });
    if (error) throw error; return { signed: true };
  });

export const finishMonthlySigning = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((d: { batchId: string }) => d)
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const { data: batch, error } = await sb.from("signing_batches").select("*").eq("id", data.batchId).eq("created_by", context.userId).single();
    if (error || !batch) throw new Error("Signing session unavailable");
    if (batch.status === "sent") return { sent: true, recipients: batch.recipients, count: batch.signed_ids.length };
    if (batch.status === "sending") throw new Error("This PDF is already being sent. Check the monthly delivery status before retrying.");
    if (!batch.signed_ids.length) {
      await sb.from("signing_batches").update({ status: "empty" }).eq("id", batch.id);
      return { sent: false, recipients: [] as string[], count: 0 };
    }
    const { data: claimed, error: claimError } = await sb.from("signing_batches").update({ status: "sending", delivery_error: null }).eq("id", batch.id).in("status", ["signing", "failed"]).select("id").maybeSingle();
    if (claimError || !claimed) throw new Error("This session is already being processed");
    let delivered = false;
    try {
      const { data: rows, error: readError } = await sb.from("job_sheets").select("id, client_id, status, created_at, signature_data").in("id", batch.signed_ids).order("created_at");
      if (readError || rows?.length !== batch.signed_ids.length) throw new Error("Some signed sheets are no longer available");
      validateCombinedSheets(rows);
      if (rows.some((r) => !r.signature_data || r.created_at.slice(0, 7) !== batch.month || r.client_id !== batch.client_id)) throw new Error("Monthly selection is no longer valid");
      const { PDFDocument } = await import("pdf-lib");
      const doc = await PDFDocument.create();
      const groups:string[][]=[]; let clientName = "customer"; let identity: import("./email-identity").EmailIdentity = { name: "FieldBridge" };
      for (const row of rows) {
        const pack = await prepareSheet(sb, row.id);
        groups.push(pack.emails); clientName = pack.clientName; identity = pack.identity;
        for (const attachment of pack.attachments) {
          if (attachment.mime === "application/pdf") {
            const source = await PDFDocument.load(attachment.data);
            for (const page of await doc.copyPages(source, source.getPageIndices())) doc.addPage(page);
          } else {
            const image = attachment.data[0] === 137 ? await doc.embedPng(attachment.data) : await doc.embedJpg(attachment.data);
            const page = doc.addPage([595, 842]);
            const scale = Math.min(499 / image.width, 746 / image.height);
            page.drawImage(image, { x: (595 - image.width * scale) / 2, y: (842 - image.height * scale) / 2, width: image.width * scale, height: image.height * scale });
          }
        }
      }
      const recipients = commonRecipients(groups);
      validateRecipients(recipients);
      if (!recipients.length) throw new Error("No job-sheet email recipients selected for this client");
      await sendMail(recipients, `Monthly job sheets — ${batch.month} — ${clientName}`, `Dear ${clientName},\n\nYour ${rows.length} signed job sheets for ${batch.month} are attached as one continuous PDF.\n\nThank you.`, [{ filename: `Job sheets - ${batch.month}.pdf`, mime: "application/pdf", data: await doc.save() }], identity);
      delivered = true;
      const { error: recordError } = await sb.from("signing_batches").update({ status: "sent", recipients, sent_at: new Date().toISOString() }).eq("id", batch.id);
      if (recordError) throw new Error("Email sent, but delivery status could not be saved. Do not resend without checking.");
      return { sent: true, recipients, count: rows.length };
    } catch (e) {
      if (!delivered) await sb.from("signing_batches").update({ status: "failed", delivery_error: e instanceof Error ? e.message : "Email failed" }).eq("id", batch.id);
      throw e;
    }
  });
