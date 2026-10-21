import { useState } from "react";
import { Download, Share, PlusSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useInstallApp } from "@/lib/install-app";

/** Install FieldBridge on a phone/tablet. Hidden on desktop and inside the installed app. */
export function InstallAppCard({ compact = false, force = false }: { compact?: boolean; force?: boolean }) {
  const a = useInstallApp();
  const [guide, setGuide] = useState(false);
  if (a.installed || (!a.show && !force)) return null;
  const onTap = async () => { if (a.canPrompt) await a.install(); else setGuide(true); };
  return (
    <div className="rounded-xl border bg-card p-4 text-card-foreground">
      <div className="flex items-start gap-3">
        <Download className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
        <div className="min-w-0 flex-1">
          <p className="font-medium">{compact ? "Using a phone or tablet?" : "Get FieldBridge on your device"}</p>
          <p className="mt-1 text-sm text-muted-foreground">Install FieldBridge on your home screen for faster daily access and lock-screen chat alerts.</p>
          <Button className="mt-3 h-11" onClick={onTap}><Download className="mr-1 h-4 w-4" />Install app</Button>
        </div>
      </div>
      {(guide || (a.ios && !compact)) && (
        <ol className="mt-4 space-y-2 border-t pt-3 text-sm text-muted-foreground">
          {a.ios ? (
            <>
              <li className="flex items-center gap-2">1. Tap <Share className="h-4 w-4" /> Share in Safari</li>
              <li className="flex items-center gap-2">2. Choose <PlusSquare className="h-4 w-4" /> Add to Home Screen</li>
              <li>3. Tap Add, then open FieldBridge from your home screen</li>
            </>
          ) : (
            <>
              <li>1. Open the browser menu (⋮)</li>
              <li>2. Tap Install app or Add to Home screen</li>
              <li>3. Open FieldBridge from your home screen</li>
            </>
          )}
        </ol>
      )}
    </div>
  );
}
