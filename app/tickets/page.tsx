import { redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/db";
import { todayISO } from "@/lib/dates";
import {
  TICKET_STATUSES,
  TICKET_PRIORITIES,
  TICKET_CATEGORIES,
  label as fmtLabel,
  type TicketStatus,
  type TicketPriority,
  type TicketCategory,
} from "@/components/ticket-badges";
import { Nav } from "@/components/nav";
import { NewTicketDialog } from "@/components/new-ticket-dialog";
import { TicketsTable, type TicketRow } from "@/components/tickets-table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

const STATUS_ORDER: Record<TicketStatus, number> = { OPEN: 0, TAKEN_UP: 1, FORWARDED: 2, SOLVED: 3, DUPLICATE: 4 };
const PRIORITY_ORDER: Record<TicketPriority, number> = { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

// Native select styled to match the shadcn Input for a consistent filter bar.
const selectClass =
  "h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

export default async function TicketsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/signin");
  if (!user.tech) redirect("/");

  const params = await searchParams;
  const get = (key: string): string | undefined => {
    const v = params[key];
    return typeof v === "string" && v ? v : undefined;
  };

  const statusParam = get("status");
  const priorityParam = get("priority");
  const status = statusParam && TICKET_STATUSES.includes(statusParam as TicketStatus) ? (statusParam as TicketStatus) : undefined;
  const priority =
    priorityParam && TICKET_PRIORITIES.includes(priorityParam as TicketPriority) ? (priorityParam as TicketPriority) : undefined;
  const categoryParam = get("category");
  const category =
    categoryParam && TICKET_CATEGORIES.includes(categoryParam as TicketCategory) ? (categoryParam as TicketCategory) : undefined;
  const q = get("q");

  const baseWhere: Prisma.TicketWhereInput = {};
  if (priority) baseWhere.priority = priority;
  if (category) baseWhere.category = category;
  if (q) {
    baseWhere.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { contactName: { contains: q, mode: "insensitive" } },
      { contactPhone: { contains: q, mode: "insensitive" } },
      { assetId: { contains: q, mode: "insensitive" } },
      { ipAddress: { contains: q, mode: "insensitive" } },
    ];
  }
  const where: Prisma.TicketWhereInput = status ? { ...baseWhere, status } : baseWhere;

  const [tickets, openCount, takenUpCount, solvedTodayCount] = await Promise.all([
    prisma.ticket.findMany({
      where,
      include: {
        takenBy: { select: { name: true } },
        solvedBy: { select: { name: true } },
        createdBy: { select: { name: true } },
      },
    }),
    prisma.ticket.count({ where: { ...baseWhere, status: "OPEN" } }),
    prisma.ticket.count({ where: { ...baseWhere, status: "TAKEN_UP" } }),
    // solvedAt is a real timestamp, so anchor to the true start of the IST day
    // (parseISODate would give UTC midnight — 5.5h late).
    prisma.ticket.count({
      where: { ...baseWhere, status: "SOLVED", solvedAt: { gte: new Date(`${todayISO()}T00:00:00+05:30`) } },
    }),
  ]);

  // ponytail: in-memory sort, move to SQL ordering if ticket volume grows
  tickets.sort((a, b) => {
    const s = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
    if (s !== 0) return s;
    const p = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
    if (p !== 0) return p;
    return b.createdAt.getTime() - a.createdAt.getTime();
  });

  const rows: TicketRow[] = tickets.map((t) => ({
    id: t.id,
    num: t.num,
    title: t.title,
    description: t.description,
    contactName: t.contactName,
    contactPhone: t.contactPhone,
    branch: t.branch,
    source: t.source,
    ipAddress: t.ipAddress,
    assetId: t.assetId,
    priority: t.priority,
    category: t.category,
    status: t.status,
    forwardedTo: t.forwardedTo,
    takenByName: t.takenBy?.name ?? null,
    takenAt: t.takenAt ? t.takenAt.toISOString() : null,
    solvedByName: t.solvedBy?.name ?? null,
    solvedAt: t.solvedAt ? t.solvedAt.toISOString() : null,
    resolutionNote: t.resolutionNote,
    createdAt: t.createdAt.toISOString(),
    createdByName: t.createdBy.name,
  }));

  const stats = [
    { label: "Open", value: openCount, valueClass: "text-rose-700" },
    { label: "Taken Up", value: takenUpCount, valueClass: "text-sky-700" },
    { label: "Solved Today", value: solvedTodayCount, valueClass: "text-emerald-700" },
    { label: "Total", value: rows.length, valueClass: "" },
  ];

  return (
    <div className="flex min-h-svh flex-col">
      <Nav />
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-4 sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Tickets</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Tech team complaint tracker — one list, no duplicates.
            </p>
          </div>
          <NewTicketDialog />
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((s) => (
            <Card key={s.label} className="gap-1 py-4">
              <CardHeader className="pb-0">
                <CardTitle className="text-[13px] font-medium text-muted-foreground">{s.label}</CardTitle>
              </CardHeader>
              <CardContent className={`text-3xl font-semibold tabular-nums ${s.valueClass}`}>{s.value}</CardContent>
            </Card>
          ))}
        </div>

        <form method="GET" className="flex flex-wrap items-end gap-3 rounded-xl border bg-card p-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="filter-status" className="text-sm font-medium">
              Status
            </label>
            <select id="filter-status" name="status" defaultValue={status ?? ""} className={selectClass}>
              <option value="">All</option>
              {TICKET_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {fmtLabel(s)}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="filter-priority" className="text-sm font-medium">
              Priority
            </label>
            <select id="filter-priority" name="priority" defaultValue={priority ?? ""} className={selectClass}>
              <option value="">All</option>
              {TICKET_PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {fmtLabel(p)}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="filter-category" className="text-sm font-medium">
              Category
            </label>
            <select id="filter-category" name="category" defaultValue={category ?? ""} className={selectClass}>
              <option value="">All</option>
              {TICKET_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {fmtLabel(c)}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="q" className="text-sm font-medium">
              Search
            </label>
            <Input id="q" name="q" defaultValue={q ?? ""} className="w-48" placeholder="Name, phone, title..." />
          </div>
          <div className="flex gap-2">
            <Button type="submit">Apply</Button>
            <a href="/tickets" className="text-sm text-muted-foreground underline-offset-4 hover:underline self-center">
              Clear
            </a>
          </div>
        </form>

        <TicketsTable rows={rows} isManager={user.role === "MANAGER"} />
      </main>
    </div>
  );
}
