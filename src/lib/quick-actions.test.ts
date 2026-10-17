import { describe, it, expect } from "vitest";
import { rankActions } from "./quick-actions";
import { searchCountries } from "@/components/client-manager";

describe("quick actions", () => {
  it("uses role defaults with no taps", () => {
    expect(rankActions(["/a", "/b", "/c"], ["/a", "/b", "/c", "/d"], {}, 3)).toEqual(["/a", "/b", "/c"]);
  });
  it("most-tapped items move to the front", () => {
    expect(rankActions(["/a", "/b", "/c"], ["/a", "/b", "/c", "/d"], { "/d": 5, "/c": 2 }, 3)).toEqual(["/d", "/c", "/a"]);
  });
  it("never shows screens the role can't open", () => {
    expect(rankActions(["/a", "/x"], ["/a"], { "/x": 9 }, 3)).toEqual(["/a"]);
  });
});

describe("country search", () => {
  it("finds by country name", () => { expect(searchCountries("malt")[0]?.[0]).toBe("+356"); });
  it("finds by dial code with or without plus", () => {
    expect(searchCountries("44").map((c) => c[1])).toContain("UK");
    expect(searchCountries("+39").map((c) => c[1])).toContain("Italy");
  });
});
