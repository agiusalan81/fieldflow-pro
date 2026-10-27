/** Menu visibility only; direct page access remains governed by existing role/module permissions. */
export function showRoleMenuItem(role: string | undefined, path: string): boolean {
  if (path === '/hq' || path === '/platform') return false;
  if (role === 'supervisor' && path === '/contracts') return false;
  return !((role === 'admin' || role === 'superuser') && (path === '/surveys' || path === '/as-built'));
}