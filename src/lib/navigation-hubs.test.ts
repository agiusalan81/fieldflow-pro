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
});