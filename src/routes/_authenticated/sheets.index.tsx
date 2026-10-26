import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { formatSiteTitle } from "@/lib/site-display";
import { useCompanyRules } from "@/lib/company";
import { sheetWithinHistory } from "@/lib/sheet-history";
import { MonthlySheets } from "@/components/monthly-sheets";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Eye, Pencil, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { usePreviewProfile } from "@/lib/impersonation";
import { matchesSheetSearch } from "@/lib/dwr";
import { matchesSheetType, type SheetTypeFilter } from "@/lib/jobsheet-type-filter";
import { AppShell, StatusBadge, EmptyState } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/sheets/")({ staticData: { sitemap: false },
  head: () => ({
    meta: [
      { title: "Past & draft job sheets — FieldBridge" },
      { name: "description", content: "Resume drafts or open completed job sheets." },
      { property: "og:title", content: "Past & draft job sheets — FieldBridge" },
      { property: "og:description", content: "Your job sheets." },
      { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
    ],
  }),
  validateSearch: (s: Record<string, unknown>): { tab?: "open" | "done" } => (s["tab"] === "done" ? { tab: "done" } : {}),
  component: SheetsPage,
});

function SheetsPage() {
  const { data: profile, isPreview } = usePreviewProfile();
  const qc = useQueryClient();
  const {data:company}=useCompanyRules();
  const navigate = useNavigate();
  const { tab = "open" } = Route.useSearch();
  const [q, setQ] = useState("");
  const [client, setClient] = useState("all");
  const [jobType, setJobType] = useState<SheetTypeFilter>("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const supervisor = profile?.role === "supervisor";
  const [scope, setScope] = useState<"mine" | "team">("mine");
  const teamView = supervisor && scope === "team";

  const { data: sheets = [] } = useQuery({
    queryKey: ["sheets", profile?.id,company?.fieldSheetHistoryMonths, teamView],
    enabled: !!profile,
    queryFn: async () => {
      if (!profile) return [];
      const assignments = await supabase.from("jobs").select("id").eq("secondary_technician_id", profile.id);
      if (assignments.error) throw assignments.error;
      const assistingJobs = (assignments.data ?? []).map(j => j.id);
      let query = supabase
        .from("job_sheets")
        .select("id, jobsheet_number, status, signature_data, created_at, updated_at, reported_fault, is_installation, is_tech_assistance, is_maintenance, assigned_technician_id, client_id, clients(name), sites(name,address,store_code), assets(reference_number), technician:users!job_sheets_assigned_technician_id_fkey(full_name)")
        .order("updated_at", { ascending: false });
      if (!teamView) query = assistingJobs.length ? query.or(`assigned_technician_id.eq.${profile.id},job_id.in.(${assistingJobs.join(",")})`) : query.eq("assigned_technician_id", profile.id);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });
  const clients = Array.from(new Map(sheets.map((s) => [s.client_id, s.clients?.name ?? ""])).entries());
  const filtered = sheets.filter((s) => {
    const d = s.created_at.slice(0, 10);
    return (teamView||s.status!=="completed"||sheetWithinHistory(s.created_at,company?.fieldSheetHistoryMonths??12)) && (client === "all" || s.client_id === client) && (!from || d >= from) && (!to || d <= to) && matchesSheetType(s, jobType)
      && matchesSheetSearch(s.jobsheet_number, [s.clients?.name, s.sites?formatSiteTitle(s.sites):undefined, s.assets?.reference_number, s.reported_fault], q);
  });
  const open = filtered.filter((s) => s.status !== "completed");
  const done = filtered.filter((s) => s.status === "completed");

  const discard = async (id: string) => {
    if (isPreview) return;
    const { error } = await supabase.from("job_sheets").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Draft discarded");
    qc.invalidateQueries({ queryKey: ["sheets"] });
  };

  const Card = ({ s, completed }: { s: (typeof sheets)[number]; completed?: boolean }) => (
    <li className="grid gap-3 rounded-xl border bg-card p-4 transition-colors hover:bg-muted/40 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center" onClick={() => { if (!isPreview) void navigate({ to: "/sheets/$sheetId", params: { sheetId: s.id } }); }}>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm text-primary">#{s.jobsheet_number}</span>
          <StatusBadge status={s.status} />
        </div>
        <p className="mt-1 truncate font-medium text-foreground">{s.clients?.name}{s.sites?.name ? ` · ${formatSiteTitle(s.sites)}` : ""}</p>
        <p className="truncate text-xs text-muted-foreground">{teamView && s.technician?.full_name ? `${s.technician.full_name} · ` : ""}{s.assets?.reference_number ?? "No lift"} · {s.reported_fault || "No fault noted"} · {new Date(s.created_at).toLocaleDateString()}</p>
      </div>
      <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
        {isPreview ? <span className="text-xs text-muted-foreground">Read-only preview</span> : completed ? (
          <Button asChild variant="outline" className="h-10 flex-1 sm:flex-none"><Link to="/sheets/$sheetId" params={{ sheetId: s.id }}><Eye className="mr-1 h-4 w-4" />View / Open Full Job Sheet</Link></Button>
        ) : (
          <>
            <Button asChild className="h-10 flex-1 sm:flex-none"><Link to="/sheets/$sheetId" params={{ sheetId: s.id }}><Pencil className="mr-1 h-4 w-4" />Resume / Edit</Link></Button>
            {s.status === "draft" && s.assigned_technician_id === profile?.id && !isPreview && (
              <AlertDialog>
                <AlertDialogTrigger asChild><Button variant="outline" className="h-10"><Trash2 className="h-4 w-4 sm:mr-1" /><span className="hidden sm:inline">Discard Draft</span></Button></AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Discard draft #{s.jobsheet_number}?</AlertDialogTitle>
                    <AlertDialogDescription>Everything in this draft will be deleted. This can't be undone.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter><AlertDialogCancel>Keep it</AlertDialogCancel><AlertDialogAction onClick={() => discard(s.id)}>Discard</AlertDialogAction></AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </>
        )}
      </div>
    </li>
  );

  return (
    <AppShell title="Past & draft job sheets">
      <div className="mx-auto max-w-5xl space-y-4">
        {supervisor && !isPreview && <div role="group" aria-label="Whose sheets" className="inline-flex rounded-md border p-1">
          <Button size="sm" variant={scope === "mine" ? "default" : "ghost"} aria-pressed={scope === "mine"} onClick={() => setScope("mine")}>My sheets</Button>
          <Button size="sm" variant={scope === "team" ? "default" : "ghost"} aria-pressed={scope === "team"} onClick={() => setScope("team")}>All team sheets</Button>
        </div>}
        <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_200px_190px_150px_150px]">
          <Input className="h-11" placeholder="Search number, client, site, fault…" value={q} onChange={(e) => setQ(e.target.value)} />
          <Select value={client} onValueChange={setClient}>
            <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">All clients</SelectItem>{clients.map(([id, n]) => <SelectItem key={id} value={id}>{n}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={jobType} onValueChange={(v) => setJobType(v as SheetTypeFilter)}>
            <SelectTrigger className="h-11" aria-label="Job type"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All job types</SelectItem>
              <SelectItem value="installation">Installation</SelectItem>
              <SelectItem value="tech_assistance">Technical assistance</SelectItem>
              <SelectItem value="maintenance">Maintenance</SelectItem>
            </SelectContent>
          </Select>
          <Input className="h-11" type="date" aria-label="From date" value={from} onChange={(e) => setFrom(e.target.value)} />
          <Input className="h-11" type="date" aria-label="To date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        {!isPreview && <MonthlySheets sheets={filtered} office={profile?.role === "admin" || profile?.role === "superuser"} />}
        <Tabs value={tab} onValueChange={(v) => navigate({ to: "/sheets", search: v === "done" ? { tab: "done" } : {}, replace: true })}>
          <TabsList className="grid w-full grid-cols-2 sm:w-auto">
            <TabsTrigger value="open">Drafts & In-Progress ({open.length})</TabsTrigger>
            <TabsTrigger value="done">Completed ({done.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="open" className="mt-4">
            {open.length === 0 ? <EmptyState>No drafts or open sheets.</EmptyState> : <ul className="space-y-2">{open.map((s) => <Card key={s.id} s={s} />)}</ul>}
          </TabsContent>
          <TabsContent value="done" className="mt-4">
            {done.length === 0 ? <EmptyState>No completed sheets match.</EmptyState> : <ul className="space-y-2">{done.map((s) => <Card key={s.id} s={s} completed />)}</ul>}
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}
