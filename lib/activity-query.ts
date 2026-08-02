import type { Prisma, Status } from "@prisma/client";
import { parseISODate } from "./dates";

export type ActivityFilters = {
  employeeName?: string;
  designation?: string;
  status?: Status;
  assignedBy?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
};

const STATUSES: Status[] = ["PENDING", "IN_PROGRESS", "COMPLETED", "ON_HOLD"];
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

// Shared, hardened searchParams → filters parsing for the manager list and
// the export route: rejects array-valued params, non-enum status, and
// malformed dates (which would otherwise 500 inside Prisma).
export function parseActivityFilters(
  params: Record<string, string | string[] | undefined> | URLSearchParams
): ActivityFilters {
  const get = (key: string): string | undefined => {
    const v = params instanceof URLSearchParams ? params.get(key) : params[key];
    return typeof v === "string" && v ? v : undefined;
  };
  const date = (key: string): string | undefined => {
    const v = get(key);
    return v && ISO_DATE.test(v) ? v : undefined;
  };
  const statusParam = get("status");
  return {
    employeeName: get("employeeName"),
    designation: get("designation"),
    status: statusParam && STATUSES.includes(statusParam as Status) ? (statusParam as Status) : undefined,
    assignedBy: get("assignedBy"),
    dateFrom: date("dateFrom"),
    dateTo: date("dateTo"),
    search: get("search"),
  };
}

export function buildActivityWhere(f: ActivityFilters): Prisma.ActivityWhereInput {
  const where: Prisma.ActivityWhereInput = {};
  if (f.employeeName) where.employeeName = { contains: f.employeeName, mode: "insensitive" };
  if (f.designation) where.designation = { contains: f.designation, mode: "insensitive" };
  if (f.status) where.status = f.status;
  if (f.assignedBy) where.assignedBy = { contains: f.assignedBy, mode: "insensitive" };
  if (f.dateFrom || f.dateTo) {
    where.date = {};
    if (f.dateFrom) where.date.gte = parseISODate(f.dateFrom);
    if (f.dateTo) where.date.lte = parseISODate(f.dateTo);
  }
  if (f.search) {
    where.OR = [
      { employeeName: { contains: f.search, mode: "insensitive" } },
      { activity: { contains: f.search, mode: "insensitive" } },
      { assignedBy: { contains: f.search, mode: "insensitive" } },
    ];
  }
  return where;
}
