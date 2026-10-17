import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in or create your company — FieldOps" },
      { name: "description", content: "Create your field service company workspace or sign in." },
      { property: "og:title", content: "Sign in — FieldOps" },
      { property: "og:description", content: "Create your field service company workspace or sign in." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<"signup" | "signin">("signin");
  const [idle, setIdle] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  useEffect(() => {
    setIdle(new URLSearchParams(window.location.search).get("reason") === "idle");
    const saved = window.localStorage.getItem("fieldflow_saved_email");
    if (saved) {
      setForm((f) => ({ ...f, email: saved }));
      setRemember(true);
    }
    supabase.auth.getUser().then(({ data }) => { if (data.user) navigate({ to: "/dashboard", replace: true }); });
  }, [navigate]);
  const [form, setForm] = useState({ company: "", name: "", email: "", password: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [k]: e.target.value });

  const [resetSent, setResetSent] = useState(false);
  const forgot = async () => {
    const email = form.email.trim().toLowerCase();
    if (!email) { setError("Enter your work email first, then tap Forgot password."); return; }
    setBusy(true); setError(null);
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
    setBusy(false);
    if (error) setError(error.message); else setResetSent(true);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    form.email = form.email.trim().toLowerCase();
    if (mode === "signup") {
      const { data, error } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: {
          emailRedirectTo: `${window.location.origin}/dashboard`,
          data: { company_name: form.company, full_name: form.name },
        },
      });
      if (error) setError(error.message);
      else if (data.session) navigate({ to: "/dashboard" });
      else setSent(true);
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email: form.email,
        password: form.password,
      });
      if (error) setError(error.message);
      else {
        if (remember) window.localStorage.setItem("fieldflow_saved_email", form.email);
        else window.localStorage.removeItem("fieldflow_saved_email");
        queryClient.clear();
        navigate({ to: "/dashboard" });
      }
    }
    setBusy(false);
  };

  return (
    <main className="grid min-h-screen place-items-center bg-background px-6 py-12">
      <div className="w-full max-w-md">
        <p className="font-display text-2xl text-foreground">FieldOps</p>
        <h1 className="mt-6 font-display text-4xl leading-tight text-foreground">
          {mode === "signup" ? "Set up your company" : "Welcome back"}
        </h1>
        <p className="mt-2 text-muted-foreground">
          {mode === "signup"
            ? "You'll be the admin. Invite technicians and supervisors later."
            : "Sign in to your company workspace."}
        </p>

        {idle && mode === "signin" && <p className="mt-6 rounded-lg border bg-muted p-3 text-sm text-muted-foreground">You were signed out after a period of inactivity.</p>}
        {sent ? (
          <div className="mt-8 rounded-xl border bg-card p-6 text-card-foreground">
            <p className="font-medium">Check your inbox</p>
            <p className="mt-1 text-sm text-muted-foreground">
              We sent a confirmation link to {form.email}. Click it to activate {form.company}.
            </p>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-8 space-y-4">
            {mode === "signup" && (
              <>
                <Field id="company" label="Company name">
                  <Input id="company" required maxLength={200} value={form.company} onChange={set("company")} />
                </Field>
                <Field id="name" label="Your full name">
                  <Input id="name" required maxLength={200} value={form.name} onChange={set("name")} />
                </Field>
              </>
            )}
            <Field id="email" label="Work email">
              <Input id="email" type="email" autoFocus autoComplete="email" autoCapitalize="none" autoCorrect="off" spellCheck={false} required value={form.email} onChange={set("email")} />
            </Field>
            <Field id="password" label="Password">
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={8}
                  autoComplete={mode === "signin" ? "current-password" : "new-password"}
                  value={form.password}
                  onChange={set("password")}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </Field>
            {mode === "signin" && (
              <div className="flex items-center justify-between gap-2">
                <label htmlFor="remember" className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
                  <Checkbox id="remember" checked={remember} onCheckedChange={(v) => setRemember(v === true)} />
                  Remember me on this device
                </label>
                <button type="button" onClick={forgot} disabled={busy} className="text-sm text-primary underline-offset-4 hover:underline">
                  Forgot password?
                </button>
              </div>
            )}
            {resetSent && mode === "signin" && <p className="rounded-lg border bg-muted p-3 text-sm text-muted-foreground">If an account exists for {form.email}, a reset link is on its way. Check your inbox.</p>}
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" size="lg" disabled={busy}>
              {busy ? "Please wait…" : mode === "signup" ? "Create company" : "Sign in"}
            </Button>
          </form>
        )}

        <button
          type="button"
          onClick={() => { setMode(mode === "signup" ? "signin" : "signup"); setSent(false); setError(null); }}
          className="mt-6 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          {mode === "signup" ? "Already have an account? Sign in" : "New organisation? Set up a company"}
        </button>
      </div>
    </main>
  );
}

function Field({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}
