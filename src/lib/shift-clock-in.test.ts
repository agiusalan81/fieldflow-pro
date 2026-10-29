import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Profile } from './profile';
const { insert, from, rpc } = vi.hoisted(() => ({ insert: vi.fn(), from: vi.fn(), rpc: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from, rpc } }));
import { clockInShift } from './shift-clock-in';
const profile = { id: 'tech-1', company_id: 'company-1', real_role: 'technician' } as Profile;
describe('shared shift clock-in', () => {
  const locate = vi.fn();
  beforeEach(() => {
    vi.clearAllMocks(); localStorage.clear();
    from.mockReturnValue({ insert }); insert.mockResolvedValue({ error: null });
    rpc.mockResolvedValue({data:true,error:null});
    Object.defineProperty(navigator, 'geolocation', { configurable: true, value: { getCurrentPosition: locate } });
  });
  it('stores the editable 3-letter 3-number plate on the shift', async () => {
    await clockInShift(profile, 'xyz 987');
    expect(from).toHaveBeenCalledWith('shifts');
    expect(insert).toHaveBeenCalledWith({ shift_type: 'shift', company_id: 'company-1', user_id: 'tech-1', vehicle_reg: 'XYZ987', vehicle_use: 'driver' });
  });
  it('does not clock in or ask for location without a valid plate', async () => {
    await expect(clockInShift(profile, '')).rejects.toThrow('3 letters and 3 numbers');
    expect(insert).not.toHaveBeenCalled(); expect(locate).not.toHaveBeenCalled();
  });
  it.each(['technician', 'supervisor'])('requests shift location for %s and records account consent after permission', async role => {
    await clockInShift({ ...profile, real_role: role as Profile['real_role'] }, 'ABC123');
    expect(locate).toHaveBeenCalledOnce();
    expect(localStorage.getItem('location-consent:tech-1')).toBeNull();
    locate.mock.calls[0]?.[0]();
    expect(localStorage.getItem('location-consent:tech-1')).toBe('yes');
  });
  it.each(['admin', 'superuser'])('does not request location for %s', async role => {
    await clockInShift({ ...profile, real_role: role as Profile['real_role'] }, 'ABC123');
    expect(locate).not.toHaveBeenCalled();
  });
  it('does not request location after a failed shift insert', async () => {
    insert.mockResolvedValue({ error: new Error('Denied') });
    await expect(clockInShift(profile, 'ABC123')).rejects.toThrow('Denied');
    expect(locate).not.toHaveBeenCalled();
  });
  it('clock-in remains available with tracking off and never requests GPS',async()=>{rpc.mockResolvedValue({data:false,error:null});await clockInShift(profile,'ABC123');expect(insert).toHaveBeenCalledOnce();expect(locate).not.toHaveBeenCalled();});
});