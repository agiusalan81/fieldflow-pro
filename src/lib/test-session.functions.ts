import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { canStartTestSession, canTestMember } from './test-session';

export const listTestMembers = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const role = await context.supabase.from('user_roles').select('user_id,company_id,role,registration_status').eq('user_id', context.userId).maybeSingle();
    if (role.error) throw new Error('Could not verify testing access');
    if (!role.data || !canStartTestSession(role.data, true)) return { available: false, members: [] };
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const ctl = await supabaseAdmin.from('platform_company_controls').select('is_test').eq('company_id', role.data.company_id).maybeSingle();
    if (ctl.error) throw new Error('Could not verify test company');
    if (!canStartTestSession(role.data, ctl.data?.is_test === true)) return { available: false, members: [] };
    const [roles, users] = await Promise.all([
      context.supabase.from('user_roles').select('user_id,company_id,role,registration_status'),
      context.supabase.from('users').select('id,full_name').order('full_name'),
    ]);
    if (roles.error || users.error) throw new Error('Could not load test accounts');
    const actor = role.data;
    return { available: true, members: (roles.data ?? []).filter(target => canTestMember(actor, target)).flatMap(target => {
      const user = users.data?.find(u => u.id === target.user_id);
      return user ? [{ id: user.id, name: user.full_name, role: target.role }] : [];
    }) };
  });

export const startTestSession = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ memberId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const actorResult = await context.supabase.from('user_roles').select('user_id,company_id,role,registration_status').eq('user_id', context.userId).maybeSingle();
    const actor = actorResult.data;
    if (actorResult.error || !actor || !canStartTestSession(actor, true)) throw new Error('Active Company Superuser access required');
    const targetResult = await context.supabase.from('user_roles').select('user_id,company_id,role,registration_status').eq('user_id', data.memberId).maybeSingle();
    const target = targetResult.data;
    if (targetResult.error || !target || !canTestMember(actor, target)) throw new Error('Choose an active test account in your company');
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const ctl = await supabaseAdmin.from('platform_company_controls').select('is_test').eq('company_id', actor.company_id).maybeSingle();
    if (ctl.error || !canStartTestSession(actor, ctl.data?.is_test === true)) throw new Error('Real-account testing is restricted to HQ-marked test companies');
    const user = await supabaseAdmin.auth.admin.getUserById(target.user_id);
    if (user.error || !user.data.user?.email || !user.data.user.email_confirmed_at) throw new Error('The test account must have a verified email');
    const audit = await supabaseAdmin.from('platform_audit').insert({ actor_id: context.userId, entity: 'test_session', entity_id: target.user_id, action: 'START_TEST_SESSION', after_value: { company_id: actor.company_id, role: target.role } });
    if (audit.error) throw new Error('Could not record test entry');
    const link = await supabaseAdmin.auth.admin.generateLink({ type: 'magiclink', email: user.data.user.email });
    if (link.error || !link.data.properties?.hashed_token) throw new Error('Could not start testing');
    return { tokenHash: link.data.properties.hashed_token, memberId: target.user_id };
  });