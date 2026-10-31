import { act, render, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ role: 'technician', preview: false, rpc: vi.fn(async () => ({ data: 'stamp', error: null })) }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: state.rpc } }));
vi.mock('@/lib/impersonation', () => ({ usePreviewProfile: () => ({ data: { id: 'tech-a', real_role: state.role }, isPreview: state.preview }) }));
import { JobSeenMarker } from './job-seen';
let callback: IntersectionObserverCallback;
beforeEach(() => {
  vi.useFakeTimers(); state.role = 'technician'; state.preview = false;
  vi.stubGlobal('IntersectionObserver', class {
    constructor(cb: IntersectionObserverCallback) { callback = cb; }
    observe() {} disconnect() {}
  });
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); vi.clearAllMocks(); });
const show = async (ratio: number) => {
  await act(async () => {
    callback([{ isIntersecting: ratio > 0, intersectionRatio: ratio } as IntersectionObserverEntry], {} as IntersectionObserver);
    await vi.advanceTimersByTimeAsync(1000);
  });
};
describe('automatic job first views', () => {
  it('records assigned tech A only after their card is actually visible, once', async () => {
    render(<div><JobSeenMarker jobId="assigned-job" /></div>);
    expect(state.rpc).not.toHaveBeenCalled();
    await show(0.2); expect(state.rpc).not.toHaveBeenCalled();
    await show(1); await show(1);
    expect(state.rpc).toHaveBeenCalledTimes(1);
    expect(state.rpc).toHaveBeenCalledWith('mark_job_seen', { _job: 'assigned-job' });
  });
  it('records open jobs independently rather than acknowledging or claiming them', async () => {
    render(<div><JobSeenMarker jobId="open-job" /></div>); await show(1);
    expect(state.rpc.mock.calls).toEqual([['mark_job_seen', { _job: 'open-job' }]]);
  });
  it('does not mark a job hidden behind setup dialogs', async () => {
    render(<><div role="dialog" data-state="open" /><div><JobSeenMarker jobId="job" /></div></>);
    await show(1); expect(state.rpc).not.toHaveBeenCalled();
  });
  it('does not treat office views as fieldworker views', () => {
    state.role = 'admin'; render(<div><JobSeenMarker jobId="job" /></div>);
    expect(state.rpc).not.toHaveBeenCalled();
  });
  it('does not write during View As preview', () => {
    state.preview = true; render(<div><JobSeenMarker jobId="job" /></div>);
    expect(state.rpc).not.toHaveBeenCalled();
  });
});