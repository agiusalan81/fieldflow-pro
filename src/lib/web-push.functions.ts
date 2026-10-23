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

type Alert = { title: string; body: string; url: string; tag: string };
type Sub = { endpoint: string; p256dh: string; auth: string };

/** Sends sender name + message preview, end-to-end encrypted to each device. */
export const sendChatPush = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ messageIds: z.array(z.string().uuid()).min(1).max(20) }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: msgs } = await supabase.from("internal_messages").select("id,receiver_id,job_sheet_id,message_text,attachments,contact_card").in("id", data.messageIds).eq("sender_id", userId);
    const { data: me } = await supabase.from("users").select("full_name").eq("id", userId).maybeSingle();
    const who = me?.full_name ?? "FieldBridge";
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let sent = 0;
    for (const m of msgs ?? []) {
      const recipients = new Set<string>();
      let thread: string;
      if (m.receiver_id) { recipients.add(m.receiver_id); thread = `user:${userId}`; }
      else if (m.job_sheet_id) {
        thread = `job:${m.job_sheet_id}`;
        const [{ data: sheet }, { data: posters }] = await Promise.all([
          supabase.from("job_sheets").select("assigned_technician_id").eq("id", m.job_sheet_id).maybeSingle(),
          supabase.from("internal_messages").select("sender_id").eq("job_sheet_id", m.job_sheet_id).is("receiver_id", null).limit(200),
        ]);
        if (sheet?.assigned_technician_id) recipients.add(sheet.assigned_technician_id);
        for (const p of posters ?? []) recipients.add(p.sender_id);
      } else continue;
      recipients.delete(userId);
      if (!recipients.size) continue;
      const text = String(m.message_text ?? "").trim();
      const alert: Alert = {
        title: m.job_sheet_id && !m.receiver_id ? `${who} · job thread` : who,
        body: m.contact_card ? "Sent a contact" : Array.isArray(m.attachments) && m.attachments.length ? "Sent an attachment" : text ? (text.length > 120 ? `${text.slice(0, 120)}…` : text) : "Sent an attachment",
        url: `/messages?thread=${encodeURIComponent(thread)}`, tag: thread,
      };
      const { data: subs } = await supabaseAdmin.from("push_subscriptions").select("endpoint,p256dh,auth").in("user_id", [...recipients]);
      sent += await deliver(supabaseAdmin, (subs ?? []) as Sub[], alert);
    }
    return { sent };
  });

const cat = (...a: Uint8Array[]) => { const o = new Uint8Array(a.reduce((n, x) => n + x.length, 0)); let i = 0; for (const x of a) { o.set(x, i); i += x.length; } return o; };
const unb64 = (s: string) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4)), (c) => c.charCodeAt(0));
async function hmac(key: Uint8Array, msg: Uint8Array) {
  const k = await crypto.subtle.importKey("raw", key as BufferSource, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", k, msg as BufferSource));
}

/** RFC 8291 aes128gcm encryption of a push payload. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function encrypt(p256: any, sub: Sub, plain: Uint8Array) {
  const enc = new TextEncoder();
  const uaPub = unb64(sub.p256dh), authSecret = unb64(sub.auth);
  const asPriv = p256.utils.randomSecretKey() as Uint8Array;
  const asPub = p256.getPublicKey(asPriv, false) as Uint8Array;
  const shared = (p256.getSharedSecret(asPriv, uaPub, false) as Uint8Array).slice(1, 33);
  const prkKey = await hmac(authSecret, shared);
  const ikm = await hmac(prkKey, cat(enc.encode("WebPush: info\0"), uaPub, asPub, new Uint8Array([1])));
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const prk = await hmac(salt, ikm);
  const cek = (await hmac(prk, cat(enc.encode("Content-Encoding: aes128gcm\0"), new Uint8Array([1])))).slice(0, 16);
  const nonce = (await hmac(prk, cat(enc.encode("Content-Encoding: nonce\0"), new Uint8Array([1])))).slice(0, 12);
  const key = await crypto.subtle.importKey("raw", cek as BufferSource, "AES-GCM", false, ["encrypt"]);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce as BufferSource }, key, cat(plain, new Uint8Array([2])) as BufferSource));
  return cat(salt, new Uint8Array([0, 0, 16, 0]), new Uint8Array([65]), asPub, ct);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function deliver(supabaseAdmin: any, subs: Sub[], alert: Alert) {
    const { p256, d, pub } = await vapidKeys();
    const enc = new TextEncoder();
    const payload = enc.encode(JSON.stringify(alert));
    let sent = 0;
    await Promise.all(subs.map(async (s) => {
      const { endpoint } = s;
      const head = b64url(enc.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
      const body = b64url(enc.encode(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(Date.now() / 1000) + 43200, sub: "mailto:support@fieldbridgeapp.com" })));
      const raw = p256.sign(enc.encode(`${head}.${body}`), d) as unknown as Uint8Array | { toBytes: (f: string) => Uint8Array };
      const sig = b64url(raw instanceof Uint8Array ? raw : raw.toBytes("compact"));
      try {
        const bodyBytes = await encrypt(p256, s, payload);
        const res = await fetch(endpoint, { method: "POST", signal: AbortSignal.timeout(15000), headers: { Authorization: `vapid t=${head}.${body}.${sig}, k=${b64url(pub)}`, TTL: "86400", Urgency: "high", "Content-Encoding": "aes128gcm", "Content-Type": "application/octet-stream" }, body: bodyBytes as BodyInit });
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
  .inputValidator((i) => z.object({ endpoint: z.string().url().max(1000), delaySeconds: z.number().int().min(0).max(10).default(0) }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: subs, error } = await supabaseAdmin.from("push_subscriptions").select("endpoint,p256dh,auth").eq("user_id", context.userId).eq("endpoint", data.endpoint);
    if (error) throw new Error("Could not check this device's notification registration");
    const devices = subs?.length ?? 0;
    if (devices && data.delaySeconds) await new Promise(resolve => setTimeout(resolve, data.delaySeconds * 1000));
    const sent = devices ? await deliver(supabaseAdmin, subs as Sub[], { title: "FieldBridge test", body: "Your phone received the FieldBridge test alert.", url: "/messages", tag: "fb-test" }) : 0;
    return { devices, sent };
  });
