export function dispatchEquipmentAtSite<T extends { client_id: string; site_id: string | null }>(assets: T[], clientId: string, siteId: string | null) {
  return assets.filter(a => a.client_id === clientId && (!siteId || a.site_id === siteId));
}