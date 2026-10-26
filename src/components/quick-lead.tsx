import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NewLeadDialog } from "@/components/crm-pipeline";

/** Header shortcut for anyone with CRM contributor access: log a lead from any screen. */
export function QuickLeadButton({ company }: { company?: string | undefined }) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  return <>
    <Button data-tour="quick-lead" size="sm" variant="outline" onClick={() => setOpen(true)} aria-label="New lead">
      <UserPlus className="h-4 w-4 sm:mr-1" /><span className="hidden sm:inline">New lead</span>
    </Button>
    {open && <NewLeadDialog open={open} onOpenChange={setOpen} company={company} onCreated={(id) => void navigate({ to: "/crm", search: { lead: id } })} />}
  </>;
}
