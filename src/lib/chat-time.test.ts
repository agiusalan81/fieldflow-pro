import { describe, expect, it } from "vitest";
import { chatContactVisible, chatDayLabel, needsDayDivider, needsGapMarker } from "./chat-time";

const now = new Date(2026, 9, 27, 15, 0);
describe("chat time", () => {
  it("labels today and yesterday", () => {
    expect(chatDayLabel(new Date(2026, 9, 27, 9).toISOString(), now)).toBe("Today");
    expect(chatDayLabel(new Date(2026, 9, 26, 23).toISOString(), now)).toBe("Yesterday");
  });
  it("adds a divider when the day changes", () => {
    expect(needsDayDivider(new Date(2026, 9, 26, 23).toISOString(), new Date(2026, 9, 27, 1).toISOString())).toBe(true);
    expect(needsDayDivider(new Date(2026, 9, 27, 1).toISOString(), new Date(2026, 9, 27, 2).toISOString())).toBe(false);
  });
  it("marks same-day gaps of 3 hours", () => {
    expect(needsGapMarker(new Date(2026, 9, 27, 8).toISOString(), new Date(2026, 9, 27, 11).toISOString())).toBe(true);
    expect(needsGapMarker(new Date(2026, 9, 27, 8).toISOString(), new Date(2026, 9, 27, 10).toISOString())).toBe(false);
  });
  it("hides terminated members", () => {
    expect(chatContactVisible("terminated")).toBe(false);
    expect(chatContactVisible("active")).toBe(true);
  });
});
