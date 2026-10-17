import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ROLE_LABEL, type Role } from "@/lib/profile";

export const Route = createFileRoute("/join/$token")({
  head: () => ({
    meta: [
      { title: "Join your team — FieldOps" },
      { name: "description", content: "Accept your invitation and set up your FieldOps account." },
      { property: "og:title", content: "Join your team on FieldOps" },
      { property: "og:description", content: "Accept your invitation and set up your account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: JoinPage,
});

type Invite = { company_name: string; role: Role; email: string | null; full_name: string | null; valid: boolean };

function JoinPage() {
  const { token } = Route.useParams();
  const navigate = useNavigate();
  const [invite, setInvite] = useState<Invite | null | "missing">(null);
  const [f, setF] = useState({ name: "", email: "", password: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    supabase.rpc("get_invite", { _token: token }).then(({ data }) => {
      const row = (data as Invite[] | null)?.[0];
      if (!row) { setInvite("missing"); return; }
      setInvite(row);
      setF((x) => ({ ...x, name: row.full_name ?? "", email: row.email ?? "" }));
    });
  }, [token]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(null);
    const { data, error } = await supabase.auth.signUp({
      email: f.email, password: f.password,
      options: { emailRedirectTo: `${window.location.origin}/dashboard`, data: { full_name: f.name, invite_token: token } },
    });
    setBusy(false);
    if (error) setError(error.message);
    else if (data.session) navigate({ to: "/dashboard" });
    else setSent(true);
  };

  return (
    <main className="grid min-h-screen place-items-center bg-background px-6 py-12">
      <div className="w-full max-w-md space-y-5 rounded-xl border bg-card p-6">
        <p className="font-display text-2xl text-foreground">FieldOps</p>
        {invite === null ? <p className="text-muted-foreground">Checking your invite…</p>
          : invite === "missing" || !invite.valid ? <p className="text-foreground">This invite link is invalid, already used or expired. Ask your manager for a new one.</p>
          : sent ? <p className="text-foreground">Check your email to confirm your account, then sign in.</p>
          : (
            <form onSubmit={submit} className="space-y-4">
              <p className="text-sm text-muted-foreground">You've been invited to join <span className="font-medium text-foreground">{invite.company_name}</span> as <span className="font-medium text-foreground">{ROLE_LABEL[invite.role]}</span>.</p>
              <div className="space-y-1.5"><Label>Full name</Label><Input required className="h-11" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Email</Label><Input required type="email" className="h-11" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Password</Label><Input required minLength={8} type="password" className="h-11" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" className="h-11 w-full" disabled={busy}>{busy ? "Joining…" : "Join team"}</Button>
            </form>
          )}
      </div>
    </main>
  );
}
