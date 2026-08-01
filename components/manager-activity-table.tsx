"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { deleteActivity } from "@/app/activities/actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "ON_HOLD";
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
    return <p className="text-sm text-muted-foreground">No activities.</p>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Date</TableHead>
          <TableHead>Employee</TableHead>
          <TableHead>Designation</TableHead>
          <TableHead>Activity</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Assigned By</TableHead>
          <TableHead>Time Taken</TableHead>
          <TableHead>Deadline</TableHead>
          <TableHead>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.id}>
            <TableCell>{row.date ?? "—"}</TableCell>
            <TableCell>{row.employeeName}</TableCell>
            <TableCell>{row.designation}</TableCell>
            <TableCell>{row.activity}</TableCell>
            <TableCell>
              <Badge variant="secondary">{row.status.replace("_", " ")}</Badge>
            </TableCell>
            <TableCell>{row.assignedBy}</TableCell>
            <TableCell>{row.timeTaken}</TableCell>
            <TableCell>{row.deadline ?? "—"}</TableCell>
            <TableCell>
              <Button size="sm" variant="destructive" onClick={() => handleDelete(row.id)}>
                Delete
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
