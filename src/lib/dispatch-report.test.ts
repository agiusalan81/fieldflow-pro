import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ from: vi.fn(), update: vi.fn(), eq: vi.fn(), select: vi.fn(), maybeSingle: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: mocks.from } }));
import { closeDispatchedReport, DISPATCH_REFRESH_KEYS } from './dispatch-report';

describe('equipment report dispatch completion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.from.mockReturnValue(mocks);
    mocks.update.mockReturnValue(mocks);
    mocks.eq.mockReturnValue(mocks);
    mocks.select.mockReturnValue(mocks);
    mocks.maybeSingle.mockResolvedValue({ data: { id: 'report-1' }, error: null });
  });
  it('closes only the report matching the dispatched equipment', async () => {
    expect(await closeDispatchedReport('report-1', 'asset-1')).toBeNull();
    expect(mocks.from).toHaveBeenCalledWith('equipment_problem_reports');
    expect(mocks.update).toHaveBeenCalledWith({ status: 'closed' });
    expect(mocks.eq.mock.calls).toEqual([['id', 'report-1'], ['asset_id', 'asset-1']]);
  });
  it('does not touch reports for ordinary visits', async () => {
    expect(await closeDispatchedReport(undefined, 'asset-1')).toBeNull();
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it('does not close a report if equipment was removed', async () => {
    expect(await closeDispatchedReport('report-1', null)).toContain('no longer matches');
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it('reports a denied or failed close without suggesting another dispatch', async () => {
    mocks.maybeSingle.mockResolvedValue({ data: null, error: { message: 'denied' } });
    expect(await closeDispatchedReport('report-1', 'asset-1')).toContain('do not schedule it again');
  });
  it('does not treat an inaccessible or mismatched report as cleared', async () => {
    mocks.maybeSingle.mockResolvedValue({ data: null, error: null });
    expect(await closeDispatchedReport('report-1', 'asset-2')).toContain('could not be cleared');
  });
  it('refreshes bell, report queue and dashboard attention after saving', () => {
    expect(DISPATCH_REFRESH_KEYS).toEqual(expect.arrayContaining(['action-notifications', 'equipment-problem-reports', 'attention-overview', 'schedule', 'today-jobs']));
  });
});