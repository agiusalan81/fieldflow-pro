import { createIsomorphicFn } from "@tanstack/react-start";
import { getRequestHost } from "@tanstack/react-start/server";

export type HostBrand = "retail" | "hotels" | "fieldbridge";

const matches = (h: string, root: string) => h === root || h.endsWith(`.${root}`);

/** Which product site a hostname belongs to. */
export function brandForHost(host: string | null | undefined): HostBrand {
  const h = (host ?? "").toLowerCase().split(":")[0] ?? "";
  if (matches(h, "aisleopsapp.com")) return "retail";
  if (matches(h, "fieldbridgehotels.com") || matches(h, "suiteopsapp.com")) return "hotels";
  return "fieldbridge";
}

export const currentHost = createIsomorphicFn()
  .server(() => { try { return getRequestHost(); } catch { return ""; } })
  .client(() => window.location.hostname);
