import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CalendarClock, Pause, Play, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PPM_CADENCES, ppmDates } from "@/lib/ppm";
export function PpmCoverage({
  agreementId,
  clientId,
  start,
  end,
  canManage,
}: {
  agreementId: string;
  clientId: string;
  start: string;
  end: string;
  canManage: boolean;
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [asset, setAsset] = useState("");
  const [months, setMonths] = useState("1");
  const [first, setFirst] = useState(start);
  const [grace, setGrace] = useState("0");
  const [lead, setLead] = useState("none");
  const plans = useQuery({
    queryKey: ["ppm-plans", agreementId],
    queryFn: async () => {
      const r = await supabase
        .from("ppm_plans")
        .select("*, assets(reference_number)")
        .eq("agreement_id", agreementId)
        .order("created_at");
      if (r.error) throw r.error;
      return r.data;
    },
  });
  const opts = useQuery({
    queryKey: ["ppm-options", clientId],
    enabled: open,
    queryFn: async () => {
      const [a, u] = await Promise.all([
        supabase
          .from("assets")
          .select("id,reference_number,site_id,sites(name)")
          .eq("client_id", clientId)
          .order("reference_number"),
        supabase.from("users").select("id,full_name").in("role", ["technician", "supervisor"]),
      ]);
      if (a.error) throw a.error;
      if (u.error) throw u.error;
      return { assets: a.data, users: u.data };
    },
  });
  const refresh = () =>
    Promise.all(
      [
        "ppm-plans",
        "ppm-visits",
        "schedule",
        "dispatched-visits",
        "dashboard",
        "equipment-ppm",
      ].map((key) => qc.invalidateQueries({ queryKey: [key] })),
    );
  const save = async () => {
    setBusy(true);
    try {
      const r = await supabase
        .from("ppm_plans")
        .insert({
          agreement_id: agreementId,
          asset_id: asset,
          interval_months: Number(months),
          first_due_date: first,
          grace_days: Number(grace),
          assigned_technician_id: lead === "none" ? null : lead,
        });
      if (r.error) throw r.error;
      await refresh();
      setAsset("");
      toast.success("Maintenance coverage saved and visits scheduled");
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e),
      );
    } finally {
      setBusy(false);
    }
  };
  const act = async (id: string, active?: boolean) => {
    setBusy(true);
    try {
      const r =
        active === undefined
          ? await supabase.rpc("generate_ppm_visits", { _plan: id })
          : await supabase.from("ppm_plans").update({ active }).eq("id", id);
      if (r.error) throw r.error;
      await refresh();
      toast.success(
        active === false
          ? "Plan paused; existing visits remain scheduled"
          : active === true
            ? "Plan resumed"
            : `${r.data ?? 0} new visits scheduled`,
      );
    } catch (e) {
      toast.error((e as { message?: string }).message ?? "Could not update maintenance plan");
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <CalendarClock className="mr-1 h-4 w-4" />
        Maintenance {plans.data?.length ? `(${plans.data.length})` : ""}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90dvh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Planned maintenance coverage</DialogTitle>
          </DialogHeader>
          {plans.error || opts.error ? (
            <p role="alert" className="text-destructive">
              Maintenance coverage could not be loaded.
            </p>
          ) : null}
          <ul className="divide-y">
            {plans.data?.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <div>
                  <p className="font-medium">{p.assets?.reference_number}</p>
                  <p className="text-sm text-muted-foreground">
                    {PPM_CADENCES.find((c) => c.months === p.interval_months)?.label} · first{" "}
                    {p.first_due_date} · {p.active ? "Active" : "Paused"}
                  </p>
                  {p.asset_id && (
                    <Button asChild size="sm" variant="ghost" className="mt-1 h-7 px-2">
                      <Link to="/equipment/$assetId" params={{ assetId: p.asset_id }}>Passport</Link>
                    </Button>
                  )}
                </div>
                {canManage && (
                  <div className="flex gap-1">
                    <Button
                      size="icon"
                      variant="outline"
                      aria-label={p.active ? "Pause plan" : "Resume plan"}
                      title={p.active ? "Pause plan" : "Resume plan"}
                      disabled={busy}
                      onClick={() => act(p.id, !p.active)}
                    >
                      {p.active ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                    </Button>
                    <Button
                      size="icon"
                      variant="outline"
                      aria-label="Generate remaining visits"
                      title="Generate remaining visits"
                      disabled={busy || !p.active}
                      onClick={() => act(p.id)}
                    >
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
          {canManage && (
            <div className="grid gap-4 border-t pt-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label>Equipment</Label>
                <Select value={asset} onValueChange={setAsset}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose covered equipment" />
                  </SelectTrigger>
                  <SelectContent>
                    {opts.data?.assets
                      .filter((a) => !plans.data?.some((p) => p.asset_id === a.id))
                      .map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.reference_number}
                          {a.sites ? ` · ${a.sites.name}` : ""}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Frequency</Label>
                <Select value={months} onValueChange={setMonths}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PPM_CADENCES.map((c) => (
                      <SelectItem key={c.months} value={String(c.months)}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="ppm-first">First visit</Label>
                <Input
                  id="ppm-first"
                  type="date"
                  min={start}
                  max={end}
                  value={first}
                  onChange={(e) => setFirst(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ppm-grace">SLA grace days</Label>
                <Input
                  id="ppm-grace"
                  type="number"
                  min={0}
                  max={30}
                  value={grace}
                  onChange={(e) => setGrace(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Lead technician</Label>
                <Select value={lead} onValueChange={setLead}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Unassigned</SelectItem>
                    {opts.data?.users.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 sm:col-span-2">
                <span className="text-sm text-muted-foreground">
                  {first && first >= start && first <= end
                    ? ppmDates(first, end, Number(months)).length
                    : 0}{" "}
                  visits · agreement ends {end}
                </span>
                <Button
                  disabled={
                    busy ||
                    !asset ||
                    first < start ||
                    first > end ||
                    !grace ||
                    !Number.isInteger(Number(grace)) ||
                    Number(grace) < 0 ||
                    Number(grace) > 30
                  }
                  onClick={save}
                >
                  {busy ? "Saving…" : "Save & schedule visits"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
