import { describe, expect, it } from "vitest";
import { canResetTestCompany, isStorageAddon, tenantLocation, trialUsesFullFeatures } from "./hq";
import { featureOn } from "./plan-features";
describe("HQ trial module control", () => {
  it('immediate trial-to-tier application disables full-trial entitlement fallback',()=>{expect(trialUsesFullFeatures('trial',true)).toBe(false);expect(trialUsesFullFeatures('trial',false)).toBe(true);});
  it("disables Malta payroll during a UK company's trial without disabling gross payroll", () => {
    const status = {state:"trial",modules:[{name:"payroll_statutory_mt",enabled:false},{name:"payroll",enabled:true}]};
    expect(featureOn(status,"payroll_statutory_mt")).toBe(false);
    expect(featureOn(status,"payroll")).toBe(true);
  });
  it("disables payroll during a trial independently of standby", () => {
    const status = {state:"trial",modules:[{name:"payroll",enabled:false},{name:"standby",enabled:true}]};
    expect(featureOn(status,"payroll")).toBe(false);
    expect(featureOn(status,"standby")).toBe(true);
  });
});
describe("HQ test reset eligibility", () => {
  it("rejects a production company even with the exact name", () => expect(canResetTestCompany(false,"Minakel","Minakel",["qs_pricing"])).toBe(false));
  it("requires an exact company-name confirmation", () => expect(canResetTestCompany(true,"Minakel","Other company",["qs_pricing"])).toBe(false));
  it("rejects payroll clearing", () => expect(canResetTestCompany(true,"Minakel","Minakel",["payroll"])).toBe(false));
  it("accepts only selected supported modules for designated test companies", () => expect(canResetTestCompany(true,"Minakel","Minakel",["qs_pricing","skills_dispatch"])).toBe(true));
  it("does not permit an empty selection", () => expect(canResetTestCompany(true,"Minakel","Minakel",[])).toBe(false));
});
describe("HQ company location", () => {
  it("keeps city and country distinct without inferring a country", () => {expect(tenantLocation("London", "United Kingdom")).toBe("London, United Kingdom");expect(tenantLocation("London", "")).toBe("London");});
});
describe("HQ storage add-on grouping", () => {
  it("separates storage-only packs from feature switches", () => {
    expect(isStorageAddon({ kind: "pack", storage_gb: 25, modules: [] })).toBe(true);
  });
  it("keeps feature bundles with included storage in module packs", () => {
    expect(isStorageAddon({ kind: "pack", storage_gb: 100, modules: ["fleet"] })).toBe(false);
  });
  it("keeps tiers and empty module-pack drafts out of storage add-ons", () => {
    expect(isStorageAddon({ kind: "plan", storage_gb: 10, modules: [] })).toBe(false);
    expect(isStorageAddon({ kind: "pack", storage_gb: 0, modules: [] })).toBe(false);
  });
});