/** Skills & Smart Dispatch rules shared by the dispatch form and tests. The database enforces the same rules. */
export const STANDARD_MAX_TEAM = 2;
export const MAX_TEAM = 30;

/** Without the module a job holds a lead plus one optional assistant. */
export function maxTeamSize(moduleOn: boolean) { return moduleOn ? MAX_TEAM : STANDARD_MAX_TEAM; }

export function clampTeamSize(n: number, moduleOn: boolean) {
  if (!Number.isFinite(n)) return 1;
  return Math.min(maxTeamSize(moduleOn), Math.max(1, Math.round(n)));
}

/** Standard dispatch derives its size from the lead/assistant, not a hidden form default. */
export function dispatchTeamSize(requested: number, moduleOn: boolean, named: number) {
  return moduleOn ? clampTeamSize(requested, true) : clampTeamSize(named, false);
}

/** A member is eligible when they hold every mandatory skill. */
export function hasMandatorySkills(memberSkills: string[], mandatory: string[]) {
  const have = new Set(memberSkills);
  return mandatory.every(s => have.has(s));
}

/** Count of required skills a member holds, for ranking suggestions. */
export function skillMatchScore(memberSkills: string[], required: string[]) {
  const have = new Set(memberSkills);
  return required.filter(s => have.has(s)).length;
}

export function placesLeft(teamSize: number, assigned: number) { return Math.max(0, teamSize - assigned); }
