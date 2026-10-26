/** Menu visibility only; direct page access remains governed by existing role/module permissions. */
export function showRoleMenuItem(role: string | undefined, path: string): boolean {
  return !((role === 'admin' || role === 'superuser') && (path === '/surveys' || path === '/as-built'));
}