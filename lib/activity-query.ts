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

export function buildActivityWhere(f: ActivityFilters): Prisma.ActivityWhereInput {
  const where: Prisma.ActivityWhereInput = {};
  if (f.employeeName) where.employeeName = { contains: f.employeeName, mode: "insensitive" };
  if (f.designation) where.designation = f.designation;
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
