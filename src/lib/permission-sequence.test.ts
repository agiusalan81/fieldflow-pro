import { afterEach, expect, it, vi } from 'vitest';
import { permissionSequence } from './permission-sequence';
afterEach(() => vi.useRealTimers());
it('requests location only after notifications finish', async () => {
  let finish: ((value: string) => void) | undefined;
  const location = vi.fn(async () => {});
  const pending = permissionSequence(() => new Promise<string>(resolve => { finish = resolve; }), location);
  expect(location).not.toHaveBeenCalled();
  finish?.('granted');
  expect(await pending).toBe('granted');
  expect(location).toHaveBeenCalledOnce();
});
it('releases setup after five seconds without stacking another prompt', async () => {
  vi.useFakeTimers();
  const location = vi.fn(async () => {});
  const pending = permissionSequence(() => new Promise<string>(() => {}), location);
  await vi.advanceTimersByTimeAsync(5000);
  expect(await pending).toBeNull();
  expect(location).not.toHaveBeenCalled();
});