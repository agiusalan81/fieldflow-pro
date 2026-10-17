import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
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
  const [mode, setMode] = useState<"signup" | "signin">("signin");
  const [idle, setIdle] = useState(false);
  useEffect(() => {
    setIdle(new URLSearchParams(window.location.search).get("reason") === "idle");
    supabase.auth.getUser().then(({ data }) => { if (data.user) navigate({ to: "/dashboard", replace: true }); });
  }, [navigate]);
  const [form, setForm] = useState({ company: "", name: "", email: "", password: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [k]: e.target.value });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
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
      else navigate({ to: "/dashboard" });
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
              <Input id="email" type="email" autoFocus autoComplete="email" required value={form.email} onChange={set("email")} />
            </Field>
            <Field id="password" label="Password">
              <Input id="password" type="password" required minLength={8} value={form.password} onChange={set("password")} />
            </Field>
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
