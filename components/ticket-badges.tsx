import { cn } from "@/lib/utils";

export const TICKET_SOURCES = ["PHONE", "WHATSAPP", "EMAIL", "WALK_IN", "OTHER"] as const;
export const TICKET_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;
export const TICKET_STATUSES = ["OPEN", "TAKEN_UP", "SOLVED", "DUPLICATE"] as const;
export type TicketSource = (typeof TICKET_SOURCES)[number];
export type TicketPriority = (typeof TICKET_PRIORITIES)[number];
export type TicketStatus = (typeof TICKET_STATUSES)[number];

export const label = (s: string) => s.replace("_", " ");

const base = "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset";

const STATUS: Record<TicketStatus, string> = {
  OPEN: "bg-rose-50 text-rose-800 ring-rose-600/20",
  TAKEN_UP: "bg-sky-50 text-sky-800 ring-sky-600/20",
  SOLVED: "bg-emerald-50 text-emerald-800 ring-emerald-600/20",
  DUPLICATE: "bg-slate-100 text-slate-600 ring-slate-500/20",
};
const PRIORITY: Record<TicketPriority, string> = {
  LOW: "bg-slate-100 text-slate-600 ring-slate-500/20",
  MEDIUM: "bg-sky-50 text-sky-800 ring-sky-600/20",
  HIGH: "bg-amber-50 text-amber-800 ring-amber-600/25",
  URGENT: "bg-rose-50 text-rose-800 ring-rose-600/20",
};

export const TicketStatusBadge = ({ status }: { status: TicketStatus }) => (
  <span className={cn(base, STATUS[status])}>{label(status)}</span>
);
export const TicketPriorityBadge = ({ priority }: { priority: TicketPriority }) => (
  <span className={cn(base, PRIORITY[priority])}>{label(priority)}</span>
);
export const TicketSourceBadge = ({ source }: { source: TicketSource }) => (
  <span className={cn(base, "bg-secondary text-secondary-foreground ring-border")}>{label(source)}</span>
);
