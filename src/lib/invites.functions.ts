import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";
import { withInviteTimeout } from "./invite-loading";

// Public token lookup deliberately avoids browser auth/storage locks.
export const getInvitation = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ token: z.string().min(1).max(200) }).parse(input))
  .handler(async ({ data }) => {
    const url = process.env["SUPABASE_URL"];
    const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
    if (!url || !key) throw new Error("Could not check your invitation. Please try again.");
    const client = createClient<Database>(url, key, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) headers.delete("Authorization");
        headers.set("apikey", key);
        return fetch(input, { ...init, headers });
      } },
    });
    const result = await withInviteTimeout(
      (signal) => client.rpc("get_invite", { _token: data.token }).abortSignal(signal),
      8_000,
    );
    if (result.error) throw new Error("Could not check your invitation. Please try again.");
    return result.data?.[0] ?? null;
  });