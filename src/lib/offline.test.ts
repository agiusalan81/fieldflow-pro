import "fake-indexeddb/auto";
import { openDB } from "idb";
import { describe, it, expect, vi } from "vitest";
const api = vi.hoisted(() => ({ getUser: vi.fn(), rpc: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth: { getUser: api.getUser }, rpc: api.rpc } }));
import { discardLocalDraft, saveLocalDraft, getLocalDraft, saveLocalPhoto, localPhoto, draftKey, syncDraft, type DraftSnapshot } from "./offline";

describe("same-device sheet saves", () => {
  const snapshot = (sheetId: string, savedAt: string, expected = "v1"): DraftSnapshot => ({
    key: draftKey("editor", sheetId), userId: "editor", sheetId, expected,
    form: { repairs_performed: savedAt }, logs: [], parts: [], savedAt,
  });

  it("serializes overlapping autosave/manual/reconnect saves and rebases their captured versions", async () => {
    api.getUser.mockResolvedValue({ data: { user: { id: "editor" } } });
    let version = "v1";
    let release: (() => void) | undefined;
    let started: (() => void) | undefined;
    const entered = new Promise<void>(resolve => { started = resolve; });
    const held = new Promise<void>(resolve => { release = resolve; });
    const expected: string[] = [];
    api.rpc.mockImplementation(async (_name, args) => {
      expected.push(args._expected);
      if (expected.length === 1) { started?.(); await held; }
      if (args._expected !== version) return { data: null, error: new Error("CONFLICT") };
      version = `v${expected.length + 1}`;
      return { data: version, error: null };
    });
    const first = snapshot("overlap", "1");
    await saveLocalDraft(first);
    const firstSave = syncDraft(first);
    await entered;
    const second = snapshot("overlap", "2");
    await saveLocalDraft(second);
    const secondSave = syncDraft(second);
    const third = snapshot("overlap", "3");
    await saveLocalDraft(third);
    const thirdSave = syncDraft(third);
    const result = Promise.all([firstSave, secondSave, thirdSave]);
    release?.();
    await expect(result).resolves.toEqual(["v2", "v3", "v4"]);
    expect(expected).toEqual(["v1", "v2", "v3"]);
    expect(await getLocalDraft("editor", "overlap")).toBeUndefined();
  });

  it("keeps newer typing on the device when an earlier save finishes", async () => {
    api.getUser.mockResolvedValue({ data: { user: { id: "editor" } } });
    let release: (() => void) | undefined;
    let started: (() => void) | undefined;
    const entered = new Promise<void>(resolve => { started = resolve; });
    api.rpc.mockImplementation(async () => { started?.(); await new Promise<void>(resolve => { release = resolve; }); return { data: "v2", error: null }; });
    const first = snapshot("typing", "1");
    await saveLocalDraft(first);
    const saving = syncDraft(first);
    await entered;
    await saveLocalDraft(snapshot("typing", "2"));
    release?.();
    await saving;
    expect(await getLocalDraft("editor", "typing")).toMatchObject({ expected: "v2", form: { repairs_performed: "2" } });
  });

  it("does not bypass a genuine other-device version conflict or discard its draft", async () => {
    api.getUser.mockResolvedValue({ data: { user: { id: "editor" } } });
    api.rpc.mockResolvedValue({ data: null, error: new Error("CONFLICT: changed on another device") });
    const local = snapshot("external", "1");
    await saveLocalDraft(local);
    await expect(syncDraft(local)).rejects.toThrow("CONFLICT");
    expect(await getLocalDraft("editor", "external")).toEqual(local);
  });

  it("still rejects external edits between queued saves", async () => {
    api.getUser.mockResolvedValue({ data: { user: { id: "editor" } } });
    let count = 0;
    api.rpc.mockImplementation(async (_name, args) => {
      count += 1;
      if (count === 1) return { data: "v2", error: null };
      expect(args._expected).toBe("v2");
      return { data: null, error: new Error("CONFLICT: server advanced to external-v3") };
    });
    const first = syncDraft(snapshot("queued-external", "1"));
    const next = syncDraft(snapshot("queued-external", "2"));
    const rejected = expect(next).rejects.toThrow("CONFLICT");
    await expect(first).resolves.toBe("v2");
    await rejected;
  });

  it("does not block an unrelated sheet behind an in-flight save", async () => {
    api.getUser.mockResolvedValue({ data: { user: { id: "editor" } } });
    let release: (() => void) | undefined;
    let started: (() => void) | undefined;
    const entered = new Promise<void>(resolve => { started = resolve; });
    api.rpc.mockImplementation(async (_name, args) => {
      if (args._id === "held") { started?.(); await new Promise<void>(resolve => { release = resolve; }); }
      return { data: "v2", error: null };
    });
    const held = syncDraft(snapshot("held", "1"));
    await entered;
    await expect(syncDraft(snapshot("independent", "1"))).resolves.toBe("v2");
    release?.();
    await held;
  });
});

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