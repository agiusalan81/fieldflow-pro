import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

type Incoming = { sender_id: string; receiver_id: string | null; job_sheet_id: string | null; message_text: string };

const preview = (t: string) => (t.length > 90 ? `${t.slice(0, 90)}…` : t);

/** Shows an in-app banner, plus a device notification when the tab is in the background and permission was given. */
export async function notifyChatMessage(m: Incoming, me: string) {
  const thread = m.job_sheet_id && !m.receiver_id ? `job:${m.job_sheet_id}` : m.receiver_id === me ? `user:${m.sender_id}` : null;
  if (!thread) return;
  const href = `/messages?thread=${encodeURIComponent(thread)}`;
  // Already reading this conversation — no banner needed.
  if (document.visibilityState === "visible" && location.pathname === "/messages" && new URLSearchParams(location.search).get("thread") === thread) return;
  const { data } = await supabase.from("users").select("full_name").eq("id", m.sender_id).maybeSingle();
  const who = data?.full_name ?? "New message";
  const title = m.job_sheet_id ? `${who} · job thread` : who;
  if (document.visibilityState === "visible") {
    toast(title, { description: preview(m.message_text), action: { label: "View", onClick: () => { location.href = href; } }, duration: 8000 });
    return;
  }
  if ("Notification" in window && Notification.permission === "granted") {
    const n = new Notification(title, { body: preview(m.message_text), icon: "/app-icon-192.png", tag: thread });
    n.onclick = () => { window.focus(); location.href = href; n.close(); };
  } else {
    toast(title, { description: preview(m.message_text), action: { label: "View", onClick: () => { location.href = href; } } });
  }
}

export const canAskNotifications = () => typeof window !== "undefined" && "Notification" in window && Notification.permission === "default";
