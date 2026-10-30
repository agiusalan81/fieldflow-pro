/** Test entry is distinct from UI-only View As and never changes membership. */
export type TestMembership = { user_id: string; company_id: string; role: string; registration_status: string };
export function canStartTestSession(actor: TestMembership | null, isTest: boolean) {
  return isTest && actor?.role === 'superuser' && actor.registration_status === 'active';
}
export function canTestMember(actor: TestMembership, target: TestMembership) {
  return actor.user_id !== target.user_id && actor.company_id === target.company_id && target.registration_status === 'active' && ['technician', 'maintenance', 'supervisor', 'admin'].includes(target.role);
}