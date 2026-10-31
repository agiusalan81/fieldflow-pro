import { createServerFn } from '@tanstack/react-start';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { parseTemplate } from './documents';
import { resolveDocumentAssets } from './branding-assets';
import type { BillingSnapshot } from './client-billing';
import type { QuoteSnapshot } from './customer-quotes';
export const sharedDocumentBranding = createServerFn({ method: 'POST' })
  .inputValidator((value: unknown) => z.object({ token: z.string().regex(/^[a-f0-9]{64}$/), kind: z.enum(['billing', 'quote']) }).parse(value))
  .handler(async ({ data }) => {
    const key = process.env['SUPABASE_PUBLISHABLE_KEY']!;
    const client = createClient(process.env['SUPABASE_URL']!, key, { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: (input, init) => { const headers = new Headers(init?.headers); if (key.startsWith('sb_') && headers.get('Authorization') === `Bearer ${key}`) headers.delete('Authorization'); headers.set('apikey', key); return fetch(input, { ...init, headers }); } } });
    const read = await client.rpc(data.kind === 'billing' ? 'read_client_billing' : 'read_customer_quote', { _token: data.token });
    if (read.error || !read.data) return null;
    const snapshot = read.data as unknown as BillingSnapshot | QuoteSnapshot;
    if (!snapshot.template) return snapshot;
    // The link is authenticated before privileged access, and every file is bounded to its tenant.
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(data.token))), b => b.toString(16).padStart(2, '0')).join('');
    const link = await supabaseAdmin.from(data.kind === 'billing' ? 'client_billing_links' : 'customer_quote_links').select('company_id').eq('token_hash', hash).is('revoked_at', null).gt('expires_at', new Date().toISOString()).maybeSingle();
    if (link.error || !link.data) return null;
    const template = parseTemplate(snapshot.template);
    const tenant = link.data.company_id;
    if (template.fontPath && !template.fontPath.startsWith(`${tenant}/fonts/`)) template.fontPath = '';
    if (template.backgroundPath && !template.backgroundPath.startsWith(`${tenant}/backgrounds/`)) template.backgroundPath = '';
    template.customFonts = (template.customFonts ?? []).filter(f => f.path.startsWith(`${tenant}/fonts/`));
    const resolved = await resolveDocumentAssets(supabaseAdmin, template);
    return { ...snapshot, template: { ...resolved, fontPath: '', backgroundPath: '', customFonts: resolved.customFonts?.map(f => ({ ...f, path: '' })) ?? [] } };
  });