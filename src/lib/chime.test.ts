import { afterEach, expect, it, vi } from 'vitest';
afterEach(() => { localStorage.clear(); vi.unstubAllGlobals(); vi.resetModules(); });
async function audio(state = 'running', reject = false) {
  const start = vi.fn();
  const gain = { gain: { setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() }, connect: vi.fn() };
  const context = { state, currentTime: 0, destination: {}, createGain: () => gain, createOscillator: vi.fn(() => ({ type: '', frequency: { value: 0 }, connect: () => gain, start, stop: vi.fn() })), resume: vi.fn(async () => { if (reject) throw new Error('Blocked'); context.state = 'running'; }) };
  vi.stubGlobal('AudioContext', class { constructor() { return context; } });
  return { context, start, lib: await import('./chime') };
}
it('plays the two-note incoming chat chime', async () => {
  const { lib, start } = await audio();
  expect(await lib.playChime('message', 'alice')).toBe(true);
  expect(start).toHaveBeenCalledTimes(2);
});
it('respects the account mute preference', async () => {
  const { lib, start } = await audio(); lib.setSoundsOn('alice', false);
  expect(await lib.playChime('message', 'alice')).toBe(false);
  expect(start).not.toHaveBeenCalled();
});
it('unlocks suspended audio on a gesture', async () => {
  const { lib, context } = await audio('suspended'); const stop = lib.listenForChimeUnlock();
  document.dispatchEvent(new Event('pointerdown')); await Promise.resolve();
  expect(context.resume).toHaveBeenCalledTimes(1); stop();
  context.state = 'suspended'; document.dispatchEvent(new Event('pointerdown'));
  expect(context.resume).toHaveBeenCalledTimes(1);
});
it('handles rejected audio permission without an unhandled failure', async () => {
  const { lib, start } = await audio('suspended', true);
  expect(await lib.playChime('message', 'alice')).toBe(false);
  expect(start).not.toHaveBeenCalled();
});