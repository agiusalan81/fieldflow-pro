import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Bell, Send, Hash, User, Paperclip, ContactRound, X } from "lucide-react";
import { canAskNotifications } from "@/lib/chat-notify";
import { ensurePushSubscription, pushChatMessages } from "@/lib/web-push";
import { supabase } from "@/integrations/supabase/client";
import { markThreadRead, unreadByThread, useChatReads } from "@/lib/chat-unread";
import { useProfile, useCompanyUsers } from "@/lib/profile";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ChatAttachments } from "@/components/chat-attachments";
import { CHAT_BUCKET, CHAT_TYPES, chatFileError, compressChatImage, validContactCard, parseChatFiles, type ChatFile, type ContactCard } from "@/lib/chat-attachments";
import { usePlanFeatures } from "@/lib/plan-features";

export const Route = createFileRoute("/_authenticated/messages")({ staticData: { sitemap: false },
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { title: "Team chat — FieldBridge" },
      { name: "description", content: "Message teammates directly or chat inside a job sheet thread." },
      { property: "og:title", content: "Team chat — FieldBridge" },
      { property: "og:description", content: "Internal team chat." },
    ],
  }),
  validateSearch: (s: Record<string, unknown>): { thread?: string } => (typeof s["thread"] === "string" ? { thread: s["thread"] } : {}),
  component: Messages,
});

type Thread = { kind: "user"; id: string; label: string } | { kind: "job"; id: string; label: string };

function Messages() {
  const { data: profile } = useProfile();
  const { data: users = [] } = useCompanyUsers();
  const qc = useQueryClient();
  const { thread: linked } = Route.useSearch();
  const [filter, setFilter] = useState<"all" | "people" | "jobs">("all");
  const [active, setActive] = useState<Thread | null>(null);
  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [contact, setContact] = useState<ContactCard | null>(null);
  const [contactOpen, setContactOpen] = useState(false);
  const [contactDraft, setContactDraft] = useState<ContactCard>({ name: "", phone: "", email: "", company: "" });
  const [sending, setSending] = useState(false);
  const [sendStatus, setSendStatus] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const feature = usePlanFeatures(!!profile);
  const endRef = useRef<HTMLDivElement>(null);
  const { data: reads = {} } = useChatReads(profile?.id);
  const [askAlerts, setAskAlerts] = useState(false);
  useEffect(() => { setAskAlerts(canAskNotifications()); void ensurePushSubscription().catch(() => undefined); }, []);
  const allowAlerts = async () => {
    const p = await Notification.requestPermission();
    setAskAlerts(false);
    if (p !== "granted") { toast.error("Alerts were blocked. Turn them on in your phone's settings for this app."); return; }
    const ok = await ensurePushSubscription().catch(() => false);
    toast[ok ? "success" : "info"](ok ? "Chat alerts are on for this device" : "Alerts work while the app is open. For alerts when closed, use the installed app (Add to Home Screen).");
  };

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
  const ROLE_LABEL: Record<string, string> = { technician: "Tech", admin: "Admin", supervisor: "Supervisor", superuser: "Superuser" };
  const roleOf = (id: string) => { const r = users.find((u) => u.id === id)?.role; return r ? ROLE_LABEL[r] ?? r : ""; };

  useEffect(() => { endRef.current?.scrollIntoView({ block: "end" }); }, [current.length, active?.id]);

  const unread = useMemo(() => (profile ? unreadByThread(msgs, reads, profile.id) : {}), [msgs, reads, profile]);
  const keyOf = (t: Thread) => `${t.kind}:${t.id}`;

  // Open a thread from a notification link.
  useEffect(() => {
    if (!linked || active) return;
    const t = threads.find((x) => keyOf(x) === linked);
    if (t) setActive(t);
  }, [linked, threads, active]);

  // Mark the open thread read whenever new messages arrive in it.
  useEffect(() => {
    if (!active || !profile) return;
    const k = keyOf(active);
    if (!unread[k] && reads[k]) return;
    void markThreadRead(profile.id, k).then(() => {
      qc.invalidateQueries({ queryKey: ["chat-reads"] });
    });
  }, [active, profile, unread, reads, qc]);

  const pickThread = (thread: Thread | null) => { if (sending) return; if ((text.trim() || files.length || contact) && !window.confirm("Discard this unsent message?")) return; setText(""); setFiles([]); setContact(null); setActive(thread); };
  const chooseFiles = (selected: FileList | null) => {
    let count = files.length; const added: File[] = [];
    for (const file of Array.from(selected ?? [])) { const error = chatFileError(file, count); if (error) { toast.error(error); continue; } added.push(file); count++; }
    setFiles(prev => [...prev, ...added]); if (fileRef.current) fileRef.current.value = "";
  };
  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!active || !profile || sending || (!text.trim() && !files.length && !contact)) return;
    setSending(true); const uploaded: ChatFile[] = [];
    try {
      for (const [index, source] of files.entries()) {
        setSendStatus(`Preparing attachment ${index + 1} of ${files.length}…`);
        const file = await compressChatImage(source);
        setSendStatus(`Uploading attachment ${index + 1} of ${files.length}…`);
        const path = `${profile.company_id}/${profile.id}/${crypto.randomUUID()}.${CHAT_TYPES[file.type]}`;
        const r = await supabase.storage.from(CHAT_BUCKET).upload(path, file, { contentType: file.type, upsert: false });
        if (r.error) throw r.error; uploaded.push({ path, name: file.name.slice(0,180), size: file.size, type: file.type });
      }
      setSendStatus("Sending message…");
      const { data: sentRow, error } = await supabase.from("internal_messages").insert({
        company_id: profile.company_id, sender_id: profile.id, message_text: text.trim(),
        receiver_id: active.kind === "user" ? active.id : null, job_sheet_id: active.kind === "job" ? active.id : null,
        attachments: uploaded, contact_card: contact,
      }).select("id").single();
      if (error) throw error;
      pushChatMessages([sentRow.id]); setText(""); setFiles([]); setContact(null);
      qc.invalidateQueries({ queryKey: ["messages"] });
    } catch (e) {
      if (uploaded.length) await supabase.storage.from(CHAT_BUCKET).remove(uploaded.map(f => f.path));
      toast.error(e instanceof Error ? e.message : "Message not sent. Your attachments are kept here to retry.");
    } finally { setSending(false); setSendStatus(""); }
  };
  if (profile && !feature("core")) return <AppShell title="Team chat"><p>Chat is unavailable for your company.</p></AppShell>;

  return (
    <AppShell title="Team chat">
      <div className="grid h-[calc(100dvh-18rem)] min-h-72 overflow-hidden rounded-lg border bg-card md:h-[calc(100dvh-8rem)] md:grid-cols-[300px_minmax(0,1fr)]">
        <aside className={`${active ? "hidden md:flex" : "flex"} min-h-0 flex-col border-r`}>
          {askAlerts && <div className="flex items-center gap-2 border-b bg-muted/50 p-2 text-xs text-foreground"><Bell className="h-4 w-4 shrink-0" /><span className="flex-1">Get alerts when the app is in the background</span><Button size="sm" variant="secondary" onClick={() => void allowAlerts()}>Allow</Button></div>}
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
                  <Button variant="ghost" disabled={sending} onClick={() => pickThread(t)} className={`grid h-auto w-full grid-cols-[auto_minmax(0,1fr)] whitespace-normal rounded-none items-center gap-3 px-4 py-3 text-left hover:bg-accent ${active?.id === t.id ? "bg-accent" : ""}`}>
                    <span className="grid h-9 w-9 place-items-center rounded-full bg-muted text-muted-foreground">
                      {t.kind === "job" ? <Hash className="h-4 w-4" /> : <User className="h-4 w-4" />}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-foreground">{t.label}{t.kind === "user" && roleOf(t.id) && <span className="ml-2 rounded bg-muted px-1.5 text-xs font-normal text-muted-foreground">{roleOf(t.id)}</span>}</span>
                      <span className={`block truncate text-xs ${unread[keyOf(t)] ? "font-semibold text-foreground" : "text-muted-foreground"}`}>{last?.message_text || (last?.contact_card ? "Contact" : parseChatFiles(last?.attachments).length ? "Attachment" : "No messages yet")}</span>
                    </span>
                    {!!unread[keyOf(t)] && <span aria-label={`${unread[keyOf(t)]} unread`} className="col-start-3 row-start-1 rounded-full bg-destructive px-1.5 text-xs text-destructive-foreground">{unread[keyOf(t)]}</span>}
                  </Button>
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
                <Button size="icon" variant="ghost" className="md:hidden" onClick={() => pickThread(null)} aria-label="Back"><ArrowLeft className="h-4 w-4" /></Button>
                <p className="truncate font-medium text-foreground">{active.label}{active.kind === "user" && roleOf(active.id) && <span className="ml-2 rounded bg-muted px-1.5 text-xs font-normal text-muted-foreground">{roleOf(active.id)}</span>}</p>
              </header>
              <div className="min-h-0 flex-1 space-y-2 overflow-y-auto bg-muted/40 p-4">
                {current.map((m) => {
                  const mine = m.sender_id === profile?.id;
                  return (
                    <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                      <div className={`min-w-0 max-w-[85%] rounded-lg px-3.5 py-2 text-sm shadow-sm ${mine ? "rounded-br-sm bg-primary text-primary-foreground" : "rounded-bl-sm bg-card text-foreground"}`}>
                        {!mine && active.kind === "job" && <p className="mb-0.5 text-xs font-medium text-primary">{nameOf(m.sender_id)}</p>}
                        <p className="whitespace-pre-wrap break-words">{m.message_text}</p><ChatAttachments files={m.attachments} contact={m.contact_card}/>
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
              <form onSubmit={send} className="space-y-2 border-t p-3">
                {(files.length > 0 || contact) && <div className="flex max-h-28 flex-wrap gap-2 overflow-y-auto">{files.map((f,i) => <span key={i} className="inline-flex min-w-0 max-w-full items-center gap-1 rounded border bg-muted px-2 text-xs"><span className="truncate">{f.name}</span><Button type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0" disabled={sending} aria-label={`Remove ${f.name}`} onClick={() => setFiles(files.filter((_,j) => j!==i))}><X className="h-3 w-3"/></Button></span>)}{contact && <span className="inline-flex min-w-0 items-center gap-1 rounded border bg-muted px-2 text-xs"><ContactRound className="h-3 w-3"/><span className="truncate">{contact.name}</span><Button type="button" variant="ghost" size="icon" className="h-7 w-7" disabled={sending} aria-label="Remove contact" onClick={() => setContact(null)}><X className="h-3 w-3"/></Button></span>}</div>}
                <div className="flex gap-2">
                  <input ref={fileRef} type="file" multiple accept={Object.keys(CHAT_TYPES).join(",")} className="hidden" aria-label="Chat files" onChange={e => chooseFiles(e.target.files)}/>
                  <DropdownMenu><DropdownMenuTrigger asChild><Button type="button" size="icon" variant="outline" className="h-11 w-11 shrink-0" disabled={sending} aria-label="Attach" title="Attach"><Paperclip className="h-4 w-4"/></Button></DropdownMenuTrigger><DropdownMenuContent><DropdownMenuItem onSelect={() => fileRef.current?.click()}><Paperclip className="mr-2 h-4 w-4"/>Photo or document</DropdownMenuItem><DropdownMenuItem onSelect={() => { setContactDraft(contact ?? { name: "", phone: "", email: "", company: "" }); setContactOpen(true); }}><ContactRound className="mr-2 h-4 w-4"/>Contact</DropdownMenuItem></DropdownMenuContent></DropdownMenu>
                  <Input className="h-11 min-w-0" disabled={sending} maxLength={4000} value={text} onChange={e => setText(e.target.value)} placeholder="Type a message" />
                  <Button type="submit" size="icon" disabled={sending || (!text.trim() && !files.length && !contact)} className="h-11 w-11 shrink-0" aria-label={sending ? "Sending" : "Send"}><Send className="h-4 w-4" /></Button>
                </div>
                {sending && <p role="status" className="text-xs text-muted-foreground">{sendStatus}</p>}
              </form>
            </>
          ) : (
            <div className="grid flex-1 place-items-center text-sm text-muted-foreground">Pick a conversation</div>
          )}
        </section>
      </div>
      <Dialog open={contactOpen} onOpenChange={setContactOpen}><DialogContent><DialogHeader><DialogTitle>Share contact</DialogTitle></DialogHeader>
        {(["name","phone","email","company"] as const).map(key => <div key={key} className="space-y-1.5"><Label htmlFor={`contact-${key}`}>{key === "name" ? "Name" : key === "phone" ? "Phone" : key === "email" ? "Email" : "Company"}</Label><Input id={`contact-${key}`} type={key === "email" ? "email" : key === "phone" ? "tel" : "text"} maxLength={key === "phone" ? 50 : key === "email" ? 150 : 100} value={contactDraft[key]} onChange={e => setContactDraft({ ...contactDraft, [key]: e.target.value })}/></div>)}
        <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setContactOpen(false)}>Cancel</Button><Button disabled={!validContactCard(contactDraft)} onClick={() => { setContact(contactDraft); setContactOpen(false); }}>Attach contact</Button></div>
      </DialogContent></Dialog>
    </AppShell>
  );
}
