import { createFileRoute } from "@tanstack/react-router";
import { TrustPage, publicLegalQuery } from "@/components/trust-page";
import { trustHead } from "@/lib/trust-pages";
export const Route = createFileRoute("/security")({ staticData: { sitemap: true }, loader: ({ context }) => context.queryClient.ensureQueryData(publicLegalQuery), head: () => trustHead("security"), component: () => <TrustPage pageKey="security" /> });