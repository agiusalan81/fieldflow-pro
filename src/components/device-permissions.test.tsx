import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ role:'technician', push:'needs-permission', gps:'prompt', linked:'', fixes:0, registrations:0 }));
vi.mock('@/lib/profile', () => ({ useProfile: () => ({data:{id:'field-1',real_role:state.role},isLoading:false}) }));
vi.mock('@/lib/web-push', () => ({ readPushStatus:async()=>state.push, registerPush:async()=>{state.registrations++;return state.linked || state.push;}, pushSupported:()=>true }));
vi.mock('@/lib/field-device', async original => ({...await original<typeof import('@/lib/field-device')>(), readLocationPermission:async()=>state.gps, confirmFieldLocation:async()=>{state.fixes++;state.gps='granted';localStorage.setItem('fieldbridge:location-device-confirmed','yes');return 'granted';} }));
vi.mock('@/components/shift-sign-out', () => ({ ShiftSignOut:()=>null }));
vi.mock('@/components/test-session-switch', () => ({ ReturnToSuperuserBanner:()=>null }));
import { DevicePermissions } from './device-permissions';
import { dismissSetup } from '@/lib/device-setup';
beforeEach(() => {state.role='technician';state.push='needs-permission';state.gps='prompt';state.linked='';state.fixes=0;state.registrations=0;vi.stubGlobal('Notification',{permission:'default',requestPermission:async()=>{state.push='registered';return 'granted';}});});
afterEach(()=>{cleanup();vi.unstubAllGlobals();localStorage.clear();});
it('withholds field work despite a previous setup dismissal until both requirements are met', async()=>{
  dismissSetup('field-1');
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
  await waitFor(()=>expect(screen.getByText('Office workspace')).toBeTruthy());
});
it('does not request another GPS fix or registration on focus after device confirmation', async()=>{
  state.push='registered';state.gps='granted';
  localStorage.setItem('fieldbridge:location-device-confirmed','yes');
  render(<DevicePermissions><div>Field workspace</div></DevicePermissions>);
  await screen.findByText('Field workspace');
  window.dispatchEvent(new Event('focus'));
  await waitFor(()=>expect(state.registrations).toBe(1));
  expect(state.fixes).toBe(0);
  expect(screen.queryByRole('dialog')).toBeNull();
});
it('retains confirmed access through a transient push relinking error', async()=>{
  state.push='registered';state.gps='granted';state.linked='error';
  localStorage.setItem('fieldbridge:location-device-confirmed','yes');
  render(<DevicePermissions><div>Field workspace</div></DevicePermissions>);
  await screen.findByText('Field workspace');
  expect(screen.queryByRole('dialog')).toBeNull();
});
it('blocks again when current browser location permission is revoked', async()=>{
  state.push='registered';state.gps='granted';
  localStorage.setItem('fieldbridge:location-device-confirmed','yes');
  render(<DevicePermissions><div>Field workspace</div></DevicePermissions>);
  await screen.findByText('Field workspace');
  state.gps='denied';window.dispatchEvent(new Event('focus'));
  await screen.findByRole('dialog');
  expect(screen.queryByText('Field workspace')).toBeNull();
});
it('blocks again if the actual push subscription disappears', async()=>{
  state.push='registered';state.gps='granted';
  localStorage.setItem('fieldbridge:location-device-confirmed','yes');
  render(<DevicePermissions><div>Field workspace</div></DevicePermissions>);
  await screen.findByText('Field workspace');
  state.push='no-worker';window.dispatchEvent(new Event('focus'));
  await screen.findByRole('dialog');
  expect(screen.queryByText('Field workspace')).toBeNull();
});