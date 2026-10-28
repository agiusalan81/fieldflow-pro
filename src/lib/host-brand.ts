import { createIsomorphicFn } from "@tanstack/react-start";
import { getRequestHost } from "@tanstack/react-start/server";

/** Which marketing site a hostname belongs to. */
export function brandForHost(host: string | null | undefined): "retail" | "fieldbridge" {
  const h = (host ?? "").toLowerCase().split(":")[0] ?? "";
  return h === "aisleopsapp.com" || h.endsWith(".aisleopsapp.com") ? "retail" : "fieldbridge";
}

export const currentHost = createIsomorphicFn()
  .server(() => { try { return getRequestHost(); } catch { return ""; } })
  .client(() => window.location.hostname);
