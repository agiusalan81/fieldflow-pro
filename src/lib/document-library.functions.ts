import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type SupabaseLike = {
  rpc: (fn: "is_company_manager") => PromiseLike<{ data: unknown }>;
  from: (t: string) => { select: (c: string) => { eq: (c: string, v: string) => { maybeSingle: () => PromiseLike<{ data: { name: string; file_path: string } | null; error: { message: string } | null }> } } };
  storage: { from: (b: string) => { download: (p: string) => PromiseLike<{ data: Blob | null; error: { message: string } | null }> } };
};

/** Downloads a library document and has the AI read it, returning plain text or strict JSON. */
async function readDocument(supabase: SupabaseLike, documentId: string, prompt: string, jsonSchema?: { name: string; schema: Record<string, unknown> }): Promise<string> {
  const { data: mgr } = await supabase.rpc("is_company_manager");
  if (!mgr) throw new Error("Only office admins and supervisors can import documents.");

  const { data: doc, error } = await supabase.from("company_documents").select("name, file_path").eq("id", documentId).maybeSingle();
  if (error || !doc) throw new Error("Document not found.");

  const { data: file, error: dlErr } = await supabase.storage.from("company-documents").download(doc.file_path);
  if (dlErr || !file) throw new Error("Could not read the file from storage.");

  const ext = doc.name.toLowerCase().split(".").pop() ?? "";
  const mime = file.type || (ext === "pdf" ? "application/pdf" : ext.match(/jpe?g/) ? "image/jpeg" : ext === "webp" ? "image/webp" : ext === "png" ? "image/png" : "");
  const isPdf = mime === "application/pdf";
  const isImage = mime.startsWith("image/");
  if (!isPdf && !isImage) throw new Error("Only PDF and image documents can be imported. For Word files, save them as PDF first.");

  const buf = new Uint8Array(await file.arrayBuffer());
  let bin = "";
  for (let i = 0; i < buf.length; i += 8192) bin += String.fromCharCode(...buf.subarray(i, i + 8192));
  const b64 = btoa(bin);

  const key = process.env['LOVABLE_API_KEY'];
  if (!key) throw new Error("AI is not configured.");

  const filePart = isPdf
    ? { type: "input_file", filename: doc.name, file_data: `data:application/pdf;base64,${b64}` }
    : { type: "input_image", image_url: `data:${mime};base64,${b64}` };

  const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
    method: "POST",
    headers: { "Lovable-API-Key": key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", "X-Lovable-AIG-SDK": "fetch" },
    body: JSON.stringify({
      model: "openai/gpt-6-astra", stream: true, store: false,
      reasoning: { effort: "low" },
      input: [{ role: "user", content: [{ type: "input_text", text: prompt }, filePart] }],
      ...(jsonSchema ? { text: { format: { type: "json_schema", name: jsonSchema.name, strict: true, schema: jsonSchema.schema } } } : {}),
    }),
  });
  if (!res.ok || !res.body) {
    const t = await res.text();
    console.error(`Document read failed [${res.status}]: ${t}`);
    if (res.status === 429) throw new Error("The AI is busy right now. Please try again in a minute.");
    if (res.status === 402) throw new Error("AI credits have run out. Add credits in Settings → Plans & credits.");
    throw new Error(`Could not read the document (${res.status}).`);
  }
  const reader = res.body.getReader(); const dec = new TextDecoder();
  let buf2 = "", out = "", done = "";
  for (;;) {
    const { value, done: end } = await reader.read();
    if (end) break;
    buf2 += dec.decode(value, { stream: true });
    let i;
    while ((i = buf2.indexOf("\n")) >= 0) {
      const line = buf2.slice(0, i).trim(); buf2 = buf2.slice(i + 1);
      if (!line.startsWith("data:")) continue;
      const p = line.slice(5).trim(); if (!p || p === "[DONE]") continue;
      try {
        const ev = JSON.parse(p);
        if (ev.type === "response.output_text.delta") out += ev.delta ?? "";
        else if (ev.type === "response.output_text.done") done = ev.text ?? "";
        else if (ev.type === "response.failed" || ev.type === "error") throw new Error(ev.response?.error?.message ?? ev.message ?? "Document read failed.");
      } catch (e) { if (e instanceof SyntaxError) continue; throw e; }
    }
  }
  const text = (done || out).trim();
  if (!text) throw new Error("No text could be read from this document.");
  return text;
}

const EXACT = `Extract the full text of this document exactly as written, preserving paragraph breaks and numbering.
Do not summarise, translate, correct or add anything. If the document is scanned, read it as accurately as you can.
Return only the document text, no commentary.`;

/** Reads a document from the company library and returns its text so office staff can use it as terms, presets, etc. */
export const extractDocumentText = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ documentId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const text = await readDocument(context.supabase as never, data.documentId, EXACT);
    return { text: text.slice(0, 20000) };
  });

const CHECKLIST_SCHEMA = {
  type: "object", additionalProperties: false,
  required: ["name", "items"],
  properties: {
    name: { type: "string", description: "short checklist name, e.g. Elevator annual maintenance" },
    items: { type: "array", items: { type: "string" }, description: "every inspection/service step, one per entry, in document order" },
  },
};

/** Reads a checklist document and returns its title plus one item per line. */
export const extractChecklistItems = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ documentId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const text = await readDocument(
      context.supabase as never, data.documentId,
      "This document is a maintenance/service checklist. Extract the checklist title and every individual inspection or service step as a separate item, in order. Keep each item short and actionable. Ignore headers, signatures and page furniture.",
      { name: "checklist", schema: CHECKLIST_SCHEMA },
    );
    const j = JSON.parse(text) as { name: string; items: string[] };
    return { name: j.name.slice(0, 120), items: j.items.map((s) => s.trim()).filter(Boolean).slice(0, 200) };
  });

const CONTRACT_SCHEMA = {
  type: "object", additionalProperties: false,
  required: ["name", "client_name", "contract_category", "tier", "visits_per_year", "annual_price", "labour_discount_pct", "parts_discount_pct", "start_date", "end_date"],
  properties: {
    name: { type: "string", description: "contract or agreement name, e.g. Commercial Gold" },
    client_name: { type: "string", description: "client/company the agreement is with, empty if not stated" },
    contract_category: { type: "string", description: "Residential, Commercial, or another category stated in the document" },
    tier: { type: "string", description: "Bronze, Silver, Gold, Custom, or empty" },
    visits_per_year: { type: "number", description: "number of maintenance visits per year, 0 if not stated" },
    annual_price: { type: "number", description: "annual price excluding currency symbol, 0 if not stated" },
    labour_discount_pct: { type: "number", description: "labour discount percentage, 0 if none" },
    parts_discount_pct: { type: "number", description: "parts discount percentage, 0 if none" },
    start_date: { type: "string", description: "ISO date YYYY-MM-DD or empty" },
    end_date: { type: "string", description: "ISO date YYYY-MM-DD or empty" },
  },
};

/** Reads a maintenance agreement/contract document and returns its key details for review. */
export const extractContractDetails = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ documentId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const text = await readDocument(
      context.supabase as never, data.documentId,
      "This document is a maintenance agreement or contract. Extract its key details. Use 0 for numbers and empty strings for text you cannot find. Dates must be ISO YYYY-MM-DD.",
      { name: "contract", schema: CONTRACT_SCHEMA },
    );
    const j = JSON.parse(text) as Record<string, string | number>;
    const iso = (v: unknown) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : "");
    const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);
    return {
      name: String(j.name ?? "").slice(0, 120),
      client_name: String(j.client_name ?? "").slice(0, 200),
      contract_category: String(j.contract_category ?? "").slice(0, 80),
      tier: String(j.tier ?? "").slice(0, 40),
      visits_per_year: num(j.visits_per_year),
      annual_price: num(j.annual_price),
      labour_discount_pct: num(j.labour_discount_pct),
      parts_discount_pct: num(j.parts_discount_pct),
      start_date: iso(j.start_date),
      end_date: iso(j.end_date),
    };
  });
