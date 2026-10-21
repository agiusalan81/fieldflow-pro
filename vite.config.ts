// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { VitePWA } from "vite-plugin-pwa";
import path from "node:path";

export default defineConfig({
  plugins: [VitePWA({
    strategies: "generateSW", filename: "sw.js", outDir: "dist/client",
    injectRegister: null, registerType: "autoUpdate", devOptions: { enabled: false },
    manifest: { name: "FieldFlow", short_name: "FieldFlow", display: "standalone", start_url: "/", icons: [{ src: "/app-icon-192.png", sizes: "192x192", type: "image/png" }, { src: "/app-icon-512.png", sizes: "512x512", type: "image/png" }] },
    workbox: {
      globPatterns: ["**/*.{js,css,png,ico,woff2}"], navigateFallback: null,
      cleanupOutdatedCaches: true,
      runtimeCaching: [
        { urlPattern: ({ request, url }) => request.mode === "navigate" && !url.pathname.startsWith("/~oauth") && !url.pathname.startsWith("/api") && !url.pathname.includes("_serverFn"), handler: "NetworkFirst", options: { cacheName: "fieldflow-pages", networkTimeoutSeconds: 4, expiration: { maxEntries: 30, maxAgeSeconds: 604800 }, cacheableResponse: { statuses: [200] } } },
        { urlPattern: ({ url, sameOrigin }) => sameOrigin && /^\/assets\/.*-[a-zA-Z0-9_-]+\.(js|css|woff2|png|jpg)$/.test(url.pathname), handler: "CacheFirst", options: { cacheName: "fieldflow-assets", expiration: { maxEntries: 200, maxAgeSeconds: 2592000 } } },
      ],
    },
  })],
  vite: { resolve: { alias: {
    "entities/lib/decode.js": path.resolve(__dirname, "node_modules/entities/lib/decode.js"),
    "entities/lib/encode.js": path.resolve(__dirname, "node_modules/entities/lib/encode.js"),
    entities: path.resolve(__dirname, "node_modules/entities"),
  } } },
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
});
