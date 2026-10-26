import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { customerQuoteDocument, type QuoteSnapshot } from './customer-quotes';
import { clientRecipients } from './client-recipients';

export const sendCustomerQuote = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ quoteId: z.string().uuid(), contactId: z.string().min(1).max(100) }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: quote, error } = await context.supabase.from('customer_quotes').select('*').eq('id', data.quoteId).single();
    if (error || !quote?.snapshot || !quote.client_id || quote.status === 'draft') throw new Error('Issued quote unavailable');
    const access = await context.supabase.rpc('company_module_access', { _company: quote.company_id, _module: 'core' });
    if (access.error || !access.data) throw new Error('Core editing access required');
    const s = quote.snapshot as unknown as QuoteSnapshot; const document = customerQuoteDocument(s.document);
    const contacts = await clientRecipients(context.supabase, quote.client_id, quote.site_id, document.kind, 'email');
    const contact = contacts.find(c => c.id === data.contactId);
    if (!contact?.email) throw new Error('Choose an authorised customer contact');
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const prior = await supabaseAdmin.from('customer_quote_deliveries').select('outcome').eq('quote_id', quote.id).eq('contact_id', contact.id).maybeSingle();
    if (prior.data?.outcome === 'sent') return { sent: true, alreadySent: true };
    if (prior.data?.outcome === 'recipient_suppressed') return { sent: false, reason: 'recipient_suppressed' };
    const link = await context.supabase.rpc('customer_quote_action', { _id: quote.id, _action: 'link', _data: { approval: false } });
    if (link.error) throw new Error(link.error.message);
    const token = (link.data as { token?: string } | null)?.token;
    if (!token) throw new Error('Document link unavailable');
    const { sendTemplateEmail } = await import('./email-templates/send-email');
    const { resolveEmailIdentity } = await import('./email-identity.server');
    const identity = await resolveEmailIdentity(context.supabase, quote.company_id);
    const result = await sendTemplateEmail('customer-quote', contact.email, { identity, idempotencyKey: `customer-quote-${quote.id}-${contact.id}`, templateData: { company: s.company.name, name: contact.first_name, reference: s.reference, title: document.title, total: new Intl.NumberFormat('en-GB', { style: 'currency', currency: s.currency }).format(s.totals.total), validUntil: document.valid_until, documentUrl: `https://fieldbridgeapp.com/quote/${token}` } });
    const saved = await supabaseAdmin.from('customer_quote_deliveries').upsert({ quote_id: quote.id, company_id: quote.company_id, contact_id: contact.id, outcome: result.sent ? 'sent' : result.reason }, { onConflict: 'quote_id,contact_id' });
    if (saved.error) throw new Error('Email processed, but delivery history could not be recorded. Retry safely.');
    return result;
  });
/** Emails the contractor office after a portal contact accepts/declines a quote. Only the deciding contact can trigger it. */
export const notifyQuoteDecision = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ quoteId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const ev = await supabaseAdmin.from('customer_quote_events').select('action,details,created_at').eq('quote_id', data.quoteId).eq('actor_id', context.userId).in('action', ['portal_accepted', 'portal_declined']).gte('created_at', new Date(Date.now() - 15 * 60_000).toISOString()).order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (ev.error || !ev.data) throw new Error('No recent decision to report');
    const q = await supabaseAdmin.from('customer_quotes').select('id,company_id,reference,snapshot,job_id,client_id').eq('id', data.quoteId).single();
    if (q.error || !q.data) throw new Error('Quote unavailable');
    const s = q.data.snapshot as unknown as QuoteSnapshot | null;
    const roles = await supabaseAdmin.from('user_roles').select('user_id').eq('company_id', q.data.company_id).in('role', ['superuser', 'admin']);
    const ids = [...new Set((roles.data ?? []).map(r => r.user_id))];
    if (!ids.length) return { sent: 0 };
    const users = await supabaseAdmin.from('users').select('id,email').in('id', ids);
    const details = (ev.data.details ?? {}) as { name?: string; comment?: string };
    const accepted = ev.data.action === 'portal_accepted';
    const { sendTemplateEmail } = await import('./email-templates/send-email');
    let sent = 0;
    for (const u of users.data ?? []) {
      if (!u.email) continue;
      try {
        const r = await sendTemplateEmail('quote-decision', u.email, { idempotencyKey: `quote-decision-${q.data.id}-${ev.data.created_at}-${u.id}`, templateData: { company: s?.company.name ?? 'FieldBridge', client: s?.client ?? 'Client', reference: q.data.reference, title: s ? customerQuoteDocument(s.document).title : '', decision: accepted ? 'accepted' : 'declined', signer: details.name ?? '', comment: details.comment ?? '', nextStep: accepted ? (q.data.job_id ? 'An unassigned job was created automatically — assign a technician and date.' : 'Ready to schedule — convert it to a job when convenient.') : '', url: `https://fieldbridgeapp.com/estimates?quote=${q.data.id}` } });
        if (r.sent) sent++;
      } catch (e) { console.error('quote-decision email failed', e); }
    }
    return { sent };
  });
