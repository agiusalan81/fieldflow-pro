import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export function MemberAccessBoundary({ children }: { children: React.ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const qc = useQueryClient();
  const publicPage = pathname === "/auth" || pathname === "/" || pathname === "/reset-password" || /^(\/join\/|\/report\/|\/referral\/)/.test(pathname);
  const status = useQuery({
    queryKey: ["my-registration-status"], enabled: !publicPage, refetchInterval: 15_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("my_registration_status");
      if (error) throw error;
      return data;
    },
  });
  if (!publicPage && status.data === "terminated") return <main className="grid min-h-screen place-items-center bg-background p-6"><div className="max-w-md space-y-4"><h1 className="text-2xl font-semibold">Company access revoked</h1><p className="text-muted-foreground">Contact your office if you believe this is a mistake.</p><Button onClick={async () => { qc.clear(); await supabase.auth.signOut(); }}>Sign out</Button></div></main>;
  return children;
}