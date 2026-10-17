import { describe, it, expect } from "vitest";
import { clientPhotos, parsePhotos } from "./jobsheets";

describe("job sheet photos", () => {
  it("pending-works photos are never sent to the client", () => {
    const photos = parsePhotos([
      { path: "a.jpg", scope: "work", kind: "damage", day: 0 },
      { path: "b.jpg", scope: "pending", kind: "other", day: null },
      { path: "c.jpg", scope: "work", kind: "part", day: 1 },
    ]);
    expect(clientPhotos(photos).map((p) => p.path)).toEqual(["a.jpg", "c.jpg"]);
  });
  it("ignores legacy/invalid entries", () => {
    expect(parsePhotos(["x.jpg", null, { path: "y.jpg" }])).toEqual([]);
  });
});
