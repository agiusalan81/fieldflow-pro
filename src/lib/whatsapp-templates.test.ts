import { describe, it, expect } from "vitest";
import { validateDraft, previewDraft } from "./whatsapp-templates";

const ok = { name: "on_my_way", language: "en", category: "UTILITY" as const, body: "Hi {{1}}, our technician {{2}} is on the way and should be with you in about {{3}}, depending on traffic.", examples: ["Alan", "Jorey", "30 mins"], notes: "" };

describe("whatsapp template rules", () => {
  it("accepts a well-formed draft", () => expect(validateDraft(ok)).toEqual([]));
  it("rejects uppercase names", () => expect(validateDraft({ ...ok, name: "On My Way" }).length).toBeGreaterThan(0));
  it("requires one sample per placeholder", () => expect(validateDraft({ ...ok, examples: ["Alan"] })).toContain("Each placeholder needs a sample value."));
  it("rejects skipped placeholder numbers", () => expect(validateDraft({ ...ok, body: ok.body.replace("{{2}}", "Jorey") }).some((e) => e.includes("{{2}}"))).toBe(true));
  it("rejects ending with a placeholder", () => expect(validateDraft({ ...ok, body: "Hello there, your technician today is {{1}}", examples: ["Jorey"] })).toContain("The message can't start or end with a placeholder."));
  it("previews with samples", () => expect(previewDraft(ok)).toContain("Hi Alan"));
});
