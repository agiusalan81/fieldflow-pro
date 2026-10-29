import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useProfile } from '@/lib/profile';
import { useNavLock } from '@/lib/plan-features';
import { alarmJobs, OPEN_JOB_ALARM_MS } from '@/lib/open-job-alarm';
import { playChime } from '@/lib/chime';

export function useOpenJobs() {
  const { data: p } = useProfile();
  const locked = useNavLock(!!p)('skills_dispatch').locked;
  const qc = useQueryClient();
  const [dismissed, setDismissed] = useState<ReadonlySet<string>>(new Set());
  useEffect(() => {
    const load = () => { try { setDismissed(new Set(JSON.parse(sessionStorage.getItem(`open-job-dismissed:${p?.id}`) ?? '[]'))); } catch { setDismissed(new Set()); } };
    load(); window.addEventListener('open-job-dismissed', load);
    return () => window.removeEventListener('open-job-dismissed', load);
  }, [p?.id]);
  const q = useQuery({ queryKey: ['open-jobs', p?.id], enabled: !!p && !locked, refetchInterval: 15000, queryFn: async () => { const r = await supabase.rpc('open_jobs_for_me'); if (r.error) throw r.error; return r.data ?? []; } });
  const dismiss = (id: string) => { const next = [...new Set([...dismissed, id])]; sessionStorage.setItem(`open-job-dismissed:${p?.id}`, JSON.stringify(next)); window.dispatchEvent(new Event('open-job-dismissed')); };
  useEffect(() => {
    if (!p || locked) return;
    const ch = supabase.channel(`open-jobs-${p.id}-${Math.random().toString(36).slice(2)}`).on('postgres_changes', {event:'*',schema:'public',table:'jobs'}, () => { void qc.invalidateQueries({queryKey:['open-jobs']}); }).on('postgres_changes', {event:'*',schema:'public',table:'shifts',filter:`user_id=eq.${p.id}`}, () => { void qc.invalidateQueries({queryKey:['open-jobs']}); }).subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [p?.id, locked, qc]);
  const bonuses=useQuery({queryKey:['open-job-bonuses',p?.id,q.dataUpdatedAt],enabled:!!p&&!locked,queryFn:async()=>{const r=await supabase.rpc('open_job_incentives');if(r.error)throw r.error;return r.data??[];}});
  const jobs = locked ? [] : (q.data ?? []).map(j=>({...j,claim_incentive_cents:bonuses.data?.find(b=>b.job_id===j.id)?.amount_cents??0}));
  return { ...q, jobs, alerting: alarmJobs(jobs, dismissed), dismissed, dismiss };
}

export function useGlobalOpenJobAlarm(uid: string) {
  const { alerting } = useOpenJobs();
  const lastPlayed = useRef(0);
  useEffect(() => { lastPlayed.current = 0; }, [uid]);
  const signature = alerting.map(j => j.id).sort().join(',');
  useEffect(() => {
    if (!signature) return;
    const tick = async () => {
      if (Date.now() - lastPlayed.current < OPEN_JOB_ALARM_MS) return;
      if (await playChime('urgent', uid)) lastPlayed.current = Date.now();
    };
    void tick();
    const timer = window.setInterval(() => void tick(), 1000);
    return () => window.clearInterval(timer);
  }, [signature, uid]);
}