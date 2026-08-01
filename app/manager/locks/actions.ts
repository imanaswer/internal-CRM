"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireManager } from "@/lib/session";
import { lockSchema, type LockInput } from "@/lib/validation";
import { parseISODate } from "@/lib/dates";

export async function lockPeriod(input: LockInput) {
  const mgr = await requireManager();
  const parsed = lockSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0].message };
  const v = parsed.data;

  try {
    await prisma.periodLock.create({
      data: {
        startDate: parseISODate(v.startDate),
        endDate: parseISODate(v.endDate),
        label: v.label || null,
        reason: v.reason || null,
        lockedById: mgr.id,
      },
    });
    revalidatePath("/manager");
    return { ok: true as const };
  } catch (e) {
    return { ok: false as const, error: (e as Error).message };
  }
}

// yyyyMm like "2026-10"
export async function lockMonth(yyyyMm: string, reason?: string) {
  if (!/^\d{4}-\d{2}$/.test(yyyyMm)) return { ok: false as const, error: "Invalid month" };

  const [y, m] = yyyyMm.split("-").map(Number);
  const start = `${yyyyMm}-01`;
  const end = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10); // last day of month
  const label = new Date(Date.UTC(y, m - 1, 1)).toLocaleString("en-US", {
    month: "long", year: "numeric", timeZone: "UTC",
  });
  return lockPeriod({ startDate: start, endDate: end, label, reason });
}

export async function removeLock(id: string) {
  await requireManager();

  try {
    await prisma.periodLock.delete({ where: { id } });
    revalidatePath("/manager");
    return { ok: true as const };
  } catch (e) {
    return { ok: false as const, error: (e as Error).message };
  }
}
