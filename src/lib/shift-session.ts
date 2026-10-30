/** Unknown shift status must never cause a voluntary session teardown. */
export function canSignOutAfterShiftCheck(clockedIn: boolean | undefined): boolean {
  return clockedIn === false;
}

export const TEST_RETURN_KEY = 'fb-test-return-session';

/** UX exemption only; stored state never grants server permissions. */
export function isLoadedTestSession(userId: string, stored: string | null): boolean {
  try {
    const value: unknown = JSON.parse(stored ?? 'null');
    if (!value || typeof value !== 'object') return false;
    return 'targetId' in value && value.targetId === userId &&
      'refresh_token' in value && typeof value.refresh_token === 'string' && value.refresh_token.length > 0;
  } catch { return false; }
}