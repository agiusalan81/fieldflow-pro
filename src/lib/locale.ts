/** Per-tenant locale (currency, phone country, equipment wording). Set once by AppShell from company settings. */
export type TenantLocale = { currency: string; countryCode: string; equipmentLabel: string };
export const DEFAULT_LOCALE: TenantLocale = { currency: "EUR", countryCode: "+356", equipmentLabel: "lift" };
export const CURRENCIES = ["EUR", "GBP", "USD", "CHF", "SEK", "NOK", "DKK", "PLN", "AUD", "CAD", "AED"];

let current: TenantLocale = { ...DEFAULT_LOCALE };
export const tenantLocale = () => current;
export function setTenantLocale(l?: Partial<TenantLocale> | null) {
  current = {
    currency: CURRENCIES.includes(l?.currency ?? "") ? l.currency! : DEFAULT_LOCALE.currency,
    countryCode: /^\+\d{1,4}$/.test(l?.countryCode ?? "") ? l.countryCode! : DEFAULT_LOCALE.countryCode,
    equipmentLabel: l?.equipmentLabel?.trim() || DEFAULT_LOCALE.equipmentLabel,
  };
}
export function formatMoney(n: number, currency = current.currency) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(n);
}
