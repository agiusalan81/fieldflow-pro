import { describe, it, expect } from "vitest";
import { createRootRoute, createRoute, createRouter } from "@tanstack/react-router";
import { sitemapStaticPaths, sitemapXML } from "./sitemap";
describe("public search inventory", () => {
  it("includes public pages but excludes private descendants and token pages", () => {
    const root = createRootRoute({ staticData: { sitemap: false } });
    const home = createRoute({ getParentRoute: () => root, path: "/", staticData: { sitemap: true } });
    const privacy = createRoute({ getParentRoute: () => root, path: "/privacy", staticData: { sitemap: true } });
    const privateRoot = createRoute({ getParentRoute: () => root, id: "private", staticData: { sitemap: "exclude-subtree" } });
    const child = createRoute({ getParentRoute: () => privateRoot, path: "/dashboard", staticData: { sitemap: true } });
    const token = createRoute({ getParentRoute: () => root, path: "/report/$token", staticData: { sitemap: false } });
    const router = createRouter({ routeTree: root.addChildren([home, privacy, privateRoot.addChildren([child]), token]) });
    expect(sitemapStaticPaths(router)).toEqual(["/", "/privacy"]);
  });
  it("uses the public domain with no generated lastmod", () => { const xml = sitemapXML("https://fieldbridgeapp.com", [{ path: "/" }, { path: "/privacy" }]); expect(xml).toContain("https://fieldbridgeapp.com/privacy"); expect(xml).not.toContain("lastmod"); });
  it("rejects offsite paths", () => expect(() => sitemapXML("https://fieldbridgeapp.com", [{ path: "//evil.example" }])).toThrow());
});