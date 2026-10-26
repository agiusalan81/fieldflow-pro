import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/lib/profile";
import { SearchSelect } from "@/components/search-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Addr = { building: string; street: string; city: string; postcode: string };
const emptyAddr: Addr = { building: "", street: "", city: "", postcode: "" };
const joinAddr = (a: Addr) => [a.building, a.street, [a.city, a.postcode].filter((v) => v.trim()).join(" ")].map((v) => v.trim()).filter(Boolean).join(", ");

function AddressFields({ value, onChange, prefix }: { value: Addr; onChange: (a: Addr) => void; prefix: string }) {
  const f = (k: keyof Addr, label: string) => <div className="space-y-1"><Label htmlFor={`${prefix}-${k}`}>{label}</Label><Input id={`${prefix}-${k}`} value={value[k]} onChange={(e) => onChange({ ...value, [k]: e.target.value })} /></div>;
  return <div className="grid gap-3 sm:grid-cols-2">{f("building", "Building name")}{f("street", "Street")}{f("city", "City / locality")}{f("postcode", "Postcode")}</div>;
}

const NONE = "none";

/**
 * Shared client + site chooser: type to search existing records or add a new client
 * (full address + primary contact) or a new site without leaving the form.
 * Values use null for "not chosen".
 */
export function ClientSitePicker({ clientId, siteId, onChange, disabled, showSite = true, clientLabel = "Client", siteLabel = "Site", noneClientLabel, noneSiteLabel = "No site" }: {
  clientId: string | null; siteId: string | null; onChange: (clientId: string | null, siteId: string | null) => void;
  disabled?: boolean; showSite?: boolean; clientLabel?: string; siteLabel?: string; noneClientLabel?: string; noneSiteLabel?: string;
}) {
  const { data: profile } = useProfile();
  const qc = useQueryClient();
  const clients = useQuery({ queryKey: ["picker-clients", profile?.company_id], enabled: !!profile, queryFn: async () => { const r = await supabase.from("clients").select("id,name,billing_address").order("name"); if (r.error) throw r.error; return r.data; } });
  const sites = useQuery({ queryKey: ["picker-sites", profile?.company_id], enabled: !!profile, queryFn: async () => { const r = await supabase.from("sites").select("id,name,address,client_id").order("name"); if (r.error) throw r.error; return r.data; } });
  const [clientOpen, setClientOpen] = useState(false);
  const [siteOpen, setSiteOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const blankClient = { name: "", first: "", last: "", phone: "", email: "", addr: emptyAddr, sameSite: true, siteName: "", siteAddr: emptyAddr };
  const [c, setC] = useState(blankClient);
  const [s, setS] = useState({ name: "", addr: emptyAddr, sameAsClient: false });

  const refresh = async () => { await qc.invalidateQueries(); };

  const clientOptions = [...(noneClientLabel ? [{ value: NONE, label: noneClientLabel }] : []), ...(clients.data ?? []).map((x) => ({ value: x.id, label: x.name, hint: x.billing_address ?? undefined }))];
  const siteOptions = [{ value: NONE, label: noneSiteLabel }, ...(sites.data ?? []).filter((x) => x.client_id === clientId).map((x) => ({ value: x.id, label: x.name, hint: x.address ?? undefined }))];
  const client = clients.data?.find((x) => x.id === clientId);

  const insertSite = async (forClient: string, name: string, address: string) => {
    const r = await supabase.from("sites").insert({ client_id: forClient, company_id: profile!.company_id, name: name.trim() || address.split(",")[0] || "Site", address }).select("id").single();
    if (r.error) throw r.error; return r.data.id;
  };

  const saveClient = async () => {
    if (!c.name.trim() || !c.first.trim()) { toast.error("Enter the client name and contact first name"); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email.trim())) { toast.error("Enter a valid contact email"); return; }
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc("create_client_setup", { _details: { name: c.name.trim(), property_name: c.addr.building.trim(), street_name: c.addr.street.trim(), location: [c.addr.city, c.addr.postcode].map((v) => v.trim()).filter(Boolean).join(" "), first_name: c.first.trim(), last_name: c.last.trim(), email: c.email.trim(), phone: c.phone.trim(), role_title: "", has_whatsapp: false, delivery_preferences: { job_sheet: { email: true, whatsapp: false }, estimate: { email: true, whatsapp: false }, proposal: { email: true, whatsapp: false } } } as never });
      const made = data as { client_id: string; site_id: string | null } | null;
      if (error || !made) throw error ?? new Error("Could not save client");
      let site: string | null = made.site_id;
      if (showSite) {
        if (c.sameSite && !site && joinAddr(c.addr)) site = await insertSite(made.client_id, c.addr.building || "Main site", joinAddr(c.addr));
        if (!c.sameSite && joinAddr(c.siteAddr)) site = await insertSite(made.client_id, c.siteName || c.siteAddr.building, joinAddr(c.siteAddr));
      }
      await refresh(); onChange(made.client_id, showSite ? site : null); setClientOpen(false); setC(blankClient); toast.success("Client added");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not save client"); } finally { setBusy(false); }
  };

  const saveSite = async () => {
    if (!clientId) return;
    const address = s.sameAsClient ? client?.billing_address ?? "" : joinAddr(s.addr);
    if (!address.trim() && !s.name.trim()) { toast.error("Enter a site name or address"); return; }
    setBusy(true);
    try { const id = await insertSite(clientId, s.name || (s.sameAsClient ? "Main site" : s.addr.building), address); await refresh(); onChange(clientId, id); setSiteOpen(false); setS({ name: "", addr: emptyAddr, sameAsClient: false }); toast.success("Site added"); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Could not save site"); } finally { setBusy(false); }
  };

  return <>
    <div className="space-y-1"><Label>{clientLabel}</Label>
      <SearchSelect disabled={!!disabled} value={clientId ?? (noneClientLabel ? NONE : null)} options={clientOptions} placeholder="Type to search clients…" createLabel="Add new client"
        onCreate={(typed) => { setC({ ...blankClient, name: typed }); setClientOpen(true); }}
        onChange={(v) => { const id = v === NONE ? null : v; if (id !== clientId) onChange(id, null); }} /></div>
    {showSite && <div className="space-y-1"><Label>{siteLabel}</Label>
      <SearchSelect disabled={!!disabled || !clientId} value={siteId ?? NONE} options={siteOptions} placeholder={clientId ? "Type to search sites…" : "Choose a client first"} createLabel="Add new site"
        onCreate={(typed) => { setS({ name: typed, addr: emptyAddr, sameAsClient: false }); setSiteOpen(true); }}
        onChange={(v) => onChange(clientId, v === NONE ? null : v)} /></div>}

    <Dialog open={clientOpen} onOpenChange={setClientOpen}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader><DialogTitle>New client</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1"><Label htmlFor="nc-name">Client / company name</Label><Input id="nc-name" value={c.name} onChange={(e) => setC({ ...c, name: e.target.value })} /></div>
          <fieldset className="space-y-2"><legend className="text-sm font-semibold">Client address</legend><AddressFields prefix="nc" value={c.addr} onChange={(addr) => setC({ ...c, addr })} /></fieldset>
          <fieldset className="space-y-2"><legend className="text-sm font-semibold">Primary contact</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1"><Label htmlFor="nc-first">Name</Label><Input id="nc-first" value={c.first} onChange={(e) => setC({ ...c, first: e.target.value })} /></div>
              <div className="space-y-1"><Label htmlFor="nc-last">Surname</Label><Input id="nc-last" value={c.last} onChange={(e) => setC({ ...c, last: e.target.value })} /></div>
              <div className="space-y-1"><Label htmlFor="nc-phone">Phone</Label><Input id="nc-phone" type="tel" value={c.phone} onChange={(e) => setC({ ...c, phone: e.target.value })} /></div>
              <div className="space-y-1"><Label htmlFor="nc-email">Email</Label><Input id="nc-email" type="email" value={c.email} onChange={(e) => setC({ ...c, email: e.target.value })} /></div>
            </div></fieldset>
          {showSite && <fieldset className="space-y-2"><legend className="text-sm font-semibold">Site</legend>
            <label className="flex items-center gap-2 text-sm"><Checkbox checked={c.sameSite} onCheckedChange={(v) => setC({ ...c, sameSite: v === true })} />Site address is the same as the client address</label>
            {!c.sameSite && <><div className="space-y-1"><Label htmlFor="nc-site">Site name</Label><Input id="nc-site" value={c.siteName} onChange={(e) => setC({ ...c, siteName: e.target.value })} /></div><AddressFields prefix="ncs" value={c.siteAddr} onChange={(siteAddr) => setC({ ...c, siteAddr })} /></>}
          </fieldset>}
        </div>
        <DialogFooter><Button variant="outline" onClick={() => setClientOpen(false)}>Cancel</Button><Button disabled={busy} onClick={() => void saveClient()}>Save client</Button></DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog open={siteOpen} onOpenChange={setSiteOpen}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>New site{client ? ` for ${client.name}` : ""}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1"><Label htmlFor="ns-name">Site name</Label><Input id="ns-name" value={s.name} onChange={(e) => setS({ ...s, name: e.target.value })} /></div>
          <label className="flex items-center gap-2 text-sm"><Checkbox checked={s.sameAsClient} onCheckedChange={(v) => setS({ ...s, sameAsClient: v === true })} />Same as client address{client?.billing_address ? ` (${client.billing_address})` : ""}</label>
          {!s.sameAsClient && <AddressFields prefix="ns" value={s.addr} onChange={(addr) => setS({ ...s, addr })} />}
        </div>
        <DialogFooter><Button variant="outline" onClick={() => setSiteOpen(false)}>Cancel</Button><Button disabled={busy} onClick={() => void saveSite()}>Save site</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </>;
}
