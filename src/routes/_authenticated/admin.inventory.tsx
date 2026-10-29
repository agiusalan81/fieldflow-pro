import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, Minus, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/lib/profile";
import { AppShell, EmptyState } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToolRegister, useInventoryModes } from "@/components/tool-register";
import { canAdjustStock, isInventoryManager } from "@/lib/inventory-control";

export const Route = createFileRoute("/_authenticated/admin/inventory")({ staticData: { sitemap: false },
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { title: "Inventory — FieldBridge" },
      { name: "description", content: "Parts stock control with low-stock alerts." },
      { property: "og:title", content: "Inventory — FieldBridge" },
      { property: "og:description", content: "Parts stock control." },
    ],
  }),
  validateSearch: (s: Record<string, unknown>) => ({ tab: s["tab"] === "tools" ? "tools" as const : undefined }),
  component: Inventory,
});

function Inventory() {
  const { data: profile } = useProfile();
  const { tab } = Route.useSearch();
  const navigate = Route.useNavigate();
  const manager = isInventoryManager(profile?.role);
  const partsMode = useInventoryModes(profile?.company_id).data?.parts ?? "managed";
  const qc = useQueryClient();
  const [lowOnly, setLowOnly] = useState(false);
  const [open, setOpen] = useState(false);
  const empty = { part_name: "", sku: "", min_stock_level: "0", current_stock: "0", requires_approval: false };
  const [f, setF] = useState(empty);
  const { data: items = [] } = useQuery({ queryKey: ["inventory"], queryFn: async () => (await supabase.from("inventory_items").select("*").order("part_name")).data ?? [] });
  const refresh = () => qc.invalidateQueries({ queryKey: ["inventory"] });
  const low = items.filter((i) => i.current_stock <= i.min_stock_level);

  const adjust = async (id: string, value: number) => {
    const { error } = await supabase.from("inventory_items").update({ current_stock: Math.max(0, value) }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    refresh();
  };
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.from("inventory_items").insert({
      company_id: profile!.company_id, part_name: f.part_name, sku: f.sku || null,
      min_stock_level: Number(f.min_stock_level), current_stock: Number(f.current_stock), requires_approval: f.requires_approval,
    });
    if (error) { toast.error(error.message); return; }
    setOpen(false); setF(empty); refresh();
  };
  const remove = async (id: string) => {
    if (!confirm("Delete this part?")) return;
    const { error } = await supabase.from("inventory_items").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    refresh();
  };

  return (
    <AppShell
      title="Inventory"
      actions={manager && tab !== "tools" &&
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm"><Plus className="mr-1 h-4 w-4" />Add part</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New part</DialogTitle></DialogHeader>
            <form onSubmit={save} className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5"><Label>Part name</Label><Input required value={f.part_name} onChange={(e) => setF({ ...f, part_name: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>SKU</Label><Input value={f.sku} onChange={(e) => setF({ ...f, sku: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>Current stock</Label><Input type="number" min="0" value={f.current_stock} onChange={(e) => setF({ ...f, current_stock: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>Minimum level</Label><Input type="number" min="0" value={f.min_stock_level} onChange={(e) => setF({ ...f, min_stock_level: e.target.value })} /></div>
              </div>
              <label className="flex items-center gap-2 text-sm"><Checkbox checked={f.requires_approval} onCheckedChange={(c) => setF({ ...f, requires_approval: !!c })} />Requires approval to use</label>
              <Button type="submit" className="w-full">Save</Button>
            </form>
          </DialogContent>
        </Dialog>
      }
    >
      <Tabs value={tab ?? "parts"} onValueChange={(v) => navigate({ search: { tab: v === "tools" ? "tools" : undefined } })}>
        <TabsList className="mb-4"><TabsTrigger value="parts">Parts & consumables</TabsTrigger><TabsTrigger value="tools">Tool register</TabsTrigger></TabsList>
        <TabsContent value="parts">
      {low.length > 0 && (
        <div className="mb-4 flex items-center gap-3 rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm">
          <AlertTriangle className="h-5 w-5 shrink-0 text-destructive" />
          <p className="min-w-0 text-foreground"><strong>{low.length} part{low.length > 1 ? "s" : ""}</strong> at or below minimum: {low.map((i) => i.part_name).join(", ")}</p>
        </div>
      )}
      <label className="mb-3 flex items-center gap-2 text-sm"><Checkbox checked={lowOnly} onCheckedChange={(c) => setLowOnly(!!c)} />Show low stock only</label>
      {items.length === 0 ? <EmptyState>No parts yet.</EmptyState> : (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <Table>
            <TableHeader><TableRow><TableHead>Part</TableHead><TableHead>SKU</TableHead><TableHead className="text-right">Min</TableHead><TableHead className="text-center">Stock</TableHead><TableHead>Status</TableHead><TableHead /></TableRow></TableHeader>
            <TableBody>
              {(lowOnly ? low : items).map((i) => {
                const isLow = i.current_stock <= i.min_stock_level;
                return (
                  <TableRow key={i.id}>
                    <TableCell className="font-medium">{i.part_name}{i.requires_approval && <span className="ml-2 rounded bg-secondary px-1.5 text-xs text-muted-foreground">Approval</span>}</TableCell>
                    <TableCell className="text-muted-foreground">{i.sku ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{i.min_stock_level}</TableCell>
                    <TableCell>
                      <div className="flex items-center justify-center gap-1">
                        <Button size="icon" variant="outline" className="h-8 w-8" aria-label="Decrease" disabled={!canAdjustStock(profile?.role, partsMode, i.requires_approval)} onClick={() => adjust(i.id, i.current_stock - 1)}><Minus className="h-3 w-3" /></Button>
                        <span className="w-10 text-center tabular-nums">{i.current_stock}</span>
                        <Button size="icon" variant="outline" className="h-8 w-8" aria-label="Increase" disabled={!canAdjustStock(profile?.role, partsMode, i.requires_approval)} onClick={() => adjust(i.id, i.current_stock + 1)}><Plus className="h-3 w-3" /></Button>
                      </div>
                    </TableCell>
                    <TableCell>{isLow ? <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs text-destructive">Low stock</span> : <span className="rounded-full bg-success/15 px-2 py-0.5 text-xs text-success">OK</span>}</TableCell>
                    <TableCell className="text-right">{manager && <Button size="icon" variant="ghost" aria-label="Delete" onClick={() => remove(i.id)}><Trash2 className="h-4 w-4" /></Button>}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
        </TabsContent>
        <TabsContent value="tools">{profile && <ToolRegister profile={profile} />}</TabsContent>
      </Tabs>
    </AppShell>
  );
}
