import { describe, expect, it } from "vitest";
import { parsePhone, parseOfficeAddress, formatOfficeAddress } from "./contact-details";
it("preserves all eight digits while typing a Malta number", () => {
  for (const number of ["1", "12", "12345678"]) expect(parsePhone(`+356 ${number}`, "+356", ["+356", "+44"])).toEqual({ code: "+356", number });
});
it("keeps a selected code with no phone digits", () => expect(parsePhone("+356", "+356", ["+356"])).toEqual({ code: "+356", number: "" }));
it("splits an unseparated number using known codes", () => expect(parsePhone("+35612345678", "+356", ["+356", "+44"])).toEqual({ code: "+356", number: "12345678" }));
it("retains an existing office address when opening structured fields", () => expect(parseOfficeAddress({}, "Old office address").street).toBe("Old office address"));
it("formats building street city and postal code without empty separators", () => expect(formatOfficeAddress({ building:"12", street:"High Street", city:"Sliema", postalCode:"SLM 1000" })).toBe("12, High Street, Sliema SLM 1000"));
import { companySignature } from "./contact-details";
describe("companySignature", () => {
  it("lists tenant details and skips blanks", () => {
    expect(companySignature({ name: "Acme Lifts", address: "1 Tower Rd, Sliema", phone: "+356 2100", email: "office@acme.mt", website: "acme.mt", vat: "" }))
      .toBe("--\nAcme Lifts\n1 Tower Rd, Sliema\nTel: +356 2100\nEmail: office@acme.mt\nWeb: acme.mt");
  });
});
