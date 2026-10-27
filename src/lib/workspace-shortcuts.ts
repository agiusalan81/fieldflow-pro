export type WorkspaceShortcut = { label: string; to: string; search?: Record<string, string> };

/** Shortcuts are offered only inside an already authorized, unlocked parent. */
export function workspaceShortcuts(path: string, role?: string, view?: string): WorkspaceShortcut[] {
  const tabs = (values: [string, string][], key = 'tab') => values.map(([value, label]) => ({ label, to: path, search: { [key]: value } }));
  switch (path) {
    case '/contracts': return tabs([['renewals', 'Renewals due'], ['agreements', 'Client agreements'], ['types', 'Service tiers'], ['masters', 'Contracts & checklist masters'], ['checklists', 'Checklists']]);
    case '/team': return tabs([['availability', 'Live availability'], ['registered', 'Team members'], ['invites', 'Invites']]);
    case '/company': return tabs([['profile', 'General & trade'], ['branding', 'Branding & appearance'], ['estimates', 'Commercial & numbering'], ['integrations', 'Integrations & access']], 'section');
    case '/sheets': return tabs([['open', 'Drafts & in progress'], ['done', 'Completed history']]);
    case '/admin/jobs': return view === 'dispatch' ? [{ label: 'Dispatched jobs', to: path, search: { view: 'dispatch' } }] : ['all', 'draft', 'completed', 'archive'].map(tab => ({ label: ({ all: 'Draft & completed sheets', draft: 'Drafts', completed: 'Completed for review', archive: 'Monthly archive & combined PDF' })[tab] ?? tab, to: path, search: { view: 'sheets', tab } }));
    case '/admin/approvals': return tabs([['leave', 'Leave requests'], ['expenses', 'Expense categories'], ['equipment', 'Equipment & assets']], 'category');
    case '/payroll/wages':
    case '/payroll/hours':
    case '/payroll/payslips': return [{ label: 'Employee wages', to: '/payroll/wages' }, { label: 'Hours worked', to: '/payroll/hours' }, { label: 'Payslips', to: '/payroll/payslips' }];
    case '/dwr': return role === 'technician' || role === 'maintenance' ? [{ label: 'Report history', to: '/dwr' }] : [];
    default: return [];
  }
}

export function officeLedgerStatus(status: string, tab: string): boolean {
  if (tab === 'draft') return status === 'draft';
  if (tab === 'completed' || tab === 'archive') return status === 'completed';
  return status === 'draft' || status === 'completed';
}