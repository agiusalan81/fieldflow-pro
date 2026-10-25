import { Link } from "@tanstack/react-router";
import { ClipboardCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useApprovalCounts, type ApprovalCategory } from "@/lib/approval-counts";

const LABELS: Record<ApprovalCategory, string> = { leave: "Leave", expenses: "Expense categories", equipment: "Equipment & assets" };

/** Sticky manager banner: stays while any approval queue has items; no dismiss by design. */
export function ApprovalsBanner() {
  const { allowed, counts, total } = useApprovalCounts();
  if (!allowed || total === 0) return null;
  const first = (Object.keys(LABELS) as ApprovalCategory[]).find((k) => counts[k] > 0) ?? "leave";
  return (
    <section aria-label="Pending approvals" className="sticky top-0 z-20 flex flex-wrap items-center gap-3 rounded-xl border-2 border-warning bg-card p-4 shadow-sm">
      <ClipboardCheck className="h-5 w-5 shrink-0 text-warning" />
      <div className="min-w-0 flex-1">
        <p className="font-medium text-foreground">{total} {total === 1 ? "approval" : "approvals"} waiting for review</p>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {(Object.keys(LABELS) as ApprovalCategory[]).filter((k) => counts[k] > 0).map((k) => (
            <Link key={k} to="/admin/approvals" search={{ category: k }} className="rounded-full bg-warning/15 px-2 py-0.5 text-xs font-medium text-foreground hover:bg-warning/25">{LABELS[k]} · {counts[k]}</Link>
          ))}
        </div>
      </div>
      <Button asChild size="sm"><Link to="/admin/approvals" search={{ category: first }}>Review approvals</Link></Button>
    </section>
  );
}
