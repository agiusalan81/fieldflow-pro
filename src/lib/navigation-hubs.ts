/** Presentation only: input must already be filtered by role and tenant entitlement. */
export function navigationHub(role: string | undefined, path: string): string {
  if (role === 'supervisor') {
    if (['/dashboard', '/sheets', '/schedule', '/surveys', '/as-built', '/technical-library', '/dwr', '/hours', '/leave', '/settings'].includes(path)) return 'My field work';
    if (['/admin/entities', '/qr-codes', '/crm', '/estimates', '/lift-rfq', '/proposals', '/contracts'].includes(path)) return 'Commercial & CRM';
    if (['/fleet', '/expenses'].includes(path)) return 'Fleet & expenses';
    return 'Team supervision';
  }
  if (role === 'technician' || role === 'maintenance') {
    if (['/dwr', '/standby', '/leave', '/hours'].includes(path)) return 'My time & rota';
    if (path === '/settings') return 'My account';
    if (path === '/crm') return 'Commercial & CRM';
    return 'My field work';
  }
  if (['/admin/entities', '/qr-codes', '/contracts', '/crm', '/estimates', '/lift-rfq', '/proposals'].includes(path)) return 'Commercial & CRM';
  if (['/team', '/skills', '/team-invites', '/standby', '/messages', '/admin/leave', '/hours', '/leave', '/dwr'].includes(path) || path.startsWith('/payroll/')) return 'Team & workforce';
  if (['/fleet', '/expenses', '/live-map'].includes(path)) return 'Fleet & expenses';
  if (['/company', '/admin/fields', '/settings', '/subscription', '/hq'].includes(path)) return 'Company administration';
  return 'Operations & field';
}

export function organizeNavigation<T extends { to: string; label: string; group: string }>(role: string | undefined, items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter(item => {
    if (seen.has(item.to)) return false;
    seen.add(item.to);
    // Existing screens remain available from their owning workspace.
    return !['/team-invites', '/admin/fields'].includes(item.to);
  }).map(item => ({ ...item, group: navigationHub(role, item.to), label: item.to === '/admin/jobs' ? 'Dispatch & jobs' : item.to === '/as-built' ? 'As-built measurements' : item.label }));
}