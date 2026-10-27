import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';

/** Creates a portal invitation as the caller (RLS + RPC guards apply) and emails it straight to that contact. */
export const sendPortalInvite = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ clientId: z.string().uuid(), contactId: z.string().uuid(), admin: z.boolean() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: contact, error } = await context.supabase.from('client_contacts').select('id,first_name,email,company_id').eq('id', data.contactId).eq('client_id', data.clientId).maybeSingle();
    if (error || !contact) throw new Error('Contact not found');
    if (!contact.email?.trim()) throw new Error('Add an email address to this contact first');
    const token = await context.supabase.rpc('invite_client_contact', { _client: data.clientId, _contact: data.contactId, _admin: data.admin });
    if (token.error || !token.data) throw new Error(token.error?.message ?? 'Invitation could not be created');
    const { data: company } = await context.supabase.from('companies').select('name').eq('id', contact.company_id).maybeSingle();
    const { sendTemplateEmail } = await import('./email-templates/send-email');
    const { resolveEmailIdentity } = await import('./email-identity.server');
    const identity = await resolveEmailIdentity(context.supabase, contact.company_id);
    const result = await sendTemplateEmail('portal-invite', contact.email.trim(), { identity, idempotencyKey: `portal-invite-${String(token.data).slice(0, 24)}`, templateData: { company: company?.name ?? '', name: contact.first_name, inviteUrl: `https://fieldbridgeapp.com/client-portal?invite=${token.data}`, admin: data.admin } });
    return { sent: result.sent, email: contact.email.trim() };
  });
