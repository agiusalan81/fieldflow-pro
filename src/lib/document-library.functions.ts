import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const PROMPT = `Extract the full text of this document exactly as written, preserving paragraph breaks and numbering.
Do not summarise, translate, correct or add anything. If the document is scanned, read it as accurately as you can.
Return only the document text, no commentary.`;

/** Reads a document from the company library and returns its text so office staff can use it as terms, presets, etc. */
export const extractDocumentText = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ documentId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase;
    const { data: mgr } = await supabase.rpc("is_company_manager");
    if (!mgr) throw new Error("Only office admins and supervisors can import documents.");

    const { data: doc, error } = await supabase
      .from("company_documents")
      .select("name, file_path")
      .eq("id", data.documentId)
      .maybeSingle();
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
        input: [{ role: "user", content: [{ type: "input_text", text: PROMPT }, filePart] }],
      }),
    });
    if (!res.ok || !res.body) {
      const t = await res.text();
      console.error(`Document extract failed [${res.status}]: ${t}`);
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
    return { text: text.slice(0, 20000), name: doc.name };
  });
