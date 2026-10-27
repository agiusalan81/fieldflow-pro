import { describe, expect, it } from 'vitest';
import { organizeNavigation, navigationHub } from './navigation-hubs';
describe('role navigation', () => {
  it('retains one dispatch destination and never adds access', () => {
    const item = { to: '/admin/jobs', label: 'Jobs', group: 'Operations' };
    expect(organizeNavigation('admin', [item, item]).map(i => i.to)).toEqual(['/admin/jobs']);
    expect(organizeNavigation('technician', [])).toEqual([]);
  });
  it('separates supervisor own work from team work', () => {
    expect(navigationHub('supervisor', '/sheets')).toBe('My field work');
    expect(navigationHub('supervisor', '/admin/jobs')).toBe('Team supervision');
  });
  it('moves enabled skills into Team but retains the Coming soon entry', () => {
    const skills = { to: '/skills', label: 'Skills', group: 'Team' };
    expect(organizeNavigation('admin', [skills])).toEqual([]);
    expect(organizeNavigation('admin', [{ ...skills, locked: true }]).map(i => i.to)).toEqual(['/skills']);
  });
  it.each(['admin', 'superuser', 'supervisor', 'technician', 'maintenance'])('keeps personal tasks in My workspace for %s', role => {
    for (const path of ['/hours', '/leave', '/settings']) expect(navigationHub(role, path)).toBe('My workspace');
  });
  it('separates payroll and vertical packs without losing worked hours', () => {
    for (const path of ['/payroll/wages', '/payroll/payslips', '/payroll/hours', '/admin/leave']) expect(navigationHub('admin', path)).toBe('Payroll & Leave');
    expect(navigationHub('admin', '/lift-rfq')).toBe('Vertical packs');
    expect(navigationHub('technician', '/dwr')).toBe('My workspace');
  });
  it('preserves distinct dispatch and ledger destinations', () => {
    const sheet = { to: '/admin/jobs', label: 'Job sheets', group: 'Operations', search: { view: 'sheets' } };
    const dispatch = { ...sheet, label: 'Dispatched jobs', search: { view: 'dispatch' } };
    expect(organizeNavigation('admin', [sheet, dispatch, sheet])).toEqual([sheet, dispatch].map(i => ({ ...i, group: 'Operations & field' })));
  });
});