import { openDB } from "idb";
import type { QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
export type DraftSnapshot = { key: string; userId: string; sheetId: string; expected: string; form: Record<string, unknown>; logs: Record<string, unknown>[]; parts: Record<string, unknown>[]; savedAt: string; error?: string };
type LocalPhoto = { key: string; userId: string; sheetId: string; blob: Blob };
const db = () => openDB("fieldops-offline", 1, { upgrade(database) {
  database.createObjectStore("drafts", { keyPath: "key" });
  database.createObjectStore("photos", { keyPath: "key" });
  database.createObjectStore("cache");
} });
export const draftKey = (userId: string, sheetId: string) => `${userId}:${sheetId}`;
export async function saveLocalDraft(snapshot: DraftSnapshot) {
  await (await db()).put("drafts", snapshot); window.dispatchEvent(new Event("fieldops-offline"));
}
export async function getLocalDraft(userId: string, sheetId: string): Promise<DraftSnapshot | undefined> {
  return (await db()).get("drafts", draftKey(userId, sheetId));
}
export async function pendingDrafts(userId: string): Promise<DraftSnapshot[]> {
  return ((await (await db()).getAll("drafts")) as DraftSnapshot[]).filter((d) => d.userId === userId);
}
export async function removeLocalDraft(userId: string, sheetId: string) {
  await (await db()).delete("drafts", draftKey(userId, sheetId)); window.dispatchEvent(new Event("fieldops-offline"));
}
export async function saveLocalPhoto(userId: string, sheetId: string, path: string, blob: Blob) {
  await (await db()).put("photos", { key: `${userId}:${path}`, userId, sheetId, blob });
}
export async function localPhoto(userId: string, path: string): Promise<Blob | undefined> {
  return ((await (await db()).get("photos", `${userId}:${path}`)) as LocalPhoto | undefined)?.blob;
}
export async function deleteLocalPhoto(userId: string, path: string) { await (await db()).delete("photos", `${userId}:${path}`); }
export async function uploadLocalPhotos(userId: string, sheetId: string) {
  const database = await db();
  for (const photo of (await database.getAll("photos")) as LocalPhoto[]) {
    if (photo.userId !== userId || photo.sheetId !== sheetId) continue;
    const path = photo.key.slice(userId.length + 1);
    const { error } = await supabase.storage.from("job-photos").upload(path, photo.blob, { contentType: photo.blob.type || "image/jpeg", upsert: true });
    if (error) throw error;
  }
}
export async function syncDraft(snapshot: DraftSnapshot) {
  const { data: identity } = await supabase.auth.getUser();
  if (identity.user?.id !== snapshot.userId) throw new Error("Sign back into the account that saved this draft");
  await uploadLocalPhotos(snapshot.userId, snapshot.sheetId);
  const { data, error } = await supabase.rpc("save_sheet_snapshot", { _id: snapshot.sheetId, _expected: snapshot.expected, _form: snapshot.form as Json, _logs: snapshot.logs as Json, _parts: snapshot.parts as Json });
  if (error) throw error;
  if (!data) throw new Error("Draft could not be confirmed");
  const photos = (await (await db()).getAll("photos")) as LocalPhoto[];
  for (const photo of photos.filter((p) => p.userId === snapshot.userId && p.sheetId === snapshot.sheetId)) await (await db()).delete("photos", photo.key);
  await removeLocalDraft(snapshot.userId, snapshot.sheetId);
  return data;
}
let syncing = false;
export async function syncPending(userId: string, qc: QueryClient) {
  if (syncing || !navigator.onLine) return;
  syncing = true;
  try {
    for (const snapshot of await pendingDrafts(userId)) {
      if (snapshot.error?.includes("CONFLICT")) continue;
      try { await syncDraft(snapshot); qc.invalidateQueries({ queryKey: ["sheet", snapshot.sheetId] }); }
      catch (e) { await saveLocalDraft({ ...snapshot, error: (e as Error).message }); }
    }
    qc.invalidateQueries({ queryKey: ["sheets"] }); qc.invalidateQueries({ queryKey: ["admin-jobs"] });
  } finally { syncing = false; window.dispatchEvent(new Event("fieldops-offline")); }
}
const cacheKeys = new Set(["profile", "sheet", "sheet-refs", "sheets", "checklists", "company-users", "company-rules", "notice-settings"]);
export async function restoreOfflineCache(userId: string, qc: QueryClient) {
  const rows = await (await db()).get("cache", userId) as { key: readonly unknown[]; data: unknown; updatedAt: number }[] | undefined;
  for (const row of rows ?? []) if (!qc.getQueryData(row.key)) qc.setQueryData(row.key, row.data, { updatedAt: row.updatedAt });
}
export async function persistOfflineCache(userId: string, qc: QueryClient) {
  const rows = qc.getQueryCache().getAll().filter((q) => cacheKeys.has(String(q.queryKey[0])) && q.state.status === "success").map((q) => ({ key: q.queryKey, data: q.state.data, updatedAt: q.state.dataUpdatedAt }));
  await (await db()).put("cache", rows, userId);
}
export async function clearOfflineCache(userId: string) { await (await db()).delete("cache", userId); }