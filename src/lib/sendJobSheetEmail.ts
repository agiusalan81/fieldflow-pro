import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { clientPhotos, parsePhotos, labourHours, technicianCount, validateCombinedSheets } from "@/lib/jobsheets";
import { parseTemplate, parseTerms, termsFor, visibleBlocks, type PdfTemplate } from "@/lib/documents";
import { sheetTitle } from "@/lib/dwr";

const b64 = (s: string) =>
  btoa(Array.from(new TextEncoder().encode(s), (b) => String.fromCharCode(b)).join(""));
const header = (v: string) => (/^[\x00-\x7F]*$/.test(v) ? v : `=?UTF-8?B?${b64(v)}?=`);

function bytesB64(bytes: Uint8Array) {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin).replace(/.{76}/g, "$&\r\n");
}

export type Attachment = { filename: string; mime: string; data: Uint8Array };

export function rawEmail(to: string[], subject: string, body: string, attachments: Attachment[]) {
  const boundary = `b_${crypto.randomUUID()}`;
  const parts = [
    `To: ${to.join(", ")}`,
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

export async function buildPdf(d: {
  company: string; logo?: string; number: string | number; date: string; client: string; address: string; asset: string;
  fault: string; repairs: string; technician: string; signedBy: string; idCard: string; signature: string | null;
  logs: { date: string; in: string; out: string; travel: number; total: number; techs: string; count: number }[];
  parts: { desc: string; unit: string; qty: number }[];
  notes: string | null; terms: string | null; template: PdfTemplate;
}) {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const W = 595, H = 842, M = 48;
  let page = doc.addPage([W, H]);
  let y = H - M;
  const grey = rgb(0.4, 0.4, 0.45);
  const need = (h: number) => { if (y - h < M) { page = doc.addPage([W, H]); y = H - M; } };
  const wrap = (text: string, size: number, width: number) => {
    const out: string[] = [];
    for (const para of safe(text).split("\n")) {
      let line = "";
      for (const w of para.split(" ")) {
        const t = line ? `${line} ${w}` : w;
        if (font.widthOfTextAtSize(t, size) > width && line) { out.push(line); line = w; } else line = t;
      }
      out.push(line);
    }
    return out;
  };
  const text = (t: string, x: number, size = 10, f = font, color = rgb(0.1, 0.1, 0.12)) => page.drawText(safe(t), { x, y, size, font: f, color });
  const label = (t: string) => { need(30); y -= 8; text(t.toUpperCase(), M, 8, bold, grey); y -= 14; };
  const para = (t: string) => { for (const l of wrap(t || "-", 10, W - 2 * M)) { need(14); text(l, M); y -= 14; } };

  if (d.logo?.startsWith("data:image/png")) {
    const logo = await doc.embedPng(d.logo);
    const scale = Math.min(100 / logo.width, 45 / logo.height);
    page.drawImage(logo, { x: M, y: y - 45, width: logo.width * scale, height: logo.height * scale }); y -= 60;
  }
  para(d.company);
  text(sheetTitle(d.number), W - M - bold.widthOfTextAtSize(safe(sheetTitle(d.number)), 12), 12, bold);
  y -= 16; text("Job sheet - client copy", M, 10, font, grey); text(d.date, W - M - font.widthOfTextAtSize(safe(d.date), 10), 10, font, grey);
  y -= 12; page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.5, color: grey }); y -= 10;

  if (d.template.header) { text(d.template.header, M, 9, font, grey); y -= 14; }
  const signoff = async () => {
    need(130);
    y -= 10; page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.5, color: grey }); y -= 18;
    text("TECHNICIAN", M, 8, bold, grey); text("CLIENT SIGN-OFF", W / 2, 8, bold, grey); y -= 14;
    text(d.technician || "-", M); text(`${d.signedBy || "-"}  -  ID ${d.idCard || "-"}`, W / 2); y -= 8;
    if (d.signature?.startsWith("data:image/png")) {
      try {
        const img = await doc.embedPng(d.signature);
        const h = 60, w = Math.min(200, (img.width / img.height) * h);
        page.drawImage(img, { x: W / 2, y: y - h, width: w, height: h });
        y -= h;
      } catch { /* ignore bad signature image */ }
    }
    y -= 10;
  };
  for (const b of visibleBlocks(d.template)) {
    if (b === "client") { label("Client"); para(d.client); }
    else if (b === "address") { label("Site address"); para(d.address); }
    else if (b === "equipment") { label("Equipment"); para(d.asset); }
    else if (b === "fault") { label("Reported fault"); para(d.fault); }
    else if (b === "work") { label("Work carried out"); para(d.repairs); }
    else if (b === "notes" && d.notes) { label("Special notes"); para(d.notes); }
    else if (b === "timesheet" && d.logs.length) {
      label("Time sheet");
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
      label("Parts used");
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
  if (d.template.footer) { need(20); y -= 8; text(d.template.footer, M, 9, font, grey); }
  return doc.save();
}

type AuthClient = import("@supabase/supabase-js").SupabaseClient<import("@/integrations/supabase/types").Database>;
async function prepareSheet(supabase: AuthClient, sheetId: string, recipients?: string[]) {

    const { data: sheet, error } = await supabase
      .from("job_sheets")
      .select("client_id, site_id, company_id, special_notes, special_notes_in_pdf, special_notes_in_email, jobsheet_number, status, reported_fault, repairs_performed, technician_name, client_full_name, client_id_card_no, signature_data, photo_paths, asset_type, asset_type_other, lift_model, serial_number, created_at, clients(name, billing_address, property_name, street_name, location), sites(name, address), assets(reference_number, serial_number), companies(name)")
      .eq("id", sheetId)
      .single();
    if (error || !sheet) throw new Error("Job sheet not found");
    if (sheet.status !== "completed") throw new Error("Job sheet must be completed before emailing");

    const { data: contacts } = await supabase
      .from("client_contacts").select("email, site_id").eq("client_id", sheet.client_id).eq("receives_job_sheets", true);
    const { data: settings } = await supabase.from("company_settings").select("pdf_template, terms, logo_data").eq("company_id", sheet.company_id).maybeSingle();
    const notes = sheet.special_notes?.trim() || null;
    const emails = recipients?.length ? [...new Set(recipients.map((e) => e.trim()))] : (contacts ?? []).filter((c) => !c.site_id || !sheet.site_id || c.site_id === sheet.site_id).map((c) => c.email).filter((e): e is string => !!e);


    const client = sheet.clients as { name: string; billing_address: string | null } | null;
    const site = sheet.sites as { name: string; address: string | null } | null;
    const asset = sheet.assets as { reference_number: string } | null;
    const company = (sheet.companies as { name: string } | null)?.name ?? "";
    const address = [site?.name, site?.address || client?.billing_address].filter(Boolean).join(", ");
    const date = new Date(sheet.created_at).toLocaleDateString("en-GB");

    const [{ data: logs }, { data: parts }] = await Promise.all([
      supabase.from("jobsheet_time_logs").select("log_date, time_in, time_out, traveling_time_hours, technician_initials, technician_count").eq("jobsheet_id", sheetId).order("sort_order"),
      supabase.from("jobsheet_parts").select("part_description, unit, quantity").eq("jobsheet_id", sheetId).order("sort_order"),
    ]);

    const assetType = sheet.asset_type === "Other" ? sheet.asset_type_other : sheet.asset_type;
    const pdf = await buildPdf({
      company, logo: settings?.logo_data ?? "", number: sheet.jobsheet_number, date, client: client?.name ?? "-", address: address || "-",
      asset: [assetType, asset?.reference_number, sheet.lift_model && `Model ${sheet.lift_model}`, sheet.serial_number && `S/N ${sheet.serial_number}`].filter(Boolean).join("  ·  ").replace(/·/g, "-") || "-",
      fault: sheet.reported_fault ?? "", repairs: sheet.repairs_performed ?? "", technician: sheet.technician_name ?? "",
      signedBy: sheet.client_full_name ?? "", idCard: sheet.client_id_card_no ?? "", signature: sheet.signature_data,
      logs: (logs ?? []).map((l) => {
        const travel = Number(l.traveling_time_hours) || 0;
        return { date: l.log_date, in: l.time_in?.slice(0, 5) ?? "", out: l.time_out?.slice(0, 5) ?? "", travel, total: labourHours(l.time_in, l.time_out, l.technician_count, l.technician_initials), count: technicianCount(l.technician_count, l.technician_initials), techs: l.technician_initials.join(", ") };
      }),
      parts: (parts ?? []).map((p) => ({ desc: p.part_description, unit: p.unit ?? "", qty: Number(p.quantity) })),
      notes: sheet.special_notes_in_pdf ? notes : null,
      terms: termsFor(parseTerms(settings?.terms), "job_sheet"),
      template: parseTemplate(settings?.pdf_template),
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
      sheet.special_notes_in_email && notes ? `\n${notes}\n` : null,
      photoCount ? `${photoCount} photo${photoCount > 1 ? "s" : ""} of the work are also attached.` : null,
      "",
      "Thank you for your business.",
      company,
    ].filter((l): l is string => l != null).join("\n");

    return { sheet, emails, attachments, body, clientName: client?.name ?? "customer" };
}

function validateRecipients(recipients?: string[]) {
  if (recipients?.some((e) => typeof e !== "string" || e.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e))) throw new Error("Invalid email address");
}
async function sendMail(emails: string[], subject: string, body: string, attachments: Attachment[]) {
    const lovableKey = process.env["LOVABLE_API_KEY"];
    const gmailKey = process.env["GOOGLE_MAIL_API_KEY"];
    if (!lovableKey || !gmailKey) throw new Error("Email connection is not configured");

    const res = await fetch("https://connector-gateway.lovable.dev/google_mail/gmail/v1/users/me/messages/send", {
      method: "POST",
      headers: { Authorization: `Bearer ${lovableKey}`, "X-Connection-Api-Key": gmailKey, "Content-Type": "application/json" },
      body: JSON.stringify({ raw: rawEmail(emails, subject, body, attachments) }),
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
    await sendMail(pack.emails, `${sheetTitle(pack.sheet.jobsheet_number)} — ${pack.clientName}`, pack.body, pack.attachments);
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
    let clientName = "customer"; let emails: string[] = [];
    for (const row of rows) {
      const pack = await prepareSheet(context.supabase, row.id, data.recipients);
      clientName = pack.clientName; emails = pack.emails;
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
      await sendMail(emails, `Job sheets — ${clientName}`, `Dear ${clientName},\n\nPlease find your ${rows.length} completed job sheets attached as one PDF.\n\nThank you.`, [{ filename, mime: "application/pdf", data: pdf }]);
      return { filename, base64: "", sent: true, recipients: emails };
    }
    return { filename, base64: bytesB64(pdf).replace(/\s/g, ""), sent: false, recipients: [] as string[] };
  });
