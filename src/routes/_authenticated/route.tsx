import { useEffect, useState } from "react";
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { registerPush } from "@/lib/web-push";
import { OFFER_INSTALL_KEY } from "@/lib/install-app";
import { InstallAppCard } from "@/components/install-app";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { StaffSignatureOnboarding } from "@/components/staff-signature";

export const Route = createFileRoute("/_authenticated")({ staticData: { sitemap: "exclude-subtree" },
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
  },
  component: AuthedLayout,
});

function AuthedLayout() {
  const [offer, setOffer] = useState(false);
  useEffect(() => {
    // Keep this device's lock-screen alerts registered on every launch.
    void registerPush();
    if (sessionStorage.getItem(OFFER_INSTALL_KEY)) { sessionStorage.removeItem(OFFER_INSTALL_KEY); setOffer(true); }
  }, []);
  return (
    <>
      <Outlet />
      <StaffSignatureOnboarding />
      <Dialog open={offer} onOpenChange={setOffer}>
        <DialogContent>
          <DialogHeader><DialogTitle>You're in — welcome to FieldBridge</DialogTitle></DialogHeader>
          <InstallAppCard force />
          <Button variant="ghost" className="h-11" onClick={() => setOffer(false)}>Continue in browser</Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
