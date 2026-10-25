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
    const result = await sendTemplateEmail('customer-quote', contact.email, { idempotencyKey: `customer-quote-${quote.id}-${contact.id}`, templateData: { company: s.company.name, name: contact.first_name, reference: s.reference, title: document.title, total: new Intl.NumberFormat('en-GB', { style: 'currency', currency: s.currency }).format(s.totals.total), validUntil: document.valid_until, documentUrl: `https://fieldbridgeapp.com/quote/${token}` } });
    const saved = await supabaseAdmin.from('customer_quote_deliveries').upsert({ quote_id: quote.id, company_id: quote.company_id, contact_id: contact.id, outcome: result.sent ? 'sent' : result.reason }, { onConflict: 'quote_id,contact_id' });
    if (saved.error) throw new Error('Email processed, but delivery history could not be recorded. Retry safely.');
    return result;
  });