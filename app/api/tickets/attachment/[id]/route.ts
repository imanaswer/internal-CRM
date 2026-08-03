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
  // RFC 5987 dual form: ASCII fallback + UTF-8 encoded original, so
  // non-Latin-1 filenames (Malayalam, emoji, ...) don't blow up the header.
  const ascii = a.filename.replace(/["\r\n]/g, "").replace(/[^\x20-\x7e]/g, "_") || "attachment";
  return new Response(new Uint8Array(a.data), {
    headers: {
      "Content-Type": a.mimeType,
      "Content-Disposition": `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(a.filename)}`,
      "Content-Length": String(a.size),
      "Cache-Control": "private, no-store",
    },
  });
}
