import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Building2, MapPin, Pencil, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ContactsManager, EquipmentManager } from "@/components/client-manager";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ClientRouting } from '@/components/client-routing';
import { useProfile, isManager } from '@/lib/profile';

/** Client → head-office contacts, then each site with its own contacts and equipment. */
export function SiteHierarchy({ clientId, companyId }: { clientId: string; companyId: string }) {
  const qc = useQueryClient();
  const { data: profile } = useProfile();
  const key = ["client-sites", clientId];
  const { data: sites = [] } = useQuery({ queryKey: key, queryFn: async () => (await supabase.from("sites").select("*").eq("client_id", clientId).order("name")).data ?? [] });
  const { data: assets = [] } = useQuery({ queryKey: ["client-assets", clientId], queryFn: async () => (await supabase.from("assets").select("*").eq("client_id", clientId).order("reference_number")).data ?? [] });
  const [edit, setEdit] = useState<{ id?: string; name: string; address: string } | null>(null);
  const [openSites, setOpenSites] = useState<string[]>([]);
  const refresh = () => { qc.invalidateQueries({ queryKey: key }); qc.invalidateQueries({ queryKey: ["sites-full"] }); qc.invalidateQueries({ queryKey: ["sheet-refs"] }); qc.invalidateQueries({ queryKey: ["entities-unified"] }); };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!edit) return;
    const res = edit.id
      ? await supabase.from("sites").update({ name: edit.name, address: edit.address }).eq("id", edit.id).select("id").single()
      : await supabase.from("sites").insert({ name: edit.name, address: edit.address, client_id: clientId, company_id: companyId }).select("id").single();
    if (res.error) { toast.error(res.error.message); return; }
    if (!edit.id && res.data) setOpenSites((o) => [...o, res.data.id]);
    setEdit(null); refresh();
  };
  const remove = async (id: string) => {
    if (!confirm("Delete this site? Its contacts are removed too.")) return;
    const { error } = await supabase.from("sites").delete().eq("id", id);
    if (error) toast.error(error.message); else refresh();
  };
  const unsited = assets.filter((a) => !a.site_id);

  return (
    <div className="space-y-4">
      {isManager(profile) && <ClientRouting clientId={clientId}/>}
      <section className="rounded-lg border p-3">
        <p className="mb-2 flex items-center gap-2 text-sm font-medium text-foreground"><Building2 className="h-4 w-4" />Head office</p>
        <ContactsManager clientId={clientId} companyId={companyId} siteId={null} title="Head office contacts" />
      </section>

      <div className="flex items-center justify-between">
        <h3 className="font-medium text-foreground">Sites ({sites.length})</h3>
        {!edit && <Button size="sm" onClick={() => setEdit({ name: "", address: "" })}><Plus className="mr-1 h-4 w-4" />Add new site</Button>}
      </div>
      {edit && (
        <form onSubmit={save} className="space-y-2 rounded-lg border bg-muted/30 p-3">
          <Input required placeholder="Site name (e.g. Centerparc)" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
          <Input placeholder="Address" value={edit.address} onChange={(e) => setEdit({ ...edit, address: e.target.value })} />
          <div className="flex gap-2"><Button type="submit" size="sm">Save site</Button><Button type="button" size="sm" variant="ghost" onClick={() => setEdit(null)}>Cancel</Button></div>
        </form>
      )}
      {sites.length === 0 && !edit && <p className="text-sm text-muted-foreground">No sites yet — add one to attach contacts and equipment.</p>}
      <Accordion type="multiple" value={openSites} onValueChange={setOpenSites} className="space-y-2">
        {sites.map((s) => {
          const eq = assets.filter((a) => a.site_id === s.id);
          return (
            <AccordionItem key={s.id} value={s.id} className="rounded-lg border px-3">
              <AccordionTrigger className="hover:no-underline">
                <div className="min-w-0 text-left">
                  <p className="flex items-center gap-2 font-medium"><MapPin className="h-4 w-4 shrink-0" />{s.name}</p>
                  <p className="truncate text-xs font-normal text-muted-foreground">{s.address || "No address"} · {eq.length ? eq.map((a) => a.reference_number).join(", ") : "no equipment"}</p>
                </div>
              </AccordionTrigger>
              <AccordionContent className="space-y-4">
                <div className="flex justify-end gap-1">
                  <Button size="sm" variant="ghost" onClick={() => setEdit({ id: s.id, name: s.name, address: s.address ?? "" })}><Pencil className="mr-1 h-3.5 w-3.5" />Edit site</Button>
                  <Button size="sm" variant="ghost" onClick={() => remove(s.id)}><Trash2 className="mr-1 h-3.5 w-3.5" />Delete</Button>
                </div>
                <ContactsManager clientId={clientId} companyId={companyId} siteId={s.id} title="Site contacts" />
                <EquipmentManager clientId={clientId} companyId={companyId} siteId={s.id} />
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
      {unsited.length > 0 && (
        <p className="text-xs text-muted-foreground">Not linked to a site: {unsited.map((a) => a.reference_number).join(", ")} — edit from the full equipment list.</p>
      )}
    </div>
  );
}
