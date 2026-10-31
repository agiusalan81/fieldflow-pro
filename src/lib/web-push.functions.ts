import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {brandedPushPayload} from '@/lib/notification-brand';

export const getPushPublicKey = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => { const {vapidKeys}=await import("@/lib/web-push-delivery.server"); const pub=(await vapidKeys()).pub; return {key:btoa(String.fromCharCode(...pub)).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"")}; });

export const savePushSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ endpoint: z.string().url().startsWith("https://").max(1000), p256dh: z.string().min(10).max(200), auth: z.string().min(8).max(100) }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // A device moves to whoever signed in on it last.
    const { error } = await supabaseAdmin.from("push_subscriptions").upsert({ ...data, user_id: context.userId, updated_at: new Date().toISOString() }, { onConflict: "endpoint" });
    if (error) throw new Error("Could not save notification settings");
    return { ok: true };
  });

type Alert = { title: string; body: string; url: string; tag: string };

/** Lock-screen-ready payload read by public/push-sw.js. */
export function pushPayload(a: Alert,edition:unknown='contractor') {return brandedPushPayload(a,edition);}
type Sub = { endpoint: string; p256dh: string; auth: string };

/** Sends sender name + message preview, end-to-end encrypted to each device. */
export const sendChatPush = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ messageIds: z.array(z.string().uuid()).min(1).max(20) }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: msgs } = await supabase.from("internal_messages").select("id,receiver_id,job_sheet_id,channel_id,message_text,attachments,contact_card").in("id", data.messageIds).eq("sender_id", userId);
    const { data: me } = await supabase.from("users").select("full_name").eq("id", userId).maybeSingle();
    const who = me?.full_name ?? "FieldBridge";
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { deliver } = await import("@/lib/web-push-delivery.server");
    let sent = 0;
    for (const m of msgs ?? []) {
      const recipients = new Set<string>();
      let thread: string;
      if (m.receiver_id) { recipients.add(m.receiver_id); thread = `user:${userId}`; }
      else if (m.channel_id) { thread = `channel:${m.channel_id}`; const r = await supabase.rpc("chat_channel_recipients", {_channel:m.channel_id}); for(const member of r.data??[])recipients.add(member.user_id); }
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

/** Lock-screen alert to clocked-in field staff when a job is posted as open to claim. */
export const notifyOpenJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ jobId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const {data: allowed} = await supabase.rpc("member_dispatch_can");
    if (!allowed) throw new Error("Dispatch access required");
    const { data: me } = await supabase.from("users").select("company_id, role").eq("id", userId).maybeSingle();
    if (!me) throw new Error("Only office staff and supervisors can announce open jobs");
    const { data: job } = await supabase.from("jobs").select("id, job_number, open_to_claim, clients(name), sites(name)").eq("id", data.jobId).eq("company_id", me.company_id).maybeSingle();
    if (!job?.open_to_claim) return { sent: 0 };
    // Only currently clocked-in field staff are alerted; off-shift devices stay quiet.
    const {data: eligible, error: recipientError} = await supabase.rpc('open_job_recipients',{_job:data.jobId});
    if(recipientError)throw new Error('Open-job recipients could not be checked');
    const recipients = [...new Set((eligible??[]).map(s=>s.user_id).filter(id=>id!==userId))];
    if (!recipients.length) return { sent: 0 };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { deliver } = await import("@/lib/web-push-delivery.server");
    const { data: subs } = await supabaseAdmin.from("push_subscriptions").select("endpoint,p256dh,auth").in("user_id", recipients);
    const where = [job.clients?.name, job.sites?.name].filter(Boolean).join(" · ");
    const sent = await deliver(supabaseAdmin, (subs ?? []) as Sub[], {
      title: `Job #${job.job_number} up for grabs`,
      body: `${where || "New open job"} — first to claim gets the place. Tap to view.`,
      url: `/available-jobs?job=${job.id}`, tag: `open-job:${job.id}`,
    });
    return { sent };
  });

/** Sends a test alert to the caller's own devices. */
export const sendTestPush = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ endpoint: z.string().url().max(1000), delaySeconds: z.number().int().min(0).max(10).default(0) }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { deliver } = await import("@/lib/web-push-delivery.server");
    const { data: subs, error } = await supabaseAdmin.from("push_subscriptions").select("endpoint,p256dh,auth").eq("user_id", context.userId).eq("endpoint", data.endpoint);
    if (error) throw new Error("Could not check this device's notification registration");
    const devices = subs?.length ?? 0;
    if (devices && data.delaySeconds) await new Promise(resolve => setTimeout(resolve, data.delaySeconds * 1000));
    const sent = devices ? await deliver(supabaseAdmin, subs as Sub[], { title: "FieldBridge test", body: "Your phone received the FieldBridge test alert.", url: "/messages", tag: "fb-test" }) : 0;
    return { devices, sent };
  });

/** Lead board alerts: pushes each lead event to the company's CRM managers and the lead owner, deep-linked to the lead. */
export const notifyLeadPush = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ leadId: z.string().uuid(), event: z.string().min(1).max(80) }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // RLS confirms the caller can see this lead before anyone is alerted.
    const { data: lead } = await supabase.from("crm_opportunities").select("id,title,company_id,owner_id").eq("id", data.leadId).maybeSingle();
    if (!lead) return { sent: 0 };
    const { data: me } = await supabase.from("users").select("full_name").eq("id", userId).maybeSingle();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { deliver } = await import("@/lib/web-push-delivery.server");
    const { data: roles } = await supabaseAdmin.from("user_roles").select("user_id,role,registration_status").eq("company_id", lead.company_id).eq("registration_status", "active");
    const recipients = new Set((roles ?? []).filter((r) => ["superuser", "admin", "supervisor"].includes(r.role as string)).map((r) => r.user_id as string));
    if (lead.owner_id && (roles ?? []).some((r) => r.user_id === lead.owner_id)) recipients.add(lead.owner_id);
    recipients.delete(userId);
    if (!recipients.size) return { sent: 0 };
    const { data: subs } = await supabaseAdmin.from("push_subscriptions").select("endpoint,p256dh,auth").in("user_id", [...recipients]);
    const sent = await deliver(supabaseAdmin, (subs ?? []) as Sub[], {
      title: `Lead · ${data.event}`,
      body: `${lead.title}${me?.full_name ? ` — by ${me.full_name}` : ""}`,
      url: `/crm?lead=${lead.id}`, tag: `lead:${lead.id}`,
    });
    return { sent };
  });
