import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';

/** RLS validates office reads; the shared-token RPC validates public reads. No client-selected paths. */
export const resolveQuotePhotos = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ quoteId: z.string().uuid(), photoIds: z.array(z.string().uuid()).max(10).optional() }).parse(input))
  .handler(async ({ data, context }) => {
    const quote = await context.supabase.from('customer_quotes').select('data,snapshot').eq('id', data.quoteId).maybeSingle();
    const manager = await context.supabase.rpc('member_commercial_can', { _area: 'estimates' });
    if (manager.error || !manager.data) throw new Error('Estimates & quotes capability required');
    const stored = quote.data?.snapshot ?? quote.data?.data;
    const raw = stored as { document?: { photos?: { id: string }[] }; photos?: { id: string }[] } | null;
    const ids = data.photoIds ?? (raw?.document?.photos ?? raw?.photos ?? []).map(p => p.id);
    if (!ids.length) return {};
    const photos = await context.supabase.from('customer_quote_photos').select('id,storage_path').in('id', ids);
    if (photos.error) throw new Error('Photos unavailable');
    const entries = await Promise.all((photos.data ?? []).map(async p => {
      const result = await context.supabase.storage.from('quote-photos').createSignedUrl(p.storage_path, 600);
      if (result.error) throw new Error('Photo could not be opened');
      return [p.id, result.data.signedUrl] as const;
    }));
    return Object.fromEntries(entries);
  });

export const resolveSharedQuotePhotos = createServerFn({ method: 'POST' })
  .inputValidator((input: unknown) => z.object({ token: z.string().regex(/^[a-f0-9]{64}$/) }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    // Only frozen IDs from a valid, unexpired and unrevoked quote link are permitted.
    const result = await supabaseAdmin.rpc('read_customer_quote', { _token: data.token });
    if (result.error || !result.data) throw new Error('Quote link unavailable');
    const s = result.data as { document?: { photos?: { id: string }[] } };
    const ids = (s.document?.photos ?? []).map(p => p.id);
    if (!ids.length) return {};
    const photos = await supabaseAdmin.from('customer_quote_photos').select('id,storage_path').in('id', ids);
    if (photos.error) throw new Error('Photos unavailable');
    const entries = await Promise.all((photos.data ?? []).map(async p => {
      const result = await supabaseAdmin.storage.from('quote-photos').createSignedUrl(p.storage_path, 600);
      if (result.error) throw new Error('Photo unavailable');
      return [p.id, result.data.signedUrl] as const;
    }));
    return Object.fromEntries(entries);
  });

export const resolvePortalQuotePhotos = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ clientId: z.string().uuid(), quoteId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const workspace = await context.supabase.rpc('client_workspace', { _client: data.clientId });
    if (workspace.error) throw new Error('Client access unavailable');
    const w = workspace.data as { quotes?: { id: string; snapshot: { document: { photos?: { id: string }[] } } }[] } | null;
    const quote = w?.quotes?.find(q => q.id === data.quoteId);
    if (!quote) throw new Error('Quote unavailable');
    const ids = (quote.snapshot.document.photos ?? []).map(p => p.id);
    if (!ids.length) return {};
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const photos = await supabaseAdmin.from('customer_quote_photos').select('id,storage_path').in('id', ids);
    if (photos.error) throw new Error('Photos unavailable');
    return Object.fromEntries(await Promise.all((photos.data ?? []).map(async p => {
      const r = await supabaseAdmin.storage.from('quote-photos').createSignedUrl(p.storage_path, 600);
      if (r.error) throw new Error('Photo unavailable');
      return [p.id, r.data.signedUrl] as const;
    })));
  });