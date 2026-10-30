import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  role: 'technician', clocked: true as boolean | undefined, shiftError: false,
  play: vi.fn(async () => true), invalidate: vi.fn(),
}));
vi.mock('@/lib/profile', () => ({ useProfile: () => ({ data: { id: 'actor', real_role: state.role } }) }));
vi.mock('@/lib/plan-features', () => ({ useNavLock: () => () => ({ locked: false }) }));
vi.mock('@/lib/chime', () => ({ playChime: state.play }));
vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: state.invalidate }),
  useQuery: ({ queryKey }: { queryKey: string[] }) => queryKey[0] === 'open-job-clocked'
    ? { data: state.clocked, isError: state.shiftError }
    : { data: queryKey[0] === 'open-jobs' ? [{ id: 'job', places_left: 1 }] : [] },
}));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {
  channel: () => { const channel = { on: () => channel, subscribe: () => channel }; return channel; },
  removeChannel: vi.fn(),
} }));
import { useGlobalOpenJobAlarm, useOpenJobs } from '@/lib/open-jobs';

afterEach(() => { vi.useRealTimers(); vi.clearAllMocks(); state.role = 'technician'; state.clocked = true; state.shiftError = false; });

describe('global open-job sound', () => {
  it.each(['admin', 'superuser'])('keeps %s board visible without sounding', (role) => {
    state.role = role;
    const { result } = renderHook(() => { useGlobalOpenJobAlarm('actor'); return useOpenJobs(); });
    expect(result.current.jobs.map(j => j.id)).toEqual(['job']);
    expect(state.play).not.toHaveBeenCalled();
  });

  it('starts on clock-in and stops repeating after clock-out', async () => {
    vi.useFakeTimers();
    state.clocked = false;
    const { rerender } = renderHook(() => useGlobalOpenJobAlarm('actor'));
    expect(state.play).not.toHaveBeenCalled();
    state.clocked = true;
    rerender();
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(state.play).toHaveBeenCalledWith('urgent', 'actor');
    await act(async () => { await vi.advanceTimersByTimeAsync(300_000); });
    expect(state.play).toHaveBeenCalledTimes(2);
    state.clocked = false;
    rerender();
    await act(async () => { await vi.advanceTimersByTimeAsync(600_000); });
    expect(state.play).toHaveBeenCalledTimes(2);
  });

  it('does not use stale active-shift data after a read fails', () => {
    state.shiftError = true;
    renderHook(() => useGlobalOpenJobAlarm('actor'));
    expect(state.play).not.toHaveBeenCalled();
  });
});