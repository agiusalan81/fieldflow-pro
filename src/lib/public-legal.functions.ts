import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
export type PublicLegal = { legal_name: string; registration_number: string; vat_number: string; registered_address: string; country: string; privacy_email: string };
export const getPublicLegal = createServerFn({ method: "GET" }).handler(async (): Promise<{ profile: PublicLegal | null; unavailable: boolean }> => {
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
  const url = process.env["SUPABASE_URL"];
  if (!key || !url) return { profile: null, unavailable: true };
  try {
    const client = createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: (input, init) => {
      const headers = new Headers(init?.headers);
      if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) headers.delete("Authorization");
      headers.set("apikey", key);
      return fetch(input, { ...init, headers, signal: AbortSignal.timeout(8000) });
    } } });
    const { data, error } = await client.rpc("fieldbridge_public_legal");
    if (error) return { profile: null, unavailable: true };
    if (!data || typeof data !== "object" || Array.isArray(data)) return { profile: null, unavailable: false };
    const value = (key: string) => typeof data[key] === "string" ? data[key] as string : "";
    return { profile: { legal_name: value("legal_name"), registration_number: value("registration_number"), vat_number: value("vat_number"), registered_address: value("registered_address"), country: value("country"), privacy_email: value("privacy_email") }, unavailable: false };
  } catch { return { profile: null, unavailable: true }; }
});