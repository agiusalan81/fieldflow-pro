import { describe, expect, it } from 'vitest';
import { showRoleMenuItem } from './role-menu';

describe('office survey navigation', () => {
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