import { useState } from "react";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
export function SocialSignin({ onSuccess, onError, inviteToken }: { onSuccess: () => void | Promise<void>; onError: (message: string) => void; inviteToken?: string }) {
  const [busy,setBusy] = useState<string | null>(null);
  const signIn = async (provider: "google" | "microsoft") => {
    setBusy(provider);
    try {
      if (inviteToken) sessionStorage.setItem("fieldflow:pending-invite",inviteToken);
      const result = await lovable.auth.signInWithOAuth(provider,{redirect_uri: inviteToken ? `${window.location.origin}/join/${encodeURIComponent(inviteToken)}` : `${window.location.origin}/auth`});
      if (result.error) { onError(result.error.message); return; }
      if (result.redirected) return;
      await onSuccess();
    } catch(e) { onError(e instanceof Error?e.message:"Could not sign in. Please try again."); }
    finally { setBusy(null); }
  };
  return <div className="grid gap-2">
    <Button type="button" variant="outline" className="h-11 w-full" disabled={busy!==null} onClick={()=>signIn("google")}>{busy==="google"?"Connecting…":"Continue with Google"}</Button>
    <Button type="button" variant="outline" className="h-11 w-full" disabled aria-disabled="true" title="Microsoft sign-in is coming soon">Continue with Microsoft — Coming soon</Button>
  </div>;
}