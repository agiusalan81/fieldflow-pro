import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { clientRecipients } from './client-recipients';
import { BILLING_KINDS, billingNotice, type BillingSnapshot } from './client-billing';
export const sendClientBilling = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ documentId: z.string().uuid(), contactId: z.string().min(1).max(100) }).parse(input))
  .handler(async ({ data, context }) => {
    const access = await context.supabase.rpc('client_billing_can'); if (access.error || !access.data) throw new Error('Office billing access required');
    const r = await context.supabase.from('client_billing_documents').select('*').eq('id', data.documentId).single();
    if (r.error || !r.data?.snapshot || !r.data.issued_at || !r.data.client_id) throw new Error('Issued document unavailable');
    const contacts = await clientRecipients(context.supabase, r.data.client_id, null, 'invoice', 'email'); const contact = contacts.find(c => c.id === data.contactId);
    if (!contact?.email) throw new Error('Choose an authorised billing contact');
    const link = await context.supabase.rpc('create_client_billing_link', { _id: r.data.id }); if (link.error) throw new Error(link.error.message);
    const s = r.data.snapshot as unknown as BillingSnapshot;
    const { sendTemplateEmail } = await import('./email-templates/send-email');
    const { resolveEmailIdentity } = await import('./email-identity.server'); const identity = await resolveEmailIdentity(context.supabase, r.data.company_id);
    return sendTemplateEmail('client-billing', contact.email, { identity, idempotencyKey: `billing-${r.data.id}-${contact.id}`, templateData: { company: s.company.name, name: contact.first_name, kind: BILLING_KINDS[s.kind], reference: s.reference, title: s.document.title, total: new Intl.NumberFormat('en-GB', { style: 'currency', currency: s.currency }).format(s.totals.total), due: s.document.due_date, notice: billingNotice(s.kind), documentUrl: `https://fieldbridgeapp.com/billing-document/${link.data}` } });
  });