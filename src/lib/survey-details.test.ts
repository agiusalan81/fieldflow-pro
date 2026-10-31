import { describe, expect, it } from "vitest";
import { addSurveyTrade, canSubmitSurvey, generatedSurveyScope, resolvedSurveyScope, groupSurveyObservations, parseSurveyDetails, surveyReviewerOptions, surveyTradeOptions } from "./survey-details";

describe("survey field workflow", () => {
  it('offers configured company services including bespoke equipment trades', () => expect(surveyTradeOptions(['heating', 'Pool repairs']).map(t => t.key)).toEqual(['heating', 'Pool repairs']));
  it('keeps room observations and photos without selected trades', () => {
    const d = parseSurveyDetails({ observations: [{ id: 'room1', area: 'Room 101', trade: '', notes: 'Leak', photos: ['tenant/site-surveys/photo.jpg'] }] });
    expect(groupSurveyObservations(d)[0]?.observations[0]).toMatchObject({ area: 'Room 101', photos: ['tenant/site-surveys/photo.jpg'] });
  });
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
  it('accepts room findings without a separately written scope', () => {
    const details = parseSurveyDetails({ observations: [{ id: '1', area: 'Lift pit', trade: 'lifts', notes: 'Replace damaged screen', photos: [] }] });
    expect(canSubmitSurvey({ client_id: 'client', site_id: 'site', scope_summary: '' }, details)).toBe(true);
    expect(generatedSurveyScope(details)).toContain('Lift pit (Lifts): Replace damaged screen');
  });
  it('accepts added items without a separately written scope', () => {
    const survey = { client_id: 'client', site_id: 'site', scope_summary: '', materials: [{ label: 'Cw screen bespoke', qty: 1 }] };
    expect(canSubmitSurvey(survey, parseSurveyDetails({}))).toBe(true);
    expect(resolvedSurveyScope(survey, parseSurveyDetails({}))).toBe('Materials & equipment\nCw screen bespoke × 1');
  });
  it('combines findings and both item lists', () => {
    const details = parseSurveyDetails({ observations: [{ id: '1', area: 'Room 101', trade: '', notes: 'Repair leak', photos: [] }] });
    expect(generatedSurveyScope(details, [{ label: 'Tap', qty: 1 }], [{ label: 'Seal', qty: 2 }])).toBe('Observations / work needed\nRoom 101: Repair leak\n\nMaterials & equipment\nTap × 1\nSeal × 2');
  });
  it('preserves a tenant-written summary instead of overwriting it', () => expect(resolvedSurveyScope({ scope_summary: 'Agreed repairs', materials: [{ label: 'Seal' }] }, parseSurveyDetails({}))).toBe('Agreed repairs'));
  it('does not treat empty observations or area names as described work', () => expect(canSubmitSurvey({ client_id: 'client', site_id: 'site', scope_summary: '', materials: [{ label: ' ' }] }, parseSurveyDetails({ observations: [{ id: '1', area: 'Lift pit', notes: '', trade: '', photos: [] }] }))).toBe(false));
});
import { surveyItemsPending } from "./survey-details";
describe("materials completion", () => {
  it("is pending when nothing listed and not marked N/A", () => { expect(surveyItemsPending([], [], {})).toBe(true); });
  it("is complete when marked not applicable", () => { expect(surveyItemsPending([], [], { materialsNA: true })).toBe(false); });
  it("is pending when an item has no name", () => { expect(surveyItemsPending([{ label: " " }], [], { materialsNA: true })).toBe(true); });
});
