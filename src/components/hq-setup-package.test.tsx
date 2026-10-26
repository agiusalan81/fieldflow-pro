import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { HQSetupPackage } from './hq-setup-package';
import type { Database } from '@/integrations/supabase/types';
const rpc = vi.hoisted(() => vi.fn(async () => ({ error: null })));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc } }));
afterEach(() => { cleanup(); rpc.mockClear(); });
it('immediate package saves include selections, overrides and visibility in one call', async () => {
  const sub = { id: 'sub', plan_id: 'tier', pack_ids: ['portal'], seats: 4, cadence: 'monthly', agreed_price: 149, trial_package_only: true, hide_locked_modules: true, coming_soon_modules: ['job_profitability'] } as Database['public']['Tables']['platform_subscriptions']['Row'];
  const saved = vi.fn();
  render(<HQSetupPackage subscription={sub} catalog={[]} modules={['core', 'client_management', 'client_portal', 'job_profitability']} overrides={[]} companyName="Test" money={String} onSaved={saved}/>);
  fireEvent.click(screen.getByRole('button', { name: 'Setup package' }));
  fireEvent.change(screen.getByRole('combobox', { name: 'client_portal access' }), { target: { value: 'on' } });
  fireEvent.click(screen.getByRole('switch', { name: 'Force FieldBridge email branding' }));
  fireEvent.click(screen.getByRole('button', { name: 'Save setup package' }));
  await waitFor(() => expect(saved).toHaveBeenCalled());
  expect(rpc).toHaveBeenCalledTimes(1);
  expect(rpc).toHaveBeenCalledWith('hq_save_setup_options', { _subscription: 'sub', _options: expect.objectContaining({ immediate: true, email_branding_mode: 'off', plan: 'tier', packs: ['portal'], hide_locked: true, coming_soon: ['job_profitability'], modes: expect.objectContaining({ client_portal: 'on', client_management: 'package' }) }) });
});