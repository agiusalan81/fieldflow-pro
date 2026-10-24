import { StaffSignatureEditor } from "@/components/staff-signature";
import { staffSignatureEligible } from "@/lib/staff-signature";
import { PushDeviceStatus } from "@/components/push-device-status";
import { PhoneInput, splitPhone } from "@/components/client-manager";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { KeyRound, LogOut, Moon, Sun, Volume2 } from "lucide-react";
import { playChime, setSoundsOn, soundsOn } from "@/lib/chime";
import { supabase } from "@/integrations/supabase/client";
import { useProfile, initialsOf, type Kin } from "@/lib/profile";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/settings")({ staticData: { sitemap: false },
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { title: "Personal settings — FieldBridge" },
      { name: "description", content: "Your contact details, next of kin and app preferences." },
      { property: "og:title", content: "Personal settings — FieldBridge" },
      { property: "og:description", content: "Personal settings." },
    ],
  }),
  component: Settings,
});

const LANG: Record<string, string> = { en: "English", mt: "Maltese", it: "Italian", de: "German" };

function KinFields({ title, v, onChange }: { title: string; v: Kin; onChange: (k: Kin) => void }) {
  return (
    <div className="space-y-3 rounded-lg border p-4">
      <p className="text-sm font-medium text-foreground">{title}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {(["name", "relationship", "phone", "email"] as const).map((k) => (
          <div key={k} className={`space-y-1.5 ${k === "phone" ? "sm:col-span-2" : ""}`}>
            <Label className="capitalize">{k}</Label>
            {k === "phone" ? <PhoneInput code={splitPhone(v.phone).code} number={splitPhone(v.phone).number} onChange={(c, n) => onChange({ ...v, phone: `${c} ${n}`.trim() })} />
              : <Input className="h-11" type={k === "email" ? "email" : "text"} value={v[k] ?? ""} onChange={(e) => onChange({ ...v, [k]: e.target.value })} />}
          </div>
        ))}
      </div>
    </div>
  );
}

function Settings() {
  const { data: profile } = useProfile();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [sounds, setSounds] = useState(true);
  useEffect(() => { if (profile) setSounds(soundsOn(profile.id)); }, [profile?.id]);
  const [f, setF] = useState({ phone_number: "", home_address: "", next_of_kin_1: {} as Kin, next_of_kin_2: {} as Kin, app_theme_preference: "light" });
  const [pw, setPw] = useState({ a: "", b: "" });
  const [pwOpen, setPwOpen] = useState(false);

  useEffect(() => {
    if (profile) setF({
      phone_number: profile.phone_number ?? "", home_address: profile.home_address ?? "",
      next_of_kin_1: profile.next_of_kin_1 ?? {}, next_of_kin_2: profile.next_of_kin_2 ?? {}, app_theme_preference: profile.app_theme_preference,
    });
  }, [profile]);

  if (!profile) return <AppShell title="Settings"><p className="text-muted-foreground">Loading…</p></AppShell>;

  const save = async () => {
    const { error } = await supabase.from("users").update(f as never).eq("id", profile.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Profile updated");
    qc.invalidateQueries({ queryKey: ["profile"] });
  };
  const changePw = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pw.a.length < 8) { toast.error("Use at least 8 characters"); return; }
    if (pw.a !== pw.b) { toast.error("Passwords don't match"); return; }
    const { error } = await supabase.auth.updateUser({ password: pw.a });
    if (error) { toast.error(error.message); return; }
    toast.success("Password changed");
    setPw({ a: "", b: "" }); setPwOpen(false);
  };
  const logout = async () => {
    await qc.cancelQueries(); qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  const ro: [string, string][] = [
    ["Full name", profile.full_name],
    ["Employee ID", profile.employee_id ?? "Not set"],
    ["Technician initials", initialsOf(profile)],
    ["Official email", profile.email],
    ["Language", LANG[profile.language_preference] ?? profile.language_preference],
  ];

  return (
    <AppShell title="Personal settings">
      <div className="mx-auto grid max-w-5xl gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-5">
          <section className="space-y-4 rounded-xl border bg-card p-5">
            <h2 className="font-medium text-foreground">Contact details</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2"><Label>Phone number</Label><PhoneInput code={splitPhone(f.phone_number).code} number={splitPhone(f.phone_number).number} onChange={(c, n) => setF({ ...f, phone_number: `${c} ${n}`.trim() })} /></div>
              <div className="space-y-1.5"><Label>Home address</Label><Input className="h-11" value={f.home_address} onChange={(e) => setF({ ...f, home_address: e.target.value })} /></div>
            </div>
            <KinFields title="Next of kin 1" v={f.next_of_kin_1} onChange={(k) => setF({ ...f, next_of_kin_1: k })} />
            <KinFields title="Next of kin 2" v={f.next_of_kin_2} onChange={(k) => setF({ ...f, next_of_kin_2: k })} />
            <label className="flex items-center justify-between rounded-lg border p-4">
              <span className="flex items-center gap-2 text-sm">{f.app_theme_preference === "dark" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}Dark theme</span>
              <Switch checked={f.app_theme_preference === "dark"} onCheckedChange={(c) => setF({ ...f, app_theme_preference: c ? "dark" : "light" })} />
            </label>
            <label className="flex items-center justify-between rounded-lg border p-4">
              <span className="flex items-center gap-2 text-sm"><Volume2 className="h-4 w-4" />Notification sounds</span>
              <Switch checked={sounds} onCheckedChange={(c) => { setSounds(c); if (profile) setSoundsOn(profile.id, c); if (c) playChime("message"); }} />
            </label>
          </section>
          <PushDeviceStatus />
          {staffSignatureEligible(profile.real_role) && staffSignatureEligible(profile.role) && <section className="space-y-3 border-t pt-5"><h2 className="font-medium">Your staff signature</h2><StaffSignatureEditor /></section>}
          <div className="grid gap-2 sm:grid-cols-3">
            <Button className="h-11" onClick={save}>Update Profile</Button>
            <Dialog open={pwOpen} onOpenChange={setPwOpen}>
              <DialogTrigger asChild><Button variant="outline" className="h-11"><KeyRound className="mr-1 h-4 w-4" />Change Password</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Change password</DialogTitle></DialogHeader>
                <form onSubmit={changePw} className="space-y-3">
                  <div className="space-y-1.5"><Label>New password</Label><Input type="password" value={pw.a} onChange={(e) => setPw({ ...pw, a: e.target.value })} /></div>
                  <div className="space-y-1.5"><Label>Confirm password</Label><Input type="password" value={pw.b} onChange={(e) => setPw({ ...pw, b: e.target.value })} /></div>
                  <Button type="submit" className="w-full">Save password</Button>
                </form>
              </DialogContent>
            </Dialog>
            <Button variant="outline" className="h-11" onClick={logout}><LogOut className="mr-1 h-4 w-4" />Log Out</Button>
          </div>
        </div>
        <aside className="space-y-3 rounded-xl border bg-card p-5">
          <h2 className="font-medium text-foreground">Set by your admin</h2>
          <dl className="space-y-2 text-sm">
            {ro.map(([k, v]) => (
              <div key={k}><dt className="text-xs text-muted-foreground">{k}</dt><dd className="truncate text-foreground">{v}</dd></div>
            ))}
          </dl>
          {!staffSignatureEligible(profile.real_role) && <div>
            <p className="text-xs text-muted-foreground">Signature on file</p>
            {profile.signature_on_file ? <img src={profile.signature_on_file} alt="Signature on file" className="mt-1 h-20 rounded border bg-background" /> : <p className="text-sm text-foreground">None</p>}
          </div>}
        </aside>
      </div>
    </AppShell>
  );
}
