import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Send, Hash, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useProfile, useCompanyUsers } from "@/lib/profile";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/messages")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { title: "Team chat — FieldOps" },
      { name: "description", content: "Message teammates directly or chat inside a job sheet thread." },
      { property: "og:title", content: "Team chat — FieldOps" },
      { property: "og:description", content: "Internal team chat." },
    ],
  }),
  component: Messages,
});

type Thread = { kind: "user"; id: string; label: string } | { kind: "job"; id: string; label: string };

function Messages() {
  const { data: profile } = useProfile();
  const { data: users = [] } = useCompanyUsers();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<"all" | "people" | "jobs">("all");
  const [active, setActive] = useState<Thread | null>(null);
  const [text, setText] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  const { data: jobs = [] } = useQuery({
    queryKey: ["chat-jobs"],
    queryFn: async () => {
      const { data } = await supabase.from("job_sheets").select("id, status, clients(name)").order("created_at", { ascending: false }).limit(50);
      return data ?? [];
    },
  });
  const { data: msgs = [] } = useQuery({
    queryKey: ["messages"],
    refetchInterval: 4000,
    queryFn: async () => {
      const { data, error } = await supabase.from("internal_messages").select("*").order("created_at");
      if (error) throw error;
      return data;
    },
  });

  const threads: Thread[] = useMemo(() => {
    const people = users.filter((u) => u.id !== profile?.id).map((u) => ({ kind: "user" as const, id: u.id, label: u.full_name }));
    const js = jobs.map((j) => ({ kind: "job" as const, id: j.id, label: `${j.clients?.name ?? "Job"} · #${j.id.slice(0, 4)}` }));
    return filter === "people" ? people : filter === "jobs" ? js : [...js, ...people];
  }, [users, jobs, profile, filter]);

  const inThread = (t: Thread, m: (typeof msgs)[number]) =>
    t.kind === "job"
      ? m.job_sheet_id === t.id && !m.receiver_id
      : !m.job_sheet_id && ((m.sender_id === profile?.id && m.receiver_id === t.id) || (m.sender_id === t.id && m.receiver_id === profile?.id));

  const lastOf = (t: Thread) => [...msgs].reverse().find((m) => inThread(t, m));
  const current = active ? msgs.filter((m) => inThread(active, m)) : [];
  const nameOf = (id: string) => users.find((u) => u.id === id)?.full_name ?? "Someone";

  useEffect(() => { endRef.current?.scrollIntoView({ block: "end" }); }, [current.length, active?.id]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!active || !profile || !text.trim()) return;
    const { error } = await supabase.from("internal_messages").insert({
      company_id: profile.company_id, sender_id: profile.id, message_text: text.trim(),
      receiver_id: active.kind === "user" ? active.id : null, job_sheet_id: active.kind === "job" ? active.id : null,
    });
    if (error) { toast.error(error.message); return; }
    setText("");
    qc.invalidateQueries({ queryKey: ["messages"] });
  };

  return (
    <AppShell title="Team chat">
      <div className="grid h-[calc(100dvh-10rem)] overflow-hidden rounded-xl border bg-card md:grid-cols-[300px_minmax(0,1fr)] lg:h-[calc(100dvh-8rem)]">
        <aside className={`${active ? "hidden md:flex" : "flex"} min-h-0 flex-col border-r`}>
          <div className="flex gap-1 border-b p-2">
            {(["all", "jobs", "people"] as const).map((f) => (
              <Button key={f} size="sm" variant={filter === f ? "secondary" : "ghost"} className="flex-1 capitalize" onClick={() => setFilter(f)}>
                {f === "jobs" ? "Job threads" : f}
              </Button>
            ))}
          </div>
          <ul className="min-h-0 flex-1 overflow-y-auto">
            {threads.map((t) => {
              const last = lastOf(t);
              return (
                <li key={t.kind + t.id}>
                  <button onClick={() => setActive(t)} className={`grid w-full grid-cols-[auto_minmax(0,1fr)] items-center gap-3 px-4 py-3 text-left hover:bg-accent ${active?.id === t.id ? "bg-accent" : ""}`}>
                    <span className="grid h-9 w-9 place-items-center rounded-full bg-muted text-muted-foreground">
                      {t.kind === "job" ? <Hash className="h-4 w-4" /> : <User className="h-4 w-4" />}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-foreground">{t.label}</span>
                      <span className="block truncate text-xs text-muted-foreground">{last?.message_text ?? "No messages yet"}</span>
                    </span>
                  </button>
                </li>
              );
            })}
            {threads.length === 0 && <li className="p-6 text-center text-sm text-muted-foreground">No conversations available.</li>}
          </ul>
        </aside>

        <section className={`${active ? "flex" : "hidden md:flex"} min-h-0 flex-col`}>
          {active ? (
            <>
              <header className="flex items-center gap-2 border-b px-3 py-2.5">
                <Button size="icon" variant="ghost" className="md:hidden" onClick={() => setActive(null)} aria-label="Back"><ArrowLeft className="h-4 w-4" /></Button>
                <p className="truncate font-medium text-foreground">{active.label}</p>
              </header>
              <div className="min-h-0 flex-1 space-y-2 overflow-y-auto bg-muted/40 p-4">
                {current.map((m) => {
                  const mine = m.sender_id === profile?.id;
                  return (
                    <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm shadow-sm ${mine ? "rounded-br-sm bg-primary text-primary-foreground" : "rounded-bl-sm bg-card text-foreground"}`}>
                        {!mine && active.kind === "job" && <p className="mb-0.5 text-xs font-medium text-primary">{nameOf(m.sender_id)}</p>}
                        <p className="whitespace-pre-wrap break-words">{m.message_text}</p>
                        <p className={`mt-0.5 text-right text-[10px] ${mine ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                          {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                    </div>
                  );
                })}
                {current.length === 0 && <p className="pt-10 text-center text-sm text-muted-foreground">Say hello 👋</p>}
                <div ref={endRef} />
              </div>
              <form onSubmit={send} className="flex gap-2 border-t p-3">
                <Input className="h-11" value={text} onChange={(e) => setText(e.target.value)} placeholder="Type a message" />
                <Button type="submit" size="icon" className="h-11 w-11 shrink-0" aria-label="Send"><Send className="h-4 w-4" /></Button>
              </form>
            </>
          ) : (
            <div className="grid flex-1 place-items-center text-sm text-muted-foreground">Pick a conversation</div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
