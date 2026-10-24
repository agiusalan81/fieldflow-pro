export const deviceSetupKey = (userId: string) => `fieldbridge:device-setup:${userId}`;
export function setupDismissed(userId: string): boolean {
  try { return localStorage.getItem(deviceSetupKey(userId)) === 'dismissed'; } catch { return false; }
}
export function dismissSetup(userId: string): void {
  try { localStorage.setItem(deviceSetupKey(userId), 'dismissed'); } catch { /* Private storage may be unavailable. */ }
}