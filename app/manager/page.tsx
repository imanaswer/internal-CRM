import { redirect } from "next/navigation";
import type { Status } from "@prisma/client";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/db";
import { buildActivityWhere, type ActivityFilters } from "@/lib/activity-query";
import { dateToISO, parseISODate, todayISO } from "@/lib/dates";
import { Nav } from "@/components/nav";
import { ActivityFilters as ActivityFiltersBar } from "@/components/activity-filters";
import { ManagerActivityTable } from "@/components/manager-activity-table";
import { LockPanel } from "@/components/lock-panel";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

const STATUSES: Status[] = ["PENDING", "IN_PROGRESS", "COMPLETED", "ON_HOLD"];

export default async function ManagerPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/signin");
  if (user.role !== "MANAGER") redirect("/dashboard");

  const sp = await searchParams;
  const statusParam = sp.status as string | undefined;
  const filters: ActivityFilters = {
    employeeName: sp.employeeName as string | undefined,
    designation: sp.designation as string | undefined,
    status: statusParam && STATUSES.includes(statusParam as Status) ? (statusParam as Status) : undefined,
    assignedBy: sp.assignedBy as string | undefined,
    dateFrom: sp.dateFrom as string | undefined,
    dateTo: sp.dateTo as string | undefined,
    search: sp.search as string | undefined,
  };

  const [total, completed, pending, submittedToday, activities, locks] = await Promise.all([
    prisma.activity.count({ where: buildActivityWhere(filters) }),
    prisma.activity.count({ where: buildActivityWhere({ ...filters, status: "COMPLETED" }) }),
    prisma.activity.count({ where: buildActivityWhere({ ...filters, status: "PENDING" }) }),
    prisma.activity.findMany({
      where: { date: parseISODate(todayISO()) },
      select: { userId: true },
      distinct: ["userId"],
    }),
    prisma.activity.findMany({ where: buildActivityWhere(filters), orderBy: { date: "desc" } }),
    prisma.periodLock.findMany({
      include: { lockedBy: { select: { name: true } } },
      orderBy: { lockedAt: "desc" },
    }),
  ]);

  const rows = activities.map((a) => ({
    id: a.id,
    date: a.date ? dateToISO(a.date) : null,
    employeeName: a.employeeName,
    designation: a.designation,
    activity: a.activity,
    status: a.status,
    assignedBy: a.assignedBy,
    timeTaken: Number(a.timeTaken),
    deadline: a.deadline ? dateToISO(a.deadline) : null,
  }));

  const serializedLocks = locks.map((l) => ({
    id: l.id,
    label: l.label,
    startDate: dateToISO(l.startDate),
    endDate: dateToISO(l.endDate),
    reason: l.reason,
    lockedByName: l.lockedBy.name,
    lockedAt: l.lockedAt.toISOString(),
  }));

  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value) qs.set(key, value);
  }
  const exportHref = "/api/export" + (qs.size ? `?${qs.toString()}` : "");

  return (
    <div>
      <Nav />
      <main className="space-y-6 p-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Manager Dashboard</h1>
          <a href={exportHref} className={buttonVariants({ variant: "default" })}>
            Export
          </a>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm text-muted-foreground">Total</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">{total}</CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm text-muted-foreground">Completed</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">{completed}</CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm text-muted-foreground">Pending</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">{pending}</CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm text-muted-foreground">Employees Submitted Today</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">{submittedToday.length}</CardContent>
          </Card>
        </div>

        <ActivityFiltersBar key={qs.toString() || "empty"} />

        <ManagerActivityTable rows={rows} />

        <div>
          <h2 className="mb-3 text-lg font-semibold">Period Locks</h2>
          <LockPanel locks={serializedLocks} />
        </div>
      </main>
    </div>
  );
}
