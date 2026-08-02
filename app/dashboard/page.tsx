import { CalendarDays, ClipboardList } from "lucide-react";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/db";
import { todayISO, dateToISO, parseISODate } from "@/lib/dates";
import { Nav } from "@/components/nav";
import { AddActivityDialog } from "@/components/add-activity-dialog";
import { StatusBadge, type ActivityStatus } from "@/components/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";

function serialize(r: {
  id: string;
  date: Date;
  activity: string;
  status: string;
  deadline: Date | null;
  timeTaken: unknown;
}) {
  return {
    id: r.id,
    date: dateToISO(r.date),
    activity: r.activity,
    status: r.status as ActivityStatus,
    deadline: r.deadline ? dateToISO(r.deadline) : null,
    timeTaken: Number(r.timeTaken),
  };
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center gap-2 py-10 text-center">
      <ClipboardList className="size-8 text-muted-foreground/50" aria-hidden />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

export default async function DashboardPage() {
  const user = await requireUser();
  const maxDate = todayISO();

  const [today, recent] = await Promise.all([
    prisma.activity.findMany({ where: { userId: user.id, date: parseISODate(maxDate) } }),
    prisma.activity.findMany({
      where: { userId: user.id },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: 10,
    }),
  ]);

  const todayRows = today.map(serialize);
  const recentRows = recent.map(serialize);
  const todayLong = new Date(`${maxDate}T00:00:00`).toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="flex min-h-svh flex-col">
      <Nav />
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-4 sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
            <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted-foreground">
              <CalendarDays className="size-3.5" aria-hidden />
              {todayLong}
            </p>
          </div>
          <AddActivityDialog maxDate={maxDate} />
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Today&apos;s Entries</CardTitle>
          </CardHeader>
          <CardContent>
            {todayRows.length === 0 ? (
              <EmptyState message="Nothing logged today yet — add your first activity." />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Activity</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Time (hrs)</TableHead>
                    <TableHead>Deadline</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {todayRows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.activity}</TableCell>
                      <TableCell>
                        <StatusBadge status={r.status} />
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{r.timeTaken}</TableCell>
                      <TableCell className="text-muted-foreground">{r.deadline ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Activities</CardTitle>
          </CardHeader>
          <CardContent>
            {recentRows.length === 0 ? (
              <EmptyState message="Your submitted activities will appear here." />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Activity</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Time (hrs)</TableHead>
                    <TableHead>Deadline</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentRows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="text-muted-foreground tabular-nums">{r.date}</TableCell>
                      <TableCell className="font-medium">{r.activity}</TableCell>
                      <TableCell>
                        <StatusBadge status={r.status} />
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{r.timeTaken}</TableCell>
                      <TableCell className="text-muted-foreground">{r.deadline ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
