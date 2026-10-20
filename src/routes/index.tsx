import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  ssr: false,
  beforeLoad: () => { throw redirect({ to: "/auth", replace: true }); },
  head: () => ({
    meta: [
      { title: "FieldBridge — Field service management for your team" },
      { name: "description", content: "Job sheets, assets, inventory and technician scheduling in one customizable workspace." },
      { property: "og:title", content: "FieldBridge — Field service management" },
      { property: "og:description", content: "Job sheets, assets, inventory and technician scheduling in one customizable workspace." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => null,
});
