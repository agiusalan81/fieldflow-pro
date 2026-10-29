import { describe, expect, it } from "vitest";
import { unreadByThread } from "./chat-unread";

const me = "me";
describe("unreadByThread", () => {
  it("counts assigned channel messages under their channel", () => {
    expect(unreadByThread([{sender_id:'a',receiver_id:null,job_sheet_id:null,channel_id:'carpenters',created_at:'2026-10-29T10:00:00Z'}],{},me)).toEqual({'channel:carpenters':1});
  });
  it("broadcast replies stay private direct messages", () => {
    expect(unreadByThread([{sender_id:'a',receiver_id:me,job_sheet_id:null,created_at:'2026-10-29T10:00:00Z'}],{},me)).toEqual({'user:a':1});
  });
  it("counts only others' messages after last read", () => {
    const msgs = [
      { sender_id: "a", receiver_id: me, job_sheet_id: null, created_at: "2026-10-01T10:00:00Z" },
      { sender_id: "a", receiver_id: me, job_sheet_id: null, created_at: "2026-10-01T12:00:00Z" },
      { sender_id: me, receiver_id: "a", job_sheet_id: null, created_at: "2026-10-01T13:00:00Z" },
      { sender_id: "b", receiver_id: null, job_sheet_id: "j1", created_at: "2026-10-01T09:00:00Z" },
    ];
    expect(unreadByThread(msgs, { "user:a": "2026-10-01T11:00:00Z" }, me)).toEqual({ "user:a": 1, "job:j1": 1 });
  });
  it("ignores direct messages between other people", () => {
    expect(unreadByThread([{ sender_id: "a", receiver_id: "b", job_sheet_id: null, created_at: "2026-10-01T10:00:00Z" }], {}, me)).toEqual({});
  });
});
