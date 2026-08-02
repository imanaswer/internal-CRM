"use server";
import { revalidatePath } from "next/cache";
import { safeErrorMessage } from "@/lib/errors";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { activitySchema, type ActivityInput } from "@/lib/validation";
import { isLocked } from "@/lib/period-lock";
import { parseISODate } from "@/lib/dates";

async function assertWritable(user: { id: string; role: string }, dateISO: string) {
  if (user.role === "MANAGER") return; // managers bypass locks
  const locks = await prisma.periodLock.findMany({ select: { startDate: true, endDate: true } });
  if (isLocked(dateISO, locks)) throw new Error("This reporting period is locked.");
}

export async function createActivity(input: ActivityInput) {
  const user = await requireUser();
  const parsed = activitySchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0].message };
  const v = parsed.data;
  try {
    await assertWritable(user, v.date);
    const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
    await prisma.activity.create({
      data: {
        userId: user.id,
        employeeName: user.name,
        designation: dbUser?.designation ?? "",
        date: parseISODate(v.date),
        activity: v.activity,
        description: v.description || null,
        assignedBy: v.assignedBy,
        status: v.status,
        deadline: v.deadline ? parseISODate(v.deadline) : null,
        timeTaken: v.timeTaken,
      },
    });
    revalidatePath("/dashboard");
    revalidatePath("/activities");
    revalidatePath("/manager");
    return { ok: true as const };
  } catch (e) {
    return { ok: false as const, error: safeErrorMessage(e) };
  }
}

export async function updateActivity(id: string, input: ActivityInput) {
  const user = await requireUser();
  const parsed = activitySchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0].message };
  const v = parsed.data;
  try {
    const existing = await prisma.activity.findUnique({ where: { id } });
    if (!existing) return { ok: false as const, error: "Not found" };
    if (user.role !== "MANAGER" && existing.userId !== user.id)
      return { ok: false as const, error: "Forbidden" };
    await assertWritable(user, existing.date.toISOString().slice(0, 10)); // current period
    await assertWritable(user, v.date); // target period
    await prisma.activity.update({
      where: { id },
      data: {
        date: parseISODate(v.date),
        activity: v.activity,
        description: v.description || null,
        assignedBy: v.assignedBy,
        status: v.status,
        deadline: v.deadline ? parseISODate(v.deadline) : null,
        timeTaken: v.timeTaken,
      },
    });
    revalidatePath("/dashboard");
    revalidatePath("/activities");
    revalidatePath("/manager");
    return { ok: true as const };
  } catch (e) {
    return { ok: false as const, error: safeErrorMessage(e) };
  }
}

export async function deleteActivity(id: string) {
  const user = await requireUser();
  try {
    const existing = await prisma.activity.findUnique({ where: { id } });
    if (!existing) return { ok: false as const, error: "Not found" };
    if (user.role !== "MANAGER" && existing.userId !== user.id)
      return { ok: false as const, error: "Forbidden" };
    await assertWritable(user, existing.date.toISOString().slice(0, 10));
    await prisma.activity.delete({ where: { id } });
    revalidatePath("/dashboard");
    revalidatePath("/activities");
    revalidatePath("/manager");
    return { ok: true as const };
  } catch (e) {
    return { ok: false as const, error: safeErrorMessage(e) };
  }
}
