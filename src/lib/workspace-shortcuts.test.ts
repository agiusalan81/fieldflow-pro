import { describe, expect, it } from 'vitest';
import { officeLedgerStatus, workspaceShortcuts } from './workspace-shortcuts';

describe('workspace destinations', () => {
  it('links service tiers to the actual contracts tab', () => {
    expect(workspaceShortcuts('/contracts', 'admin').find(i => i.label === 'Service tiers')).toEqual({ label: 'Service tiers', to: '/contracts', search: { tab: 'types' } });
  });
  it('limits the office ledger to drafts and completed sheets', () => {
    expect(['draft', 'pending', 'in_transit', 'in_progress', 'completed'].filter(s => officeLedgerStatus(s, 'all'))).toEqual(['draft', 'completed']);
    expect(officeLedgerStatus('draft', 'completed')).toBe(false);
    expect(officeLedgerStatus('completed', 'draft')).toBe(false);
  });
  it('keeps technician reports history-only', () => {
    expect(workspaceShortcuts('/dwr', 'technician')).toEqual([{ label: 'Report history', to: '/dwr' }]);
  });
});