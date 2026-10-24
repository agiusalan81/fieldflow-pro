export const isMobileDevice = (agent: string) => /Android|iPhone|iPad|iPod|Mobile/i.test(agent);
export const passwordsMatch = (password: string, confirmation: string) => password.length >= 8 && password === confirmation;
export const dwrEligible = (role: string) => role === 'technician' || role === 'supervisor';
/** The anchor persists the handover weekday without introducing a second conflicting setting. */
export function nextWeekday(date: string, weekday: number) {
  const d = new Date(`${date}T12:00:00Z`);
  if (!Number.isFinite(d.getTime()) || !Number.isInteger(weekday) || weekday < 0 || weekday > 6) return date;
  d.setUTCDate(d.getUTCDate() + (weekday - d.getUTCDay() + 7) % 7);
  return d.toISOString().slice(0, 10);
}