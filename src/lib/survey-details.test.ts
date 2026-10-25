import { describe, expect, it } from "vitest";
import { addSurveyTrade, canSubmitSurvey, groupSurveyObservations, parseSurveyDetails, surveyReviewerOptions } from "./survey-details";

describe("survey field workflow", () => {
  it("retains more than one contact including emails", () => {
    const contacts = [{ id: "1", name: "Caretaker", email: "caretaker@example.com", phone: "123", position: "Caretaker" }, { id: "2", name: "Owner", email: "owner@example.com", phone: "456", position: "Owner" }];
    expect(parseSurveyDetails({ contacts }).contacts).toEqual(contacts);
  });
  it("allows a trade outside company specialties", () => expect(addSurveyTrade(["electrical"], "Pool maintenance")).toEqual(["electrical", "Pool maintenance"]));
  it("avoids duplicate named trades", () => expect(addSurveyTrade(["Pool maintenance"], " pool MAINTENANCE ")).toEqual(["Pool maintenance"]));
  it("groups room findings separately for electrical plumbing and drains", () => {
    const d = parseSurveyDetails({ trades: ["electrical", "plumbing", "drains"], observations: [{ id: "1", area: "Kitchen", trade: "electrical", notes: "Socket", photos: [] }, { id: "2", area: "Kitchen", trade: "plumbing", notes: "Tap", photos: [] }, { id: "3", area: "Kitchen", trade: "drains", notes: "Drain", photos: [] }] });
    expect(groupSurveyObservations(d).map(g => g.observations.map(o => o.id))).toEqual([["1"], ["2"], ["3"]]);
  });
  it("field staff can select supervisors only", () => expect(surveyReviewerOptions([{ role: "admin" }, { role: "supervisor" }, { role: "superuser" }], false)).toEqual([{ role: "supervisor" }]));
  it("allows submission with client and location captured on site", () => expect(canSubmitSurvey({ client_id: null, site_id: null, scope_summary: "Repair pipe" }, parseSurveyDetails({ clientName: "New prospect", siteName: "Shop 2", address: "Main Street" }))).toBe(true));
  it("does not submit an unidentified site", () => expect(canSubmitSurvey({ client_id: null, site_id: null, scope_summary: "Repair pipe" }, parseSurveyDetails({ clientName: "New prospect", siteName: "Shop 2" }))).toBe(false));
});
import { surveyItemsPending } from "./survey-details";
describe("materials completion", () => {
  it("is pending when nothing listed and not marked N/A", () => { expect(surveyItemsPending([], [], {})).toBe(true); });
  it("is complete when marked not applicable", () => { expect(surveyItemsPending([], [], { materialsNA: true })).toBe(false); });
  it("is pending when an item has no name", () => { expect(surveyItemsPending([{ label: " " }], [], { materialsNA: true })).toBe(true); });
});
