import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { JobPhotos } from "@/components/job-photos";
import { SignaturePad } from "@/components/signature-pad";
import { PhotoPdfScanner } from "@/components/photo-pdf-scanner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { JobPhoto } from "@/lib/jobsheets";

// TEMPORARY test harness — removed after verification.
export const Route = createFileRoute("/media-check")({ component: Page });

function Page() {
  const [photos, setPhotos] = useState<JobPhoto[]>([]);
  const [sig, setSig] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  return (
    <div className="p-4 space-y-6">
      <fieldset disabled={false} className="space-y-4">
        <JobPhotos companyId="c" sheetId="s" photos={photos} scope="work" day={0} onChange={setPhotos} />
        <p data-testid="count">photos:{photos.length}</p>
        <Button type="button" onClick={() => setOpen(true)}>Open sign</Button>
      </fieldset>
      <PhotoPdfScanner onAttach={async () => {}} />
      <p data-testid="sig">sig:{sig ? sig.length : 0}</p>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent onPointerDownOutside={(e) => e.preventDefault()} className="h-[100dvh] max-h-[100dvh] w-screen max-w-none overflow-y-auto rounded-none sm:h-auto sm:max-h-[95vh] sm:max-w-3xl sm:rounded-lg">
          <DialogHeader><DialogTitle>Sign</DialogTitle></DialogHeader>
          <div className="space-y-4 text-sm"><div className="h-64 bg-muted">filler</div>
            <SignaturePad value={sig} onChange={setSig} />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
