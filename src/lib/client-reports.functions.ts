import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

async function hashToken(token: string) { return [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token)))].map((x) => x.toString(16).padStart(2, "0")).join(""); }

export const createClientReport = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ sheetId: z.string().uuid(), expiresInDays: z.number().int().min(1).max(365).default(90) }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: manager } = await context.supabase.rpc("is_company_manager");
    if (!manager) throw new Error("Only office staff can share client reports");
    const { data: sheet, error } = await context.supabase.from("job_sheets").select("id,company_id,status").eq("id", data.sheetId).single();
    if (error || !sheet || sheet.status !== "completed") throw new Error("Choose a completed company job sheet");
    const token = [...crypto.getRandomValues(new Uint8Array(32))].map((x) => x.toString(16).padStart(2, "0")).join("");
    const { error: writeError } = await context.supabase.from("client_reports").insert({ company_id: sheet.company_id, sheet_id: sheet.id, token_hash: await hashToken(token), snapshot: {}, expires_at: new Date(Date.now() + data.expiresInDays * 86400000).toISOString() });
    if (writeError) throw writeError;
    return { token };
  });

export const readClientReport = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ token: z.string().regex(/^[a-f0-9]{64}$/) }).parse(d))
  .handler(async ({ data }) => {
    const key = process.env["SUPABASE_PUBLISHABLE_KEY"]; const url = process.env["SUPABASE_URL"];
    if (!key || !url) throw new Error("Reports are temporarily unavailable");
    const client = createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: (input, init) => { const headers = new Headers(init?.headers); if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) headers.delete("Authorization"); headers.set("apikey", key); return fetch(input, { ...init, headers }); } } });
    const hash = await hashToken(data.token);
    const { data: snapshot, error } = await client.rpc("read_client_report", { _hash: hash });
    if (error) throw new Error("Reports are temporarily unavailable");
    if (!snapshot) return null;
    // The capability has now been verified by the database, including expiry and revocation.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: report } = await supabaseAdmin.from("client_reports").select("id").eq("token_hash", hash).is("revoked_at", null).gt("expires_at", new Date().toISOString()).maybeSingle();
    if (!report) return null;
    const { data: rows } = await supabaseAdmin.from("client_report_photos").select("photo_path,kind").eq("report_id", report.id);
    const photos = [];
    for (const p of rows ?? []) {
      const { data: file } = await supabaseAdmin.storage.from("job-photos").download(p.photo_path);
      if (!file) continue;
      const bytes = new Uint8Array(await file.arrayBuffer()); let binary = "";
      for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
      photos.push({ kind: p.kind, src: `data:${file.type || "image/jpeg"};base64,${btoa(binary)}` });
    }
    return { snapshot, photos };
  });