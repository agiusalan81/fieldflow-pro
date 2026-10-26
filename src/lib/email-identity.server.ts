import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';
import { emailIdentity } from './email-identity';

/** Call only after the feature has read its triggering object as the caller. */
export async function resolveEmailIdentity(sb: SupabaseClient<Database>, companyId: string) {
  const [company, settings, access] = await Promise.all([
    sb.from('companies').select('name').eq('id', companyId).maybeSingle(),
    sb.from('company_settings').select('company_email').eq('company_id', companyId).maybeSingle(),
    sb.rpc('company_email_branding', { _company: companyId }),
  ]);
  if (company.error || settings.error || access.error) throw new Error('Could not verify company email branding');
  return emailIdentity(company.data?.name, settings.data?.company_email, access.data === true);
}