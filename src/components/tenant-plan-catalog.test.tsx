import { render, screen, fireEvent } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { TenantPlanCatalog } from './tenant-plan-catalog';
import type { Database } from '@/integrations/supabase/types';
it('storage selection requests a change without applying any purchase', () => {
  const onRequest=vi.fn();
  const storage:Database['public']['Tables']['platform_catalog']['Row']={id:'storage',kind:'pack',modules:[],storage_gb:100,name:'100 GB',monthly_price:35,quarterly_price:94.5,yearly_price:336,billing_basis:'company',included_seats:0,branding_required:false,created_at:'2026-10-24T00:00:00Z',product_id:'product',referral_reward:0,sort_order:0,state:'active'};
  render(<TenantPlanCatalog catalog={[storage]} status={{state:'trial'}} cadence="monthly" money={n=>`€${n}`} onRequest={onRequest}/>);
  expect(screen.getByRole('button',{name:'Request storage change'})).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Choose a storage add-on'),{target:{value:'storage'}});
  fireEvent.click(screen.getByRole('button',{name:'Request storage change'}));
  expect(onRequest).toHaveBeenCalledWith(expect.objectContaining({category:'storage_change',title:'Storage change: 100 GB'}));
});