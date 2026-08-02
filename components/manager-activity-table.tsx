"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2, SearchX } from "lucide-react";
import { deleteActivity } from "@/app/activities/actions";
import { Button } from "@/components/ui/button";
import { StatusBadge, type ActivityStatus } from "@/components/status-badge";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";

type Row = {
  id: string;
  date: string | null;
  employeeName: string;
  designation: string;
  activity: string;
  status: ActivityStatus;
  assignedBy: string;
  timeTaken: number;
  deadline: string | null;
};

export function ManagerActivityTable({ rows }: { rows: Row[] }) {
  const router = useRouter();

  async function handleDelete(id: string) {
    const result = await deleteActivity(id);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Activity deleted");
    router.refresh();
  }

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border bg-card py-12 text-center">
        <SearchX className="size-8 text-muted-foreground/50" aria-hidden />
        <p className="text-sm font-medium">No activities match</p>
        <p className="text-sm text-muted-foreground">Adjust or clear the filters to see more.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Employee</TableHead>
            <TableHead>Designation</TableHead>
            <TableHead>Activity</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Assigned By</TableHead>
            <TableHead className="text-right">Time (hrs)</TableHead>
            <TableHead>Deadline</TableHead>
            <TableHead className="w-14 text-right">
              <span className="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell className="text-muted-foreground tabular-nums">{row.date ?? "—"}</TableCell>
              <TableCell className="font-medium">{row.employeeName}</TableCell>
              <TableCell className="text-muted-foreground">{row.designation}</TableCell>
              <TableCell className="max-w-64 truncate" title={row.activity}>
                {row.activity}
              </TableCell>
              <TableCell>
                <StatusBadge status={row.status} />
              </TableCell>
              <TableCell className="text-muted-foreground">{row.assignedBy}</TableCell>
              <TableCell className="text-right tabular-nums">{row.timeTaken}</TableCell>
              <TableCell className="text-muted-foreground">{row.deadline ?? "—"}</TableCell>
              <TableCell className="text-right">
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label={`Delete activity by ${row.employeeName}`}
                  className="text-destructive hover:text-destructive"
                  onClick={() => handleDelete(row.id)}
                >
                  <Trash2 className="size-3.5" aria-hidden />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
