import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — FieldOps" }] }),
  component: Dashboard,
});

type Profile = { full_name: string; role: string; companies: { name: string } | null };

function Dashboard() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      const { data: row } = await supabase
        .from("users")
        .select("full_name, role, companies(name)")
        .eq("id", data.user.id)
        .maybeSingle();
      setProfile(row as Profile | null);
      setLoaded(true);
    });
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  };

  return (
    <main className="min-h-screen bg-background px-6 py-10">
      <div className="mx-auto max-w-3xl">
        <header className="flex items-center justify-between">
          <span className="font-display text-xl text-foreground">FieldOps</span>
          <Button variant="outline" onClick={signOut}>Sign out</Button>
        </header>
        <section className="mt-12 rounded-xl border bg-card p-8">
          {!loaded ? (
            <p className="text-muted-foreground">Loading…</p>
          ) : profile ? (
            <>
              <p className="text-sm uppercase tracking-widest text-primary">{profile.role}</p>
              <h1 className="mt-2 font-display text-3xl text-foreground">
                Welcome, {profile.full_name}
              </h1>
              <p className="mt-2 text-muted-foreground">
                You're managing <strong className="text-foreground">{profile.companies?.name}</strong>.
              </p>
            </>
          ) : (
            <p className="text-muted-foreground">
              Your account isn't linked to a company yet. Ask your company admin to add you.
            </p>
          )}
        </section>
      </div>
    </main>
  );
}
