"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireTech } from "@/lib/session";
import { ticketSchema, solveSchema, type TicketInput } from "@/lib/validation";
import { safeErrorMessage } from "@/lib/errors";

type Result = { ok: true } | { ok: false; error: string };

export async function createTicket(input: TicketInput): Promise<Result> {
  const user = await requireTech();
  const parsed = ticketSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const v = parsed.data;
  try {
    await prisma.ticket.create({
      data: {
        title: v.title,
        description: v.description || null,
        contactName: v.contactName,
        contactPhone: v.contactPhone,
        branch: v.branch || null,
        source: v.source,
        ipAddress: v.ipAddress || null,
        assetId: v.assetId || null,
        priority: v.priority,
        createdById: user.id,
      },
    });
    revalidatePath("/tickets");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: safeErrorMessage(e) };
  }
}

async function transition(
  id: string,
  allowedFrom: ("OPEN" | "TAKEN_UP" | "SOLVED" | "DUPLICATE")[],
  data: Record<string, unknown>
): Promise<Result> {
  try {
    const existing = await prisma.ticket.findUnique({ where: { id } });
    if (!existing) return { ok: false, error: "Ticket not found" };
    if (!allowedFrom.includes(existing.status))
      return { ok: false, error: `Not allowed from status ${existing.status}` };
    await prisma.ticket.update({ where: { id }, data });
    revalidatePath("/tickets");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: safeErrorMessage(e) };
  }
}

export async function takeUpTicket(id: string): Promise<Result> {
  const user = await requireTech();
  return transition(id, ["OPEN"], {
    status: "TAKEN_UP",
    takenById: user.id,
    takenAt: new Date(),
  });
}

export async function solveTicket(id: string, note: string): Promise<Result> {
  const user = await requireTech();
  const parsed = solveSchema.safeParse({ note });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  return transition(id, ["OPEN", "TAKEN_UP"], {
    status: "SOLVED",
    solvedById: user.id,
    solvedAt: new Date(),
    resolutionNote: parsed.data.note,
  });
}

export async function markDuplicate(id: string): Promise<Result> {
  await requireTech();
  return transition(id, ["OPEN", "TAKEN_UP"], { status: "DUPLICATE" });
}

export async function reopenTicket(id: string): Promise<Result> {
  await requireTech();
  return transition(id, ["SOLVED", "DUPLICATE"], {
    status: "OPEN",
    takenById: null,
    takenAt: null,
    solvedById: null,
    solvedAt: null,
    resolutionNote: null,
  });
}

export async function deleteTicket(id: string): Promise<Result> {
  const user = await requireTech();
  if (user.role !== "MANAGER") return { ok: false, error: "Only managers can delete tickets" };
  try {
    await prisma.ticket.delete({ where: { id } });
    revalidatePath("/tickets");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: safeErrorMessage(e) };
  }
}
