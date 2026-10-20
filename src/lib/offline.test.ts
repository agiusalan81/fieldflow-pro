import "fake-indexeddb/auto";
import { openDB } from "idb";
import { describe, it, expect, vi } from "vitest";
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
import { discardLocalDraft, saveLocalDraft, getLocalDraft, saveLocalPhoto, localPhoto, draftKey } from "./offline";

describe("explicit offline discard", () => {
  it("removes only the selected account's sheet draft, photos and sheet cache", async () => {
    const make = (userId: string, sheetId: string) => ({ key: draftKey(userId, sheetId), userId, sheetId, expected: "v1", form: {}, logs: [], parts: [], savedAt: "2026-10-20", error: "Job sheet unavailable" });
    for (const [user, sheet] of [["alice", "deleted"], ["alice", "other"], ["bob", "deleted"]] as const) {
      await saveLocalDraft(make(user, sheet));
      await saveLocalPhoto(user, sheet, `${user}/${sheet}/photo.jpg`, new Blob(["photo"]));
    }
    const database = await openDB("fieldops-offline", 1);
    await database.put("cache", [{ key: ["sheet", "deleted"], data: "stale" }, { key: ["sheet", "other"], data: "keep" }, { key: ["profile"], data: "keep" }], "alice");
    await database.put("cache", [{ key: ["sheet", "deleted"], data: "bob" }], "bob");
    await discardLocalDraft("alice", "deleted");
    expect(await getLocalDraft("alice", "deleted")).toBeUndefined();
    expect(await localPhoto("alice", "alice/deleted/photo.jpg")).toBeUndefined();
    expect(await getLocalDraft("alice", "other")).toBeDefined();
    expect(await localPhoto("alice", "alice/other/photo.jpg")).toBeDefined();
    expect(await getLocalDraft("bob", "deleted")).toBeDefined();
    expect(await localPhoto("bob", "bob/deleted/photo.jpg")).toBeDefined();
    expect((await database.get("cache", "alice")).map((r: { key: string[] }) => r.key)).toEqual([["sheet", "other"], ["profile"]]);
    expect(await database.get("cache", "bob")).toEqual([{ key: ["sheet", "deleted"], data: "bob" }]);
  });
});