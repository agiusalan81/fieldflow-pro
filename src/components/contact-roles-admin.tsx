import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, Pencil, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useContactRoles } from "@/components/role-combobox";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

/** Admin review of role titles learnt from contacts: approve, rename (updates contacts) or merge. */
export function ContactRolesAdmin() {
  const qc = useQueryClient();
  const { data: roles = [] } = useContactRoles();
  const refresh = () => { qc.invalidateQueries({ queryKey: ["contact-roles"] }); qc.invalidateQueries({ queryKey: ["client-contacts"] }); };
  const pending = roles.filter((r) => !r.is_approved);
  const approved = roles.filter((r) => r.is_approved);

  const approve = async (id: string) => {
    const { error } = await supabase.from("lookup_options").update({ is_approved: true }).eq("id", id);
    if (error) toast.error(error.message); else refresh();
  };
  const rename = async (r: (typeof roles)[number]) => {
    const name = prompt("Standard name for this role", r.label_value)?.trim();
    if (!name || name === r.label_value) return;
    const { error } = await supabase.from("lookup_options").update({ label_value: name, is_approved: true }).eq("id", r.id);
    if (error) { toast.error(error.message); return; }
    await supabase.from("client_contacts").update({ role_title: name }).eq("role_title", r.label_value);
    toast.success("Role renamed on all contacts"); refresh();
  };
  const merge = async (r: (typeof roles)[number], intoId: string) => {
    const into = roles.find((x) => x.id === intoId);
    if (!into) return;
    await supabase.from("client_contacts").update({ role_title: into.label_value }).eq("role_title", r.label_value);
    await supabase.from("lookup_options").update({ usage_count: into.usage_count + r.usage_count }).eq("id", into.id);
    const { error } = await supabase.from("lookup_options").delete().eq("id", r.id);
    if (error) toast.error(error.message); else { toast.success(`Merged into ${into.label_value}`); refresh(); }
  };
  const remove = async (id: string) => {
    const { error } = await supabase.from("lookup_options").delete().eq("id", id);
    if (error) toast.error(error.message); else refresh();
  };

  const row = (r: (typeof roles)[number], isPending: boolean) => (
    <li key={r.id} className="flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 text-sm">
      <span className="min-w-0 flex-1 truncate">{r.label_value} <span className="text-xs text-muted-foreground">· used {r.usage_count}×</span>{isPending && <span className="ml-2 rounded bg-warning/15 px-1.5 text-xs text-warning">New</span>}</span>
      {isPending && <Button size="sm" variant="outline" onClick={() => approve(r.id)}><Check className="mr-1 h-3.5 w-3.5" />Approve</Button>}
      <Button size="sm" variant="ghost" onClick={() => rename(r)}><Pencil className="mr-1 h-3.5 w-3.5" />Rename</Button>
      {approved.filter((a) => a.id !== r.id).length > 0 && (
        <Select value="" onValueChange={(v) => merge(r, v)}>
          <SelectTrigger className="h-8 w-32"><SelectValue placeholder="Merge into" /></SelectTrigger>
          <SelectContent>{approved.filter((a) => a.id !== r.id).map((a) => <SelectItem key={a.id} value={a.id}>{a.label_value}</SelectItem>)}</SelectContent>
        </Select>
      )}
      <Button size="icon" variant="ghost" aria-label="Delete role" onClick={() => remove(r.id)}><Trash2 className="h-4 w-4" /></Button>
    </li>
  );

  return (
    <section className="space-y-4 rounded-xl border bg-card p-5">
      <div><h2 className="font-medium text-foreground">Contact roles</h2><p className="text-sm text-muted-foreground">New titles typed on contacts appear here for review. Approved roles are suggested to everyone.</p></div>
      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Waiting for review ({pending.length})</p>
        <ul className="space-y-1.5">{pending.length ? pending.map((r) => row(r, true)) : <li className="text-sm text-muted-foreground">Nothing to review</li>}</ul>
      </div>
      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Approved ({approved.length})</p>
        <ul className="space-y-1.5">{approved.length ? approved.map((r) => row(r, false)) : <li className="text-sm text-muted-foreground">None yet</li>}</ul>
      </div>
    </section>
  );
}
