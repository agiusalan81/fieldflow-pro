export type MonthlySheet = { id: string; client_id: string; created_at: string; status: string; signature_data?: string | null; clients?: { name: string } | null };
export function monthlyGroups<T extends MonthlySheet>(sheets: T[]) {
  const groups = new Map<string, { clientId: string; clientName: string; month: string; sheets: T[] }>();
  for (const sheet of sheets) {
    const month = sheet.created_at.slice(0, 7);
    const key = `${sheet.client_id}:${month}`;
    const group = groups.get(key) ?? { clientId: sheet.client_id, clientName: sheet.clients?.name ?? "Client", month, sheets: [] };
    group.sheets.push(sheet); groups.set(key, group);
  }
  return [...groups.values()].sort((a, b) => b.month.localeCompare(a.month) || a.clientName.localeCompare(b.clientName));
}
export function unsignedQueue<T extends MonthlySheet>(sheets: T[]) {
  return sheets.filter((s) => s.status !== "completed" && !s.signature_data).sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id));
}
export function validateMonthlyQueue(sheets: MonthlySheet[], clientId: string, month: string) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error("Choose a calendar month");
  if (!sheets.length || sheets.some((s) => s.client_id !== clientId || s.created_at.slice(0, 7) !== month)) throw new Error("Choose sheets for one client and month");
  if (unsignedQueue(sheets).length !== sheets.length) throw new Error("Only unsigned, unfinished sheets can enter a signing queue");
}