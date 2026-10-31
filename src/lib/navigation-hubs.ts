/** Presentation only: input must already be filtered by role and tenant entitlement. */
export function navigationHub(role: string | undefined, path: string): string {
  if (['/hours', '/leave', '/settings','/my-incentives'].includes(path)) return 'My workspace';
  if (path === '/lift-rfq') return 'Vertical packs';
  if (role === 'supervisor') {
    if (['/dashboard', '/sheets', '/schedule', '/surveys', '/as-built', '/technical-library', '/dwr'].includes(path)) return 'My field work';
    if (['/admin/entities', '/qr-codes', '/crm', '/estimates', '/lift-rfq', '/proposals', '/contracts'].includes(path)) return 'Commercial & CRM';
    if (['/fleet', '/expenses'].includes(path)) return 'Fleet & expenses';
    return 'Team supervision';
  }
  if (role === 'technician' || role === 'maintenance') {
    if (path === '/dwr') return 'My workspace';
    if (path === '/standby') return 'My time & rota';
    if (path === '/crm') return 'Commercial & CRM';
    return 'My field work';
  }
  if (path === '/admin/leave' || path.startsWith('/payroll/')) return 'Payroll & Leave';
  if (['/admin/entities', '/qr-codes', '/contracts', '/crm', '/estimates', '/lift-rfq', '/proposals'].includes(path)) return 'Commercial & CRM';
  if (['/team', '/skills', '/team-invites', '/standby', '/messages', '/dwr'].includes(path)) return 'Team & workforce';
  if (['/fleet', '/expenses', '/live-map'].includes(path)) return 'Fleet & expenses';
  if (['/company', '/admin/fields', '/settings', '/subscription', '/hq'].includes(path)) return 'Company administration';
  return 'Operations & field';
}

export function organizeNavigation<T extends { to: string; label: string; group: string; locked?: boolean; search?: Record<string, string> }>(role: string | undefined, items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter(item => {
    const key = item.to + JSON.stringify(item.search ?? {});
    if (seen.has(key)) return false;
    seen.add(key);
    // Existing screens remain available from their owning workspace.
    return !['/team-invites', '/admin/fields'].includes(item.to) && (item.to !== '/skills' || !!item.locked);
  }).map(item => ({ ...item, group: navigationHub(role, item.to), label: item.to === '/leave' ? 'My leave' : item.to === '/settings' ? 'My settings' : item.to === '/admin/leave' && role !== 'supervisor' ? 'Leave overview' : item.to === '/as-built' ? 'As-built measurements' : item.label }));
}