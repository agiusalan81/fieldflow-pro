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
import { memberFullName, splitMemberName } from "@/lib/member-registration";

const invitationQuery = (token: string) => queryOptions({
  queryKey: ["invitation", token],
  queryFn: () => withInviteTimeout((signal) => getInvitation({ data: { token }, signal })),
  retry: false,
  staleTime: 0,
  gcTime: 5 * 60_000,
  refetchOnWindowFocus: false,
});

function InviteFrame({ children }: { children: React.ReactNode }) {
  return <main className="grid min-h-screen place-items-center bg-background px-6 py-12"><div className="w-full max-w-md space-y-5 rounded-xl border bg-card p-6"><p className="font-display text-2xl text-foreground">FieldBridge</p>{children}</div></main>;
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
      { title: "Join your team — FieldBridge" },
      { name: "description", content: "Accept your invitation and set up your FieldBridge account." },
      { property: "og:title", content: "Join your team on FieldBridge" },
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
  const initialName = splitMemberName(invite?.full_name ?? "");
  const [f, setF] = useState({ ...initialName, email: invite?.email ?? "", password: "" });
  const [signedIn, setSignedIn] = useState(false);
  const [checkingAccount, setCheckingAccount] = useState(true);
  const [emailMode, setEmailMode] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const detect = async () => {
    const { data, error } = await withInviteTimeout(() => supabase.auth.getUser());
    if (error) throw error;
    if (!data.user) return;
    const name = splitMemberName(String(data.user.user_metadata["full_name"] ?? data.user.user_metadata["name"] ?? invite?.full_name ?? ""));
    setF((current) => ({ ...current, firstName: current.firstName || name.firstName, surname: current.surname || name.surname, email: data.user.email ?? current.email }));
    setSignedIn(true);
  };
  useEffect(() => {
    let active = true;
    detect().catch(() => {}).finally(() => { if (active) setCheckingAccount(false); });
    return () => { active = false; };
  }, [token]);

  const enter = async () => {
    sessionStorage.removeItem("fieldflow:pending-invite");
    qc.clear();
    await navigate({ to: "/dashboard", replace: true });
  };
  const accept = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true); setError(null);
    try {
      memberFullName(f.firstName, f.surname);
      const { error } = await withInviteTimeout(() => supabase.rpc("accept_company_invite_named", { _token: token, _first_name: f.firstName.trim(), _surname: f.surname.trim() }));
      if (error) throw error;
      await enter();
    } catch (e) { setError(e instanceof Error ? e.message : "Could not accept invitation"); }
    finally { setBusy(false); }
  };
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true); setError(null);
    try {
      const fullName = memberFullName(f.firstName, f.surname);
      sessionStorage.setItem("fieldflow:pending-invite", token);
      const { data, error } = await withInviteTimeout(() => supabase.auth.signUp({
        email: (invite?.email || f.email).trim(), password: f.password,
        options: { emailRedirectTo: `${window.location.origin}/join/${encodeURIComponent(token)}`, data: { full_name: fullName, invite_token: token } },
      }));
      if (error) throw error;
      if (data.session) await enter();
      else setSent(true);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not create your account"); }
    finally { setBusy(false); }
  };
  const names = <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-1.5"><Label htmlFor="invite-first-name">First name</Label><Input id="invite-first-name" required maxLength={100} autoComplete="given-name" className="h-11" value={f.firstName} onChange={(e) => setF({ ...f, firstName: e.target.value })}/></div><div className="space-y-1.5"><Label htmlFor="invite-surname">Surname</Label><Input id="invite-surname" required maxLength={100} autoComplete="family-name" className="h-11" value={f.surname} onChange={(e) => setF({ ...f, surname: e.target.value })}/></div></div>;
  return <InviteFrame>
    {!invite ? <p>This invite link is invalid, already used or expired. Ask your manager for a new one.</p>
      : checkingAccount ? <p role="status">Checking your account…</p>
      : signedIn ? <form onSubmit={accept} className="space-y-4"><h1 className="text-2xl font-semibold">Confirm your name</h1><p className="text-sm text-muted-foreground">Join {invite.company_name} as {ROLE_LABEL[invite.role]}.</p><p className="break-all text-sm">{f.email}</p>{names}{error && <p role="alert" className="text-sm text-destructive">{error}</p>}<Button type="submit" className="h-11 w-full" disabled={busy}>{busy ? "Joining…" : "Confirm & enter"}</Button><Button type="button" variant="ghost" className="w-full" onClick={async () => { qc.clear(); await supabase.auth.signOut(); setSignedIn(false); }}>Use a different account</Button></form>
      : !invite.valid ? <p>This invite link is invalid, already used or expired. Ask your manager for a new one.</p>
      : sent ? <div className="space-y-3"><h1 className="text-xl font-semibold">Check your email</h1><p>Confirm your account using the email link, then return here to continue.</p></div>
      : <div className="space-y-4"><h1 className="text-2xl font-semibold">Join {invite.company_name}</h1><p className="text-sm text-muted-foreground">You’re invited as {ROLE_LABEL[invite.role]}.</p>{!emailMode ? <><SocialSignin inviteToken={token} onError={setError} onSuccess={detect}/><Button variant="secondary" className="h-11 w-full" onClick={() => setEmailMode(true)}>Join with email</Button>{error && <p role="alert" className="text-sm text-destructive">{error}</p>}</> : <form onSubmit={submit} className="space-y-4">{names}<div className="space-y-1.5"><Label htmlFor="invite-email">Email</Label><Input id="invite-email" required type="email" autoComplete="email" className="h-11" readOnly={!!invite.email} value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })}/></div><div className="space-y-1.5"><Label htmlFor="invite-password">Password</Label><Input id="invite-password" required minLength={8} type="password" autoComplete="new-password" className="h-11" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })}/></div>{error && <p role="alert" className="text-sm text-destructive">{error}</p>}<Button type="submit" className="h-11 w-full" disabled={busy}>{busy ? "Joining…" : "Join team"}</Button><Button type="button" variant="ghost" className="w-full" onClick={() => setEmailMode(false)}>Other sign-in options</Button></form>}</div>}
  </InviteFrame>;
}
