"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireTech } from "@/lib/session";
import { ticketSchema, solveSchema, forwardSchema, type TicketInput } from "@/lib/validation";
import { safeErrorMessage } from "@/lib/errors";
import { titlesSimilar } from "@/lib/duration";

type Result = { ok: true } | { ok: false; error: string };

export async function createTicket(
  input: TicketInput
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const user = await requireTech();
  const parsed = ticketSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const v = parsed.data;
  try {
    const created = await prisma.ticket.create({
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
        category: v.category,
        createdById: user.id,
      },
      select: { id: true },
    });
    revalidatePath("/tickets");
    return { ok: true, id: created.id };
  } catch (e) {
    return { ok: false, error: safeErrorMessage(e) };
  }
}

async function transition(
  id: string,
  allowedFrom: ("OPEN" | "TAKEN_UP" | "SOLVED" | "DUPLICATE" | "FORWARDED")[],
  data: Record<string, unknown>
): Promise<Result> {
  try {
    // Atomic guard: status check and update in one query, so two techs
    // acting on the same ticket can't both win the race.
    const r = await prisma.ticket.updateMany({
      where: { id, status: { in: allowedFrom } },
      data,
    });
    if (r.count === 0)
      return { ok: false, error: "Ticket not found or its status just changed — refresh." };
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
  return transition(id, ["OPEN", "TAKEN_UP", "FORWARDED"], {
    status: "SOLVED",
    solvedById: user.id,
    solvedAt: new Date(),
    resolutionNote: parsed.data.note,
    forwardedTo: null, // the trail keeps the history; the cache is only for live FORWARDED rows
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
    forwardedTo: null,
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

export async function forwardTicket(id: string, to: string, reason: string): Promise<Result> {
  const user = await requireTech();
  const parsed = forwardSchema.safeParse({ to, reason });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  try {
    // One transaction: the status flip and its trail row commit together,
    // so a FORWARDED ticket can never lack the matching audit entry.
    const guarded = await prisma.$transaction(async (tx) => {
      const r = await tx.ticket.updateMany({
        where: { id, status: { in: ["OPEN", "TAKEN_UP", "FORWARDED"] } },
        data: { status: "FORWARDED", forwardedTo: parsed.data.to },
      });
      if (r.count === 0) return false;
      await tx.ticketForward.create({
        data: { ticketId: id, to: parsed.data.to, reason: parsed.data.reason, byId: user.id },
      });
      return true;
    });
    if (!guarded)
      return { ok: false, error: "Ticket not found or its status just changed — refresh." };
    revalidatePath("/tickets");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: safeErrorMessage(e) };
  }
}

export async function takeBackTicket(id: string): Promise<Result> {
  const user = await requireTech();
  return transition(id, ["FORWARDED"], {
    status: "TAKEN_UP",
    takenById: user.id,
    takenAt: new Date(),
    forwardedTo: null,
  });
}

const ALLOWED_MIME = new Set([
  "image/png", "image/jpeg", "image/webp", "image/gif", "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
]);
const MAX_FILE = 5 * 1024 * 1024;

export async function uploadAttachments(ticketId: string, formData: FormData): Promise<Result> {
  const user = await requireTech();
  try {
    const exists = await prisma.ticket.findUnique({ where: { id: ticketId }, select: { id: true } });
    if (!exists) return { ok: false, error: "Ticket not found" };
    const files = formData.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
    if (files.length === 0) return { ok: false, error: "No files selected" };
    if (files.length > 5) return { ok: false, error: "Max 5 files at a time" };
    for (const f of files) {
      if (f.size > MAX_FILE) return { ok: false, error: `${f.name} is over 5 MB` };
      if (!ALLOWED_MIME.has(f.type)) return { ok: false, error: `${f.name}: file type not allowed` };
    }
    const payloads = [];
    for (const f of files) {
      payloads.push({
        ticketId,
        filename: f.name,
        mimeType: f.type,
        size: f.size,
        data: Buffer.from(await f.arrayBuffer()),
        uploadedById: user.id,
      });
    }
    // All-or-nothing: a mid-batch failure must not leave half the files
    // saved, or a retry would duplicate them.
    await prisma.$transaction(payloads.map((data) => prisma.ticketAttachment.create({ data })));
    revalidatePath("/tickets");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: safeErrorMessage(e) };
  }
}

export type TicketDetail = {
  forwards: { to: string; reason: string; byName: string; at: string }[];
  attachments: { id: string; filename: string; size: number; uploadedByName: string; createdAt: string }[];
  estimate: { count: number; avgMs: number; examples: { num: number; title: string; ms: number }[] } | null;
};

export async function getTicketDetail(id: string): Promise<{ ok: true; detail: TicketDetail } | { ok: false; error: string }> {
  await requireTech();
  try {
    const t = await prisma.ticket.findUnique({
      where: { id },
      include: {
        forwards: { orderBy: { at: "desc" }, include: { by: { select: { name: true } } } },
        attachments: {
          orderBy: { createdAt: "desc" },
          select: { id: true, filename: true, size: true, createdAt: true, uploadedBy: { select: { name: true } } },
        },
      },
    });
    if (!t) return { ok: false, error: "Ticket not found" };

    // ponytail: 200-row scan + word overlap; revisit with real volume
    const solved = await prisma.ticket.findMany({
      where: { status: "SOLVED", id: { not: id } },
      orderBy: { solvedAt: "desc" },
      take: 200,
      select: { num: true, title: true, createdAt: true, solvedAt: true },
    });
    const matches = solved
      .filter((c) => c.solvedAt && titlesSimilar(t.title, c.title))
      .map((c) => ({ num: c.num, title: c.title, ms: c.solvedAt!.getTime() - c.createdAt.getTime() }));
    const estimate =
      matches.length === 0
        ? null
        : {
            count: matches.length,
            avgMs: matches.reduce((sum, m) => sum + m.ms, 0) / matches.length,
            examples: matches.slice(0, 3),
          };

    return {
      ok: true,
      detail: {
        forwards: t.forwards.map((f) => ({ to: f.to, reason: f.reason, byName: f.by.name, at: f.at.toISOString() })),
        attachments: t.attachments.map((a) => ({
          id: a.id, filename: a.filename, size: a.size,
          uploadedByName: a.uploadedBy.name, createdAt: a.createdAt.toISOString(),
        })),
        estimate,
      },
    };
  } catch (e) {
    return { ok: false, error: safeErrorMessage(e) };
  }
}
