import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { validateDraft, type WaDraft } from "./whatsapp-templates";

const WA = "https://connector-gateway.lovable.dev/whatsapp";

async function assertManager(supabase: { rpc: (fn: "is_company_manager") => PromiseLike<{ data: unknown }> }) {
  const { data } = await supabase.rpc("is_company_manager");
  if (!data) throw new Error("Only office admins and supervisors can manage WhatsApp templates.");
}

function waHeaders() {
  const a = process.env.LOVABLE_API_KEY, w = process.env.WHATSAPP_API_KEY;
  if (!a || !w) throw new Error("WhatsApp is not connected.");
  return { Authorization: `Bearer ${a}`, "X-Connection-Api-Key": w, "Content-Type": "application/json" };
}

const SCHEMA = {
  type: "object", additionalProperties: false,
  required: ["name", "body", "examples", "notes"],
  properties: {
    name: { type: "string", description: "lowercase snake_case template name" },
    body: { type: "string", description: "template body using {{1}}, {{2}}… in order" },
    examples: { type: "array", items: { type: "string" }, description: "one realistic sample per placeholder, in order" },
    notes: { type: "string", description: "one or two plain-language sentences for office staff about what changed" },
  },
};

const SYSTEM = `You turn office staff wording into a WhatsApp Business message template that Meta will approve.
Rules: keep the staff's meaning, tone and language (do not translate). Replace anything that changes per message (names, technician, times, site, job number, dates, phone, amounts) with numbered placeholders {{1}}, {{2}}… used in order, each once. Never start or end the body with a placeholder. Write full sentences: at least 3 real words per placeholder plus a few more. Max 1024 characters, no more than one emoji, no URLs unless the staff gave one, no promotional language for UTILITY. Give a realistic sample value for every placeholder. Name: short lowercase snake_case describing the purpose.`;

export const draftWhatsAppTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ wording: z.string().trim().min(5).max(2000), type: z.string().max(80), category: z.enum(["UTILITY", "MARKETING"]), language: z.string().max(10) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertManager(context.supabase as never);
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("AI is not configured.");
    const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: { "Lovable-API-Key": key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", "X-Lovable-AIG-SDK": "fetch" },
      body: JSON.stringify({
        model: "openai/gpt-6-astra", stream: true, store: false,
        reasoning: { effort: "low" },
        instructions: SYSTEM,
        input: `Message type: ${data.type}\nCategory: ${data.category}\nLanguage code: ${data.language}\nStaff wording:\n${data.wording}`,
        text: { format: { type: "json_schema", name: "wa_template", strict: true, schema: SCHEMA } },
      }),
    });
    if (!res.ok || !res.body) {
      const t = await res.text();
      console.error(`AI draft failed [${res.status}]: ${t}`);
      if (res.status === 429) throw new Error("The AI is busy right now. Please try again in a minute.");
      if (res.status === 402) throw new Error("AI credits have run out. Add credits in Settings → Plans & credits.");
      throw new Error(`AI draft failed (${res.status}).`);
    }
    const reader = res.body.getReader(); const dec = new TextDecoder();
    let buf = "", out = "", done = "";
    for (;;) {
      const { value, done: end } = await reader.read();
      if (end) break;
      buf += dec.decode(value, { stream: true });
      let i;
      while ((i = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
        if (!line.startsWith("data:")) continue;
        const p = line.slice(5).trim(); if (!p || p === "[DONE]") continue;
        try {
          const ev = JSON.parse(p);
          if (ev.type === "response.output_text.delta") out += ev.delta ?? "";
          else if (ev.type === "response.output_text.done") done = ev.text ?? "";
          else if (ev.type === "response.failed" || ev.type === "error") throw new Error(ev.response?.error?.message ?? ev.message ?? "AI draft failed.");
        } catch (e) { if (e instanceof SyntaxError) continue; throw e; }
      }
    }
    const text = done || out;
    if (!text) throw new Error("The AI didn't return a draft. Try rewording your message.");
    const j = JSON.parse(text) as Omit<WaDraft, "language" | "category">;
    const draft: WaDraft = { ...j, name: j.name.toLowerCase().replace(/[^a-z0-9_]/g, "_").slice(0, 60), language: data.language, category: data.category };
    return { draft, problems: validateDraft(draft) };
  });

export const submitWhatsAppTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ name: z.string(), language: z.string(), category: z.enum(["UTILITY", "MARKETING"]), body: z.string(), examples: z.array(z.string()), notes: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertManager(context.supabase as never);
    const problems = validateDraft(data);
    if (problems.length) throw new Error(problems[0]);
    const comp: Record<string, unknown> = { type: "BODY", text: data.body };
    if (data.examples.length) comp.example = { body_text: [data.examples] };
    const res = await fetch(`${WA}/message_templates`, { method: "POST", headers: waHeaders(), body: JSON.stringify({ name: data.name, language: data.language, category: data.category, components: [comp] }) });
    const t = await res.text();
    if (!res.ok) {
      console.error(`Template submit failed [${res.status}]: ${t}`);
      let msg = t; try { const e = JSON.parse(t).error; msg = e?.error_user_msg || e?.message || t; } catch { /* keep raw */ }
      throw new Error(`Meta rejected the template: ${msg}`);
    }
    const j = JSON.parse(t) as { id?: string; status?: string };
    return { id: j.id ?? null, status: j.status ?? "PENDING" };
  });

export const listWhatsAppTemplates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertManager(context.supabase as never);
    const res = await fetch(`${WA}/message_templates?limit=100&fields=name,status,language,category,components`, { headers: waHeaders() });
    const t = await res.text();
    if (!res.ok) { console.error(`Template list failed [${res.status}]: ${t}`); throw new Error(`Couldn't load templates from Meta (${res.status}).`); }
    const j = JSON.parse(t) as { data: { name: string; status: string; language: string; category: string; components?: { type: string; text?: string }[] }[] };
    return j.data.map((x) => ({ name: x.name, status: x.status, language: x.language, category: x.category, body: x.components?.find((c) => c.type === "BODY")?.text ?? "" }));
  });
