import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
const { from } = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from } }));
import { ShiftClockInDialog } from './shift-clock-in-dialog';
afterEach(cleanup);
describe('shared vehicle plate prompt', () => {
  it('allows typing while the previous vehicle is still loading and does not overwrite it', async () => {
    let resolve: ((value: unknown) => void) | undefined;
    const pending = new Promise(r => { resolve = r; });
    const chain: Record<string, unknown> = {};
    for (const key of ['select', 'eq', 'not', 'order', 'limit']) chain[key] = () => chain;
    chain['maybeSingle'] = () => pending; from.mockReturnValue(chain);
    render(<ShiftClockInDialog userId="tech-1" open onOpenChange={vi.fn()} onConfirm={vi.fn()} />);
    const input = screen.getByLabelText('Vehicle registration');
    expect(input).not.toBeDisabled(); fireEvent.change(input, { target: { value: 'XYZ 987' } });
    resolve?.({ data: { vehicle_reg: 'ABC123' }, error: null });
    await waitFor(() => expect(screen.queryByRole('status')).toBeNull());
    expect(input).toHaveValue('XYZ 987');
  });
  it('prefills the prior shift and confirms the edited vehicle for Clock in & start', async () => {
    const chain: Record<string, unknown> = {};
    for (const key of ['select', 'eq', 'not', 'order', 'limit']) chain[key] = () => chain;
    chain['maybeSingle'] = async () => ({ data: { vehicle_reg: 'ABC123' }, error: null });
    from.mockReturnValue(chain);
    const confirm = vi.fn().mockResolvedValue(undefined), close = vi.fn();
    render(<ShiftClockInDialog userId="tech-1" open onOpenChange={close} onConfirm={confirm} label="Clock in & start" />);
    const input = screen.getByLabelText('Vehicle registration');
    await waitFor(() => expect(input).toHaveValue('ABC 123'));
    fireEvent.change(input, { target: { value: 'AB12' } });
    expect(screen.getByRole('button', { name: 'Clock in & start' })).toBeDisabled();
    fireEvent.change(input, { target: { value: 'XYZ987' } });
    fireEvent.click(screen.getByRole('button', { name: 'Clock in & start' }));
    await waitFor(() => expect(confirm).toHaveBeenCalledWith('XYZ987'));
    expect(close).toHaveBeenCalledWith(false);
  });
});