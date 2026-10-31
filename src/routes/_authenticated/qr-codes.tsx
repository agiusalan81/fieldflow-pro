import { useTerminology } from "@/lib/company";
import { useMemo, useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AppShell, EmptyState } from '@/components/app-shell';
import { EquipmentQr } from '@/components/equipment-qr';
import { NativeSelect } from '@/components/ui/native-select';
import { Input } from '@/components/ui/input';
import { isManager, useProfile } from '@/lib/profile';
import { StorePlaques } from '@/components/store-plaques';

export const Route = createFileRoute('/_authenticated/qr-codes')({ staticData: { sitemap: false },
  validateSearch:(s:Record<string,unknown>)=>({site:typeof s['site']==='string'?s['site']:'',assets:typeof s['assets']==='string'?s['assets']:''}),
  head: () => ({ meta: [
    { title: 'QR code generator — FieldBridgeApp' },
    { name: 'description', content: 'Create branded equipment QR stickers for technical data and fault reporting.' },
    { property: 'og:title', content: 'QR code generator — FieldBridgeApp' },
    { property: 'og:description', content: 'Branded equipment QR stickers with your company logo.' },
    { property: 'og:type', content: 'website' },
    { name: 'twitter:card', content: 'summary' },
  ] }),
  component: QrPage,
});

type Asset = { id: string; reference_number: string; asset_category: string | null; site_id: string | null; sites: { name: string | null; client_id: string | null; clients: { name: string | null } | null } | null };

function QrPage() {
  const filter=Route.useSearch();
  const word = useTerminology();
  const { data: p } = useProfile();
  const [client, setClient] = useState('');
  const [site, setSite] = useState(filter.site);
  const [q, setQ] = useState('');
  const assets = useQuery({
    queryKey: ['qr-generator-assets'],
    enabled: isManager(p),
    queryFn: async () => {
      const r = await supabase.from('assets').select('id,reference_number,asset_category,site_id,sites(name,client_id,clients(name))').order('reference_number');
      if (r.error) throw r.error;
      return r.data as unknown as Asset[];
    },
  });
  const all = assets.data ?? [];
  const clients = useMemo(() => [...new Map(all.filter(a => a.sites?.client_id).map(a => [a.sites!.client_id!, a.sites?.clients?.name ?? 'Client'])).entries()], [all]);
  const sites = useMemo(() => [...new Map(all.filter(a => a.site_id && (!client || a.sites?.client_id === client)).map(a => [a.site_id!, a.sites?.name ?? 'Site'])).entries()], [all, client]);
  const ids=filter.assets?new Set(filter.assets.split(',')):null;
  const list = all.filter(a => (!ids||ids.has(a.id))&&(!client || a.sites?.client_id === client) && (!site || a.site_id === site) && (!q || a.reference_number.toLowerCase().includes(q.toLowerCase())));
  if (p && !isManager(p)) return <AppShell title="QR code generator"><EmptyState>Only supervisors and office staff can create QR stickers.</EmptyState></AppShell>;
  return (
    <AppShell title="QR code generator">
      <div className="mx-auto max-w-4xl space-y-5">
        <StorePlaques />

        <div className="grid gap-3 sm:grid-cols-3">
          <NativeSelect aria-label="Client" value={client} onValueChange={v => { setClient(v); setSite(""); }}>
            <option value="">All clients</option>{clients.map(([id, n]) => <option key={id} value={id}>{n}</option>)}
          </NativeSelect>
          <NativeSelect aria-label="Site" value={site} onValueChange={setSite}>
            <option value="">All sites</option>{sites.map(([id, n]) => <option key={id} value={id}>{n}</option>)}
          </NativeSelect>
          <Input aria-label={`Search ${word("equipment").toLowerCase()}`} placeholder="Search reference…" value={q} onChange={e => setQ(e.target.value)} />
        </div>
        {assets.isPending ? <p>Loading {word("equipment").toLowerCase()}…</p> : assets.error ? <p role="alert" className="text-destructive">Could not load {word("equipment").toLowerCase()}.</p> : !list.length ? <EmptyState>No {word("equipment").toLowerCase()} matches.</EmptyState> : (
          <ul className="divide-y rounded-lg border bg-card">
            {list.map(a => (
              <li key={a.id} className="flex items-center justify-between gap-3 p-3">
                <div className="min-w-0"><p className="truncate font-medium">{a.reference_number}</p><p className="truncate text-xs text-muted-foreground">{[a.asset_category, a.sites?.clients?.name, a.sites?.name].filter(Boolean).join(' · ')}</p></div>
                <EquipmentQr assetId={a.id} reference={a.reference_number} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </AppShell>
  );
}
