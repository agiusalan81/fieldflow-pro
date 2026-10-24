import { PLAN_FEATURES } from './plan-features';
/** New built-in modules are discoverable without enabling them for a tenant. */
export function hqModuleOptions(slug: string, registered: readonly string[], catalog: readonly { modules: string[] }[]) {
  return [...new Set([...registered, ...catalog.flatMap(item => item.modules), ...(slug === 'fieldbridge' ? PLAN_FEATURES.map(f => f.key) : [])])];
}