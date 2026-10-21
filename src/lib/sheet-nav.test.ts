import { describe, it, expect } from "vitest";
import { neighbours } from "./sheet-nav";

describe("neighbours", () => {
  const ids = ["a", "b", "c"];
  it("first sheet has no previous", () => expect(neighbours(ids, "a")).toMatchObject({ prev: null, next: "b" }));
  it("last sheet has no next", () => expect(neighbours(ids, "c")).toMatchObject({ prev: "b", next: null }));
  it("sheet outside the list has no neighbours", () => expect(neighbours(ids, "z")).toMatchObject({ prev: null, next: null }));
});
