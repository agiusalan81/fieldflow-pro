import { expect, it } from 'vitest';
import { canStartTestSession, canTestMember, type TestMembership } from './test-session';
const actor: TestMembership = { user_id: 'owner', company_id: 'one', role: 'superuser', registration_status: 'active' };
const tech: TestMembership = { ...actor, user_id: 'tech', role: 'technician' };
it('only an active real Superuser can start testing', () => {
  expect(canStartTestSession(actor, true)).toBe(true);
  for (const role of ['admin', 'supervisor', 'technician', 'maintenance']) expect(canStartTestSession({ ...actor, role }, true)).toBe(false);
  expect(canStartTestSession({ ...actor, registration_status: 'terminated' }, true)).toBe(false);
});
it('refuses real-account test entry outside HQ-marked test companies', () => {
  expect(canStartTestSession(actor, false)).toBe(false);
});
it('requires an active different account in the same tenant', () => {
  expect(canTestMember(actor, tech)).toBe(true);
  expect(canTestMember(actor, { ...tech, company_id: 'two' })).toBe(false);
  expect(canTestMember(actor, { ...tech, registration_status: 'terminated' })).toBe(false);
  expect(canTestMember(actor, actor)).toBe(false);
});
it('does not mint a Superuser session for field testing', () => {
  expect(canTestMember(actor, { ...tech, role: 'superuser' })).toBe(false);
});