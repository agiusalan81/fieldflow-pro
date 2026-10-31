import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import type { Profile } from '@/lib/profile';
import { guideKey } from '@/lib/onboarding';
vi.mock('@tanstack/react-router', () => ({ useNavigate: () => vi.fn(), useRouterState: () => '/dashboard' }));
import { WelcomeGuide } from './welcome-guide';
const profile = { id: 'test-user', company_id: 'test-company', real_role: 'technician' } as Profile;
afterEach(() => { cleanup(); sessionStorage.clear(); vi.restoreAllMocks(); });
it('does not automatically resume a stored tour during signup/setup', () => {
  sessionStorage.setItem(`${guideKey(profile.id, profile.company_id)}:step`, '0');
  render(<WelcomeGuide profile={profile} allowed={['/dashboard']} />);
  expect(screen.queryByRole('dialog', { name: 'Guided tour' })).toBeNull();
});
it('closes a requested tour when a setup dialog appears and does not reopen it', async () => {
  vi.spyOn(HTMLElement.prototype, 'getClientRects').mockReturnValue([{ width: 100, height: 100 }] as unknown as DOMRectList);
  render(<WelcomeGuide profile={profile} allowed={['/dashboard']} />);
  fireEvent.click(screen.getByRole('button', { name: 'Start guided tour' }));
  expect(screen.getByRole('dialog', { name: 'Guided tour' })).toBeTruthy();
  const setup = document.createElement('div'); setup.setAttribute('role', 'dialog'); document.body.append(setup);
  await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Guided tour' })).toBeNull());
  setup.remove();
  await waitFor(() => expect(screen.getByRole('button', { name: 'Start guided tour' })).not.toBeDisabled());
  expect(screen.queryByRole('dialog', { name: 'Guided tour' })).toBeNull();
});