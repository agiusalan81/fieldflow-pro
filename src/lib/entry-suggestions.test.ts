import { expect, it } from "vitest";
import { recentSuggestions } from "./entry-suggestions";

it("keeps the most recent spelling and removes empty or duplicate previous entries", () => {
  expect(recentSuggestions([" Door stuck ", "door stuck", "", null, "Replaced switch"])).toEqual(["Door stuck", "Replaced switch"]);
});
it("bounds previous-entry suggestions to 30", () => {
  expect(recentSuggestions(Array.from({ length: 50 }, (_, i) => `Part ${i}`))).toHaveLength(30);
});