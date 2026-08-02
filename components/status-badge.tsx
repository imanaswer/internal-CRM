import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";

export const STATUSES = ["PENDING", "IN_PROGRESS", "COMPLETED", "ON_HOLD"] as const;
export type ActivityStatus = (typeof STATUSES)[number];

export function statusLabel(status: ActivityStatus): string {
  return status.replace("_", " ");
}

const STATUS_STYLES: Record<ActivityStatus, string> = {
  COMPLETED: "bg-emerald-50 text-emerald-800 ring-emerald-600/20",
  IN_PROGRESS: "bg-sky-50 text-sky-800 ring-sky-600/20",
  PENDING: "bg-amber-50 text-amber-800 ring-amber-600/25",
  ON_HOLD: "bg-slate-100 text-slate-600 ring-slate-500/20",
};

export function StatusBadge({ status, className }: { status: ActivityStatus; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset",
        STATUS_STYLES[status],
        className
      )}
    >
      {statusLabel(status)}
    </span>
  );
}

export function LockedBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 ring-1 ring-slate-500/20 ring-inset",
        className
      )}
    >
      <Lock className="size-3" aria-hidden />
      Locked
    </span>
  );
}
