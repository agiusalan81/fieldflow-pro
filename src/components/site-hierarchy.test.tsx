import { cleanup, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, expect, it, vi } from 'vitest';
import { SiteHierarchy } from './site-hierarchy';

const calls = vi.hoisted(() => ({ rpc: vi.fn(), contacts: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {
  rpc: calls.rpc,
  from: () => ({ select: () => ({ eq: () => ({ order: async () => ({ data: [] }) }) }) }),
} }));
vi.mock('@/components/client-manager', () => ({
  ContactsManager: (props: unknown) => { calls.contacts(props); return <div>Core contacts</div>; },
  EquipmentManager: () => null,
}));
afterEach(() => { cleanup(); vi.clearAllMocks(); });

it('mounts staff contact management without querying a paid portal workspace', () => {
  render(<QueryClientProvider client={new QueryClient()}><SiteHierarchy clientId="client-a" companyId="tenant-a" /></QueryClientProvider>);
  expect(screen.getByText('Core contacts')).toBeInTheDocument();
  expect(calls.contacts).toHaveBeenCalledWith(expect.objectContaining({ clientId: 'client-a', companyId: 'tenant-a', siteId: null }));
  expect(calls.rpc).not.toHaveBeenCalled();
});