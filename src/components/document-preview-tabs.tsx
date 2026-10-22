import { useState } from "react";
import { Eye } from "lucide-react";
import type { PdfTemplate } from "@/lib/documents";
import { DocumentPreview } from "@/components/document-preview";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetClose, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

type PreviewProps = { template: PdfTemplate; logo?: string | undefined };

export function DocumentPreviewTabs({ template, logo, className }: PreviewProps & { className?: string }) {
  return <Tabs defaultValue="paper" className={className}>
    <TabsList className="grid h-11 w-full shrink-0 grid-cols-2">
      <TabsTrigger value="paper" className="h-full px-1 text-xs sm:text-sm">Client document</TabsTrigger>
      <TabsTrigger value="form" className="h-full px-1 text-xs sm:text-sm">Field entry form</TabsTrigger>
    </TabsList>
    <TabsContent value="paper" className="min-h-0 overflow-y-auto overscroll-contain"><DocumentPreview template={template} logo={logo} /></TabsContent>
    <TabsContent value="form" className="min-h-0 overflow-y-auto overscroll-contain"><DocumentPreview template={template} logo={logo} mode="form" /></TabsContent>
  </Tabs>;
}

export function MobileDocumentPreview(props: PreviewProps) {
  const [open, setOpen] = useState(false);
  return <>
    <Button type="button" className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-4 z-40 h-11 shadow-lg lg:hidden" onClick={() => setOpen(true)}><Eye className="mr-2 h-4 w-4" />View live preview</Button>
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent side="bottom" aria-describedby={undefined} className="flex h-[100dvh] flex-col gap-3 p-3 pt-5 [&>button]:hidden">
        <SheetHeader className="flex-row items-center justify-between space-y-0 text-left">
          <SheetTitle>Live preview</SheetTitle>
          <SheetClose asChild><Button type="button" variant="outline" className="h-11">Close</Button></SheetClose>
        </SheetHeader>
        <DocumentPreviewTabs {...props} className="flex min-h-0 flex-1 flex-col pb-[env(safe-area-inset-bottom)]" />
      </SheetContent>
    </Sheet>
  </>;
}