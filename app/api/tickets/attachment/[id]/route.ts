import { prisma } from "@/lib/db";
import { requireTech } from "@/lib/session";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireTech();
  } catch (e) {
    const forbidden = e instanceof Error && e.message === "FORBIDDEN";
    return new Response(forbidden ? "Forbidden" : "Unauthorized", { status: forbidden ? 403 : 401 });
  }
  const { id } = await params;
  const a = await prisma.ticketAttachment.findUnique({ where: { id } });
  if (!a) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(a.data), {
    headers: {
      "Content-Type": a.mimeType,
      "Content-Disposition": `attachment; filename="${a.filename.replace(/"/g, "")}"`,
      "Content-Length": String(a.size),
    },
  });
}
