import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Eye } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { usePreviewProfile } from '@/lib/impersonation';

/** Observe the rendered card, never a background query or notification. */
export function JobSeenMarker({ jobId, disabled = false }: { jobId: string; disabled?: boolean }) {
  const ref = useRef<HTMLSpanElement>(null);
  const { data: profile, isPreview } = usePreviewProfile();
  useEffect(() => {
    const card = ref.current?.parentElement;
    if (!card || disabled || isPreview || !profile || !['technician', 'supervisor', 'maintenance'].includes(profile.real_role) && !profile.can_field_dispatch) return;
    let visible = false, done = false, busy = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const check = () => {
      if (timer) clearTimeout(timer);
      if (!visible || done || busy || document.visibilityState !== 'visible' || document.querySelector('[role="dialog"][data-state="open"], [role="alertdialog"]')) return;
      timer = setTimeout(async () => {
        busy = true;
        try {
          const r = await supabase.rpc('mark_job_seen', { _job: jobId });
          if (!r.error) done = true;
        } finally { busy = false; }
      }, 800);
    };
    const observer = new IntersectionObserver(([entry]) => {
      visible = !!entry?.isIntersecting && entry.intersectionRatio >= 0.5;
      check();
    }, { threshold: [0, 0.5] });
    observer.observe(card);
    document.addEventListener('visibilitychange', check);
    const retry = setInterval(check, 3000);
    return () => { observer.disconnect(); clearInterval(retry); if (timer) clearTimeout(timer); document.removeEventListener('visibilitychange', check); };
  }, [jobId, disabled, isPreview, profile?.id, profile?.real_role, profile?.can_field_dispatch]);
  return <span ref={ref} aria-hidden="true" className="hidden" />;
}

export function JobSeenReaders({ jobId, openToClaim = false }: { jobId: string; openToClaim?: boolean }) {
  const readers = useQuery({
    queryKey: ['job-seen', jobId], refetchInterval: 15000,
    queryFn: async () => { const r = await supabase.rpc('job_seen_readers', { _job: jobId }); if (r.error) throw r.error; return r.data; },
  });
  if (readers.isPending) return <p className="text-xs text-muted-foreground">Checking views…</p>;
  if (readers.isError) return <p className="text-xs text-muted-foreground">Views unavailable</p>;
  const current = (readers.data ?? []).filter(r => openToClaim || r.assigned);
  return <div className="space-y-1 text-xs text-muted-foreground">
    {!current.length ? <p>Not yet seen{openToClaim ? ' by field staff' : ' by assigned staff'}</p> : current.map(r => <p key={r.user_id} className="flex items-start gap-1"><Eye className="mt-0.5 h-3 w-3 shrink-0 text-primary" /><span className="break-words">Seen by {r.full_name} · {new Date(r.seen_at).toLocaleString('en-GB', { timeZone: 'Europe/Malta', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span></p>)}
  </div>;
}