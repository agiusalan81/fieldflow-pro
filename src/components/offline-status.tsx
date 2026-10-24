import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { WifiOff, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { pendingDrafts, restoreOfflineCache, persistOfflineCache, syncPending, type DraftSnapshot } from "@/lib/offline";
import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";
import { DiscardOfflineDraft } from "@/components/discard-offline-draft";
export function OfflineStatus() {
  const [expanded,setExpanded]=useState(false);
  const qc = useQueryClient();
  const [online, setOnline] = useState(true); const [drafts, setDrafts] = useState<DraftSnapshot[]>([]); const [userId, setUserId] = useState<string | null>(null);
  useEffect(() => {
    let active = true; let timer: ReturnType<typeof setTimeout> | undefined;
    const update = async () => {
      setOnline(navigator.onLine);
      const { data } = await supabase.auth.getSession(); const id = data.session?.user.id;
      if (!active) return;
      setUserId(id ?? null); setDrafts(id ? await pendingDrafts(id) : []);
    };
    void supabase.auth.getSession().then(async ({ data }) => {
      if (data.session?.user.id) await restoreOfflineCache(data.session.user.id, qc);
      await update();
      if (data.session?.user.id && navigator.onLine) await syncPending(data.session.user.id, qc);
    }).catch(() => {});
    const changed = () => { void update().catch(() => {}); };
    const reconnect = () => { changed(); void supabase.auth.getSession().then(({ data }) => data.session?.user.id ? syncPending(data.session.user.id, qc) : undefined).catch(() => {}); };
    window.addEventListener("online", reconnect); window.addEventListener("offline", changed); window.addEventListener("fieldops-offline", changed);
    const unsubscribe = qc.getQueryCache().subscribe(() => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => { void supabase.auth.getSession().then(({ data }) => data.session?.user.id ? persistOfflineCache(data.session.user.id, qc) : undefined).catch(() => {}); }, 500);
    });
    return () => { active = false; if (timer) clearTimeout(timer); unsubscribe(); window.removeEventListener("online", reconnect); window.removeEventListener("offline", changed); window.removeEventListener("fieldops-offline", changed); };
  }, [qc]);
  if (online && !drafts.length) return null;
  return <aside className="sticky top-0 z-50 border-b bg-background p-2 text-center text-sm" aria-live="polite">
    {!online && <span className="inline-flex items-center gap-2"><WifiOff className="h-4 w-4" />Offline — save changes on this device</span>}
    {drafts.length > 0 && <Button variant="ghost" size="sm" onClick={()=>setExpanded(!expanded)}>{drafts.length} job sheet{drafts.length===1?"":"s"} saved on this device{drafts.some(d=>d.error)?" · needs attention":" · upload pending"}</Button>}
    {expanded && online && userId && <Button size="sm" variant="ghost" onClick={() => syncPending(userId, qc)}><RefreshCw className="mr-1 h-4 w-4" />Sync</Button>}
    {expanded && drafts.map((d) => <div key={d.key} className="flex flex-wrap items-center justify-center gap-2"><span className={d.error ? "text-destructive" : "text-muted-foreground"}>{d.error}</span><Link className="underline" to="/sheets/$sheetId" params={{ sheetId: d.sheetId }}>Review draft</Link><DiscardOfflineDraft userId={d.userId} sheetId={d.sheetId} /></div>)}
  </aside>;
}