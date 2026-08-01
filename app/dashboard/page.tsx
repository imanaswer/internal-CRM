import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/db";
import { todayISO, dateToISO, parseISODate } from "@/lib/dates";
import { Nav } from "@/components/nav";
import { AddActivityDialog } from "@/components/add-activity-dialog";
import { Badge } from "@/components/ui/badge";
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
    status: r.status,
    deadline: r.deadline ? dateToISO(r.deadline) : null,
    timeTaken: Number(r.timeTaken),
  };
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

  return (
    <div className="flex flex-col">
      <Nav />
      <main className="flex flex-col gap-6 p-6">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">Dashboard</h1>
          <AddActivityDialog maxDate={maxDate} />
        </div>

        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-medium text-muted-foreground">Today&apos;s Entries</h2>
          {todayRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No activities yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Activity</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Time Taken</TableHead>
                  <TableHead>Deadline</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {todayRows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{r.activity}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{r.status.replace("_", " ")}</Badge>
                    </TableCell>
                    <TableCell>{r.timeTaken}</TableCell>
                    <TableCell>{r.deadline ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-medium text-muted-foreground">Recent Activities</h2>
          {recentRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No activities yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Activity</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Time Taken</TableHead>
                  <TableHead>Deadline</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentRows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{r.date}</TableCell>
                    <TableCell>{r.activity}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{r.status.replace("_", " ")}</Badge>
                    </TableCell>
                    <TableCell>{r.timeTaken}</TableCell>
                    <TableCell>{r.deadline ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </section>
      </main>
    </div>
  );
}
