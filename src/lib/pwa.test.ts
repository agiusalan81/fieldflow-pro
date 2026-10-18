import { expect, it } from "vitest";
import { pwaRefused } from "./pwa-rules";
it("never registers app caches in preview, development or a kill-switch context", () => {
  expect(pwaRefused(false, false, "fieldflow-flexible-core.lovable.app", "")).toBe(true);
  expect(pwaRefused(true, true, "fieldflow-flexible-core.lovable.app", "")).toBe(true);
  expect(pwaRefused(true, false, "id-preview--123.lovable.app", "")).toBe(true);
  expect(pwaRefused(true, false, "fieldflow-flexible-core.lovable.app", "?sw=off")).toBe(true);
  expect(pwaRefused(true, false, "fieldflow-flexible-core.lovable.app", "")).toBe(false);
});