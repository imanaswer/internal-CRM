import ExcelJS from "exceljs";
import { prisma } from "@/lib/db";
import { requireManager } from "@/lib/session";
import { buildActivityWhere, parseActivityFilters } from "@/lib/activity-query";
import { dateToISO, todayISO } from "@/lib/dates";

// exceljs uses Node Buffer APIs, not available in the edge runtime.
export const runtime = "nodejs";

export async function GET(req: Request) {
  // requireManager() throws a plain Error; middleware doesn't redirect API
  // routes (no `authorized` callback in auth.ts — see task report), so this
  // route must gate itself with an explicit 401/403 rather than letting the
  // throw bubble into an uncaught 500.
  try {
    await requireManager();
  } catch (e) {
    const forbidden = e instanceof Error && e.message === "FORBIDDEN";
    return new Response(forbidden ? "Forbidden" : "Unauthorized", { status: forbidden ? 403 : 401 });
  }
  const filters = parseActivityFilters(new URL(req.url).searchParams);
  const rows = await prisma.activity.findMany({
    where: buildActivityWhere(filters),
    orderBy: { date: "desc" },
  });

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Activities");
  ws.columns = [
    { header: "Date", key: "date", width: 12 },
    { header: "Employee Name", key: "employeeName", width: 20 },
    { header: "Designation", key: "designation", width: 16 },
    { header: "Activity", key: "activity", width: 30 },
    { header: "Description", key: "description", width: 30 },
    { header: "Assigned By", key: "assignedBy", width: 16 },
    { header: "Status", key: "status", width: 14 },
    { header: "Deadline", key: "deadline", width: 12 },
    { header: "Time Taken", key: "timeTaken", width: 12 },
  ];
  ws.getRow(1).font = { bold: true };
  for (const r of rows) {
    ws.addRow({
      date: dateToISO(r.date),
      employeeName: r.employeeName,
      designation: r.designation,
      activity: r.activity,
      description: r.description ?? "",
      assignedBy: r.assignedBy,
      status: r.status,
      deadline: r.deadline ? dateToISO(r.deadline) : "",
      timeTaken: Number(r.timeTaken),
    });
  }
  const buf = await wb.xlsx.writeBuffer();
  // writeBuffer() resolves to a Buffer/ArrayBuffer union; Response's BodyInit
  // wants BlobPart-compatible binary, so wrap it in a Uint8Array view.
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="Daily_Report_${todayISO()}.xlsx"`,
    },
  });
}
