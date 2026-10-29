const b64url = (b: Uint8Array) => btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

/** Derives the app's push signing key pair from the WEB_PUSH_SEED secret (server only). */
export async function vapidKeys() {
  const seed = process.env["WEB_PUSH_SEED"];
  if (!seed) throw new Error("Push notifications are not configured");
  const { p256 } = await import("@noble/curves/nist.js");
  let d = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(seed)));
  while (!p256.utils.isValidSecretKey(d)) d = new Uint8Array(await crypto.subtle.digest("SHA-256", d));
  return { p256, d, pub: p256.getPublicKey(d, false) };
}

export type Alert = { title: string; body: string; url: string; tag: string };

/** Lock-screen-ready payload read by public/push-sw.js. */
export function pushPayload(a: Alert) {
  return {
    title: a.title || "FieldBridge", body: a.body || "You have a new team chat message",
    icon: "/icon-192x192.png", badge: "/badge-72x72.png", tag: a.tag,
    data: { url: a.url, chatId: a.tag },
  };
}
type Sub = { endpoint: string; p256dh: string; auth: string };

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
export async function deliver(supabaseAdmin: any, subs: Sub[], alert: Alert) {
    const { p256, d, pub } = await vapidKeys();
    const enc = new TextEncoder();
    const payload = enc.encode(JSON.stringify(pushPayload(alert)));
    let sent = 0;
    for (let offset = 0; offset < subs.length; offset += 6) {
    await Promise.all(subs.slice(offset, offset + 6).map(async (s) => {
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
    }
  return sent;
}

