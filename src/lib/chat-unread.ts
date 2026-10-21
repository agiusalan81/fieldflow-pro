import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type ChatMsg = { sender_id: string; receiver_id: string | null; job_sheet_id: string | null; created_at: string };

/** Thread a message belongs to, from the viewer's side: "user:<other>" or "job:<sheet>". */
export function threadKeyOf(m: ChatMsg, me: string): string | null {
  if (m.job_sheet_id && !m.receiver_id) return `job:${m.job_sheet_id}`;
  if (m.job_sheet_id) return null;
  if (m.receiver_id === me) return `user:${m.sender_id}`;
  if (m.sender_id === me && m.receiver_id) return `user:${m.receiver_id}`;
  return null;
}

/** Unread = messages from others newer than the viewer's last read time for that thread. */
export function unreadByThread(msgs: ChatMsg[], reads: Record<string, string>, me: string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const m of msgs) {
    if (m.sender_id === me) continue;
    const k = threadKeyOf(m, me);
    if (!k) continue;
    const r = reads[k];
    if (r && new Date(m.created_at) <= new Date(r)) continue;
    out[k] = (out[k] ?? 0) + 1;
  }
  return out;
}

export function useChatReads(uid?: string) {
  return useQuery({
    queryKey: ["chat-reads", uid],
    enabled: !!uid,
    queryFn: async () => {
      const { data, error } = await supabase.from("chat_reads").select("thread_key,last_read_at");
      if (error) throw error;
      return Object.fromEntries((data ?? []).map((r) => [r.thread_key, r.last_read_at])) as Record<string, string>;
    },
  });
}

export function useUnreadChatTotal(uid?: string) {
  const reads = useChatReads(uid);
  const msgs = useQuery({
    queryKey: ["messages-unread", uid],
    enabled: !!uid,
    refetchInterval: 30000,
    queryFn: async () => {
      const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
      const { data, error } = await supabase.from("internal_messages").select("sender_id,receiver_id,job_sheet_id,created_at").neq("sender_id", uid!).gte("created_at", since);
      if (error) throw error;
      return data as ChatMsg[];
    },
  });
  if (!uid || !reads.data || !msgs.data) return 0;
  return Object.values(unreadByThread(msgs.data, reads.data, uid)).reduce((a, b) => a + b, 0);
}

export async function markThreadRead(uid: string, key: string) {
  await supabase.from("chat_reads").upsert({ user_id: uid, thread_key: key, last_read_at: new Date().toISOString() });
}
