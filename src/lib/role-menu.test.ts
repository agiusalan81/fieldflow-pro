import { describe, expect, it } from 'vitest';
import { showRoleMenuItem } from './role-menu';

describe('office survey navigation', () => {
  it('keeps contracts office-only in navigation and HQ outside tenant menus', () => {
    expect(showRoleMenuItem('supervisor', '/contracts')).toBe(false);
    expect(showRoleMenuItem('admin', '/contracts')).toBe(true);
    for (const role of ['technician', 'supervisor', 'admin', 'superuser']) {
      expect(showRoleMenuItem(role, '/hq')).toBe(false);
      expect(showRoleMenuItem(role, '/platform')).toBe(false);
    }
  });
  it.each(['admin', 'superuser'])('hides both survey pages for %s', role => {
    expect(showRoleMenuItem(role, '/surveys')).toBe(false);
    expect(showRoleMenuItem(role, '/as-built')).toBe(false);
    expect(showRoleMenuItem(role, '/estimates')).toBe(true);
  });
  it.each(['technician', 'supervisor'])('keeps field survey navigation for %s', role => {
    expect(showRoleMenuItem(role, '/surveys')).toBe(true);
    expect(showRoleMenuItem(role, '/as-built')).toBe(true);
  });
});