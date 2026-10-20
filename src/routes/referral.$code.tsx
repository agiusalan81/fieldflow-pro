import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
export const Route = createFileRoute("/referral/$code")({ head: () => ({ meta: [{ title: "Partner invitation — FieldBridge" }, { name: "description", content: "Join a field service workspace through a partner invitation." }, { property: "og:title", content: "Partner invitation — FieldBridge" }, { property: "og:description", content: "Partner trial invitation." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }), component: Referral });
function Referral() {
  const { code } = Route.useParams();
  const { data, isPending, error } = useQuery({ queryKey: ["referral-offer", code], queryFn: async () => { if (!/^[a-f0-9]{36}$/.test(code)) return null; const r = await supabase.rpc("get_referral_offer", { _code: code }); if (r.error) throw r.error; return r.data[0] ?? null; } });
  useEffect(() => { if (data) sessionStorage.setItem("fieldflow:referral", code); }, [data, code]);
  return <main className="mx-auto max-w-xl space-y-5 px-6 py-16"><h1 className="text-3xl font-semibold">{data?.product_name ?? "Partner invitation"}</h1>{isPending ? <p>Loading invitation…</p> : data ? <><p>{data.trial_days}-day full-feature trial. No card required.</p><Button asChild><Link to="/auth">Create your company</Link></Button></> : <p className="text-muted-foreground">{error ? "Invitation could not be loaded." : "This invitation is no longer available."}</p>}</main>;
}