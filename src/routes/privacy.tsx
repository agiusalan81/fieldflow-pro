import { createFileRoute } from "@tanstack/react-router";
import { TrustPage, publicLegalQuery } from "@/components/trust-page";
import { trustHead } from "@/lib/trust-pages";
export const Route = createFileRoute("/privacy")({ staticData: { sitemap: true }, loader: ({ context }) => context.queryClient.ensureQueryData(publicLegalQuery), head: () => trustHead("privacy"), component: () => <TrustPage pageKey="privacy" /> });