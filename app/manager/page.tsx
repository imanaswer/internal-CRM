import { redirect } from "next/navigation";
import { Download } from "lucide-react";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/db";
import { buildActivityWhere, parseActivityFilters } from "@/lib/activity-query";
import { dateToISO, parseISODate, todayISO } from "@/lib/dates";
import { Nav } from "@/components/nav";
import { ActivityFilters as ActivityFiltersBar } from "@/components/activity-filters";
import { ManagerActivityTable } from "@/components/manager-activity-table";
import { LockPanel } from "@/components/lock-panel";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

export default async function ManagerPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/signin");
  if (user.role !== "MANAGER") redirect("/dashboard");

  const filters = parseActivityFilters(await searchParams);

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

  const stats = [
    { label: "Total activities", value: total, valueClass: "" },
    { label: "Completed", value: completed, valueClass: "text-emerald-700" },
    { label: "Pending", value: pending, valueClass: "text-amber-700" },
    { label: "Employees submitted today", value: submittedToday.length, valueClass: "text-primary" },
  ];

  return (
    <div className="flex min-h-svh flex-col">
      <Nav />
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-4 sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Manager Dashboard</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              All employee activity — filter, export, and lock reporting periods.
            </p>
          </div>
          <a href={exportHref} className={buttonVariants({ variant: "default" })}>
            <Download className="size-4" aria-hidden />
            Export to Excel
          </a>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((s) => (
            <Card key={s.label} className="gap-1 py-4">
              <CardHeader className="pb-0">
                <CardTitle className="text-[13px] font-medium text-muted-foreground">
                  {s.label}
                </CardTitle>
              </CardHeader>
              <CardContent className={`text-3xl font-semibold tabular-nums ${s.valueClass}`}>
                {s.value}
              </CardContent>
            </Card>
          ))}
        </div>

        <section className="flex flex-col gap-3">
          <ActivityFiltersBar key={qs.toString() || "empty"} />
          <ManagerActivityTable rows={rows} />
        </section>

        <section>
          <h2 className="mb-1 text-lg font-semibold tracking-tight">Period Locks</h2>
          <p className="mb-3 text-sm text-muted-foreground">
            Lock a month or date range after review — employees can no longer change entries in it.
          </p>
          <LockPanel locks={serializedLocks} />
        </section>
      </main>
    </div>
  );
}
