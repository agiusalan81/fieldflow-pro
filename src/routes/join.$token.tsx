import { queryOptions, useQueryClient, useQueryErrorResetBoundary, useSuspenseQuery } from "@tanstack/react-query";
import { SocialSignin } from "@/components/social-signin";
import { createFileRoute, useNavigate, useRouter, type ErrorComponentProps } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ROLE_LABEL } from "@/lib/profile";
import { getInvitation } from "@/lib/invites.functions";
import { withInviteTimeout } from "@/lib/invite-loading";

const invitationQuery = (token: string) => queryOptions({
  queryKey: ["invitation", token],
  queryFn: () => withInviteTimeout((signal) => getInvitation({ data: { token }, signal })),
  retry: false,
  staleTime: 0,
  gcTime: 5 * 60_000,
  refetchOnWindowFocus: false,
});

function InviteFrame({ children }: { children: React.ReactNode }) {
  return <main className="grid min-h-screen place-items-center bg-background px-6 py-12"><div className="w-full max-w-md space-y-5 rounded-xl border bg-card p-6"><p className="font-display text-2xl text-foreground">FieldOps</p>{children}</div></main>;
}

function InviteError({ reset }: ErrorComponentProps) {
  const router = useRouter();
  const { reset: resetQuery } = useQueryErrorResetBoundary();
  const [retrying, setRetrying] = useState(false);
  return <InviteFrame><p role="alert" className="text-sm text-destructive">We couldn’t check your invitation. Check your internet connection and try again.</p><Button className="h-11 w-full" disabled={retrying} onClick={async () => {
    setRetrying(true);
    resetQuery();
    try { await router.invalidate({ sync: true }); reset(); }
    finally { setRetrying(false); }
  }}>{retrying ? "Checking…" : "Retry"}</Button></InviteFrame>;
}

export const Route = createFileRoute("/join/$token")({
  loader: async ({ params, context }) => { await context.queryClient.ensureQueryData(invitationQuery(params.token)); },
  pendingMs: 0,
  pendingMinMs: 0,
  pendingComponent: () => <InviteFrame><p role="status" className="text-muted-foreground">Checking your invite…</p></InviteFrame>,
  errorComponent: InviteError,
  notFoundComponent: () => <InviteFrame><p>This invite link is invalid, already used or expired. Ask your manager for a new one.</p></InviteFrame>,
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

function JoinPage() {
  const { token } = Route.useParams();
  const { data: invite } = useSuspenseQuery(invitationQuery(token));
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [signedIn, setSignedIn] = useState(false);
  const [f, setF] = useState({ name: invite?.full_name ?? "", email: invite?.email ?? "", password: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const accept = async () => {
    setBusy(true); setError(null);
    try {
      const { error } = await supabase.rpc("accept_company_invite", { _token: token });
      if (error) throw error;
      sessionStorage.removeItem("fieldflow:pending-invite");
      qc.clear(); await navigate({ to: "/dashboard", replace: true });
    } catch(e) { setError(e instanceof Error ? e.message : "Could not accept invitation"); }
    finally { setBusy(false); }
  };
  useEffect(() => {
    let active = true;
    withInviteTimeout(() => supabase.auth.getUser()).then(({ data }) => {
      if (active) setSignedIn(!!data.user);
    }).catch(() => { if (active) setSignedIn(false); });
    return () => { active = false; };
  }, [token]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(null);
    const { data, error } = await supabase.auth.signUp({
      email: f.email, password: f.password,
      options: { emailRedirectTo: `${window.location.origin}/join/${encodeURIComponent(token)}`, data: { full_name: f.name, invite_token: token } },
    });
    setBusy(false);
    if (error) setError(error.message);
    else if (data.session) { qc.clear(); navigate({ to: "/dashboard" }); }
    else setSent(true);
  };

  return (
    <main className="grid min-h-screen place-items-center bg-background px-6 py-12">
      <div className="w-full max-w-md space-y-5 rounded-xl border bg-card p-6">
        <p className="font-display text-2xl text-foreground">FieldOps</p>
        {invite === null ? <p className="text-foreground">This invite link is invalid, already used or expired. Ask your manager for a new one.</p>
          : signedIn ? <div className="space-y-4"><p className="text-sm">Accept your invitation to {invite.company_name} as {ROLE_LABEL[invite.role]}.</p>{error && <p className="text-sm text-destructive">{error}</p>}<Button className="h-11 w-full" disabled={busy} onClick={accept}>{busy ? "Joining…" : "Accept invitation"}</Button><Button variant="ghost" onClick={async()=>{qc.clear();await supabase.auth.signOut();setSignedIn(false);}}>Use a different account</Button></div>
           : !invite.valid ? <p>This invite link is invalid, already used or expired. Ask your manager for a new one.</p>
           : sent ? <p className="text-foreground">Check your email to confirm your account, then sign in.</p>
          : (
            <div className="space-y-4"><SocialSignin inviteToken={token} onError={setError} onSuccess={async()=>{setSignedIn(true);await accept();}}/><p className="text-center text-xs text-muted-foreground">or join with email</p><form onSubmit={submit} className="space-y-4">
              <p className="text-sm text-muted-foreground">You've been invited to join <span className="font-medium text-foreground">{invite.company_name}</span> as <span className="font-medium text-foreground">{ROLE_LABEL[invite.role]}</span>.</p>
              <div className="space-y-1.5"><Label>Full name</Label><Input required className="h-11" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Email</Label><Input required type="email" className="h-11" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Password</Label><Input required minLength={8} type="password" className="h-11" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" className="h-11 w-full" disabled={busy}>{busy ? "Joining…" : "Join team"}</Button>
            </form>
            </div>
          )}
      </div>
    </main>
  );
}
