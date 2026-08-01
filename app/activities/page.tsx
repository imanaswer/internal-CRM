import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/db";
import { todayISO, dateToISO } from "@/lib/dates";
import { isLocked } from "@/lib/period-lock";
import { Nav } from "@/components/nav";
import { ActivityHistory } from "@/components/activity-history";

export default async function ActivitiesPage() {
  const user = await requireUser();

  const [activities, locks] = await Promise.all([
    prisma.activity.findMany({ where: { userId: user.id }, orderBy: { date: "desc" } }),
    prisma.periodLock.findMany({ select: { startDate: true, endDate: true } }),
  ]);

  const rows = activities.map((r) => {
    const date = dateToISO(r.date);
    return {
      id: r.id,
      date,
      activity: r.activity,
      description: r.description,
      assignedBy: r.assignedBy,
      status: r.status,
      deadline: r.deadline ? dateToISO(r.deadline) : null,
      timeTaken: Number(r.timeTaken),
      locked: isLocked(date, locks),
    };
  });

  return (
    <div className="flex flex-col">
      <Nav />
      <main className="flex flex-col gap-6 p-6">
        <h1 className="text-xl font-semibold">My Activities</h1>
        <ActivityHistory rows={rows} maxDate={todayISO()} />
      </main>
    </div>
  );
}
