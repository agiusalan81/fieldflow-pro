import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ role:'technician', push:'needs-permission', gps:'prompt' }));
vi.mock('@/lib/profile', () => ({ useProfile: () => ({data:{id:'field-1',real_role:state.role},isLoading:false}) }));
vi.mock('@/lib/web-push', () => ({ registerPush:async()=>state.push, pushSupported:()=>true }));
vi.mock('@/lib/field-device', async original => ({...await original<typeof import('@/lib/field-device')>(), readLocationPermission:async()=>state.gps, confirmFieldLocation:async()=>{state.gps='granted';return 'granted';} }));
vi.mock('@/components/shift-sign-out', () => ({ ShiftSignOut:()=>null }));
vi.mock('@/components/test-session-switch', () => ({ ReturnToSuperuserBanner:()=>null }));
import { DevicePermissions } from './device-permissions';
beforeEach(() => {state.role='technician';state.push='needs-permission';state.gps='prompt';vi.stubGlobal('Notification',{permission:'default',requestPermission:async()=>{state.push='registered';return 'granted';}});});
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
it('withholds field work despite a previous setup dismissal until both requirements are met', async()=>{
  localStorage.setItem('fieldops:device-setup:field-1','yes');
  render(<DevicePermissions><div>Field workspace</div></DevicePermissions>);
  await screen.findByRole('dialog');
  expect(screen.queryByText('Field workspace')).toBeNull();
  expect(screen.queryByRole('button',{name:'Continue without setup'})).toBeNull();
  fireEvent.click(screen.getByRole('button',{name:'Enable notifications & location'}));
  await waitFor(()=>expect(screen.getByText('Field workspace')).toBeTruthy());
});
it('does not accept an unsupported notification device for field work', async()=>{
  state.push='unsupported';state.gps='granted';
  render(<DevicePermissions><div>Field workspace</div></DevicePermissions>);
  await screen.findByRole('dialog');
  expect(screen.queryByText('Field workspace')).toBeNull();
});
it('office-only staff are not blocked by field requirements', async()=>{
  state.role='admin';
  render(<DevicePermissions><div>Office workspace</div></DevicePermissions>);
  expect(screen.getByText('Office workspace')).toBeTruthy();
});