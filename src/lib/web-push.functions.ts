import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const b64url = (b: Uint8Array) => btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

/** Derives the app's push signing key pair from the WEB_PUSH_SEED secret (server only). */
async function vapidKeys() {
  const seed = process.env["WEB_PUSH_SEED"];
  if (!seed) throw new Error("Push notifications are not configured");
  const { p256 } = await import("@noble/curves/nist.js");
  let d = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(seed)));
  while (!p256.utils.isValidSecretKey(d)) d = new Uint8Array(await crypto.subtle.digest("SHA-256", d));
  return { p256, d, pub: p256.getPublicKey(d, false) };
}

export const getPushPublicKey = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => ({ key: b64url((await vapidKeys()).pub) }));

export const savePushSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ endpoint: z.string().url().startsWith("https://").max(1000), p256dh: z.string().min(10).max(200), auth: z.string().min(8).max(100) }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // A device moves to whoever signed in on it last.
    const { error } = await supabaseAdmin.from("push_subscriptions").upsert({ ...data, user_id: context.userId }, { onConflict: "endpoint" });
    if (error) throw new Error("Could not save notification settings");
    return { ok: true };
  });

/** Wakes recipients' devices for messages the caller just sent. The device shows a generic alert; no message text leaves the app. */
export const sendChatPush = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ messageIds: z.array(z.string().uuid()).min(1).max(20) }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: msgs } = await supabase.from("internal_messages").select("id,receiver_id,job_sheet_id").in("id", data.messageIds).eq("sender_id", userId);
    const recipients = new Set<string>();
    for (const m of msgs ?? []) {
      if (m.receiver_id) { recipients.add(m.receiver_id); continue; }
      if (!m.job_sheet_id) continue;
      const [{ data: sheet }, { data: posters }] = await Promise.all([
        supabase.from("job_sheets").select("assigned_technician_id").eq("id", m.job_sheet_id).maybeSingle(),
        supabase.from("internal_messages").select("sender_id").eq("job_sheet_id", m.job_sheet_id).is("receiver_id", null).limit(200),
      ]);
      if (sheet?.assigned_technician_id) recipients.add(sheet.assigned_technician_id);
      for (const p of posters ?? []) recipients.add(p.sender_id);
    }
    recipients.delete(userId);
    if (!recipients.size) return { sent: 0 };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: subs } = await supabaseAdmin.from("push_subscriptions").select("endpoint").in("user_id", [...recipients]);
    const sent = await deliver(supabaseAdmin, (subs ?? []).map((x) => x.endpoint));
    return { sent };
  });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function deliver(supabaseAdmin: any, endpoints: string[]) {
  const subs = endpoints.map((endpoint) => ({ endpoint }));
    const { p256, d, pub } = await vapidKeys();
    const enc = new TextEncoder();
    let sent = 0;
    await Promise.all(subs.map(async ({ endpoint }) => {
      const head = b64url(enc.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
      const body = b64url(enc.encode(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(Date.now() / 1000) + 43200, sub: "mailto:support@fieldbridgeapp.com" })));
      const raw = p256.sign(enc.encode(`${head}.${body}`), d) as unknown as Uint8Array | { toBytes: (f: string) => Uint8Array };
      const sig = b64url(raw instanceof Uint8Array ? raw : raw.toBytes("compact"));
      try {
        const res = await fetch(endpoint, { method: "POST", headers: { Authorization: `vapid t=${head}.${body}.${sig}, k=${b64url(pub)}`, TTL: "86400", Urgency: "high", "Content-Length": "0" } });
        if (res.status === 404 || res.status === 410) await supabaseAdmin.from("push_subscriptions").delete().eq("endpoint", endpoint);
        else if (res.ok) sent++;
        else console.error("push failed", res.status);
      } catch (e) { console.error("push error", e); }
    }));
  return sent;
}

/** Sends a test alert to the caller's own devices. */
export const sendTestPush = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: subs } = await supabaseAdmin.from("push_subscriptions").select("endpoint").eq("user_id", context.userId);
    const devices = subs?.length ?? 0;
    const sent = devices ? await deliver(supabaseAdmin, subs!.map((x) => x.endpoint)) : 0;
    return { devices, sent };
  });
