"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ActivityForm } from "@/components/activity-form";
import { updateActivity, deleteActivity } from "@/app/activities/actions";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Row = {
  id: string;
  date: string;
  activity: string;
  description: string | null;
  assignedBy: string;
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "ON_HOLD";
  deadline: string | null;
  timeTaken: number;
  locked: boolean;
};

export function ActivityHistory({ rows, maxDate }: { rows: Row[]; maxDate: string }) {
  const router = useRouter();
  const [editing, setEditing] = useState<Row | null>(null);

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
    return <p className="text-sm text-muted-foreground">No activities yet.</p>;
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Activity</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Time Taken</TableHead>
            <TableHead>Deadline</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell>{row.date}</TableCell>
              <TableCell>{row.activity}</TableCell>
              <TableCell>
                <Badge variant="secondary">{row.status.replace("_", " ")}</Badge>
              </TableCell>
              <TableCell>{row.timeTaken}</TableCell>
              <TableCell>{row.deadline ?? "—"}</TableCell>
              <TableCell>
                {row.locked ? (
                  <Badge variant="outline">Locked</Badge>
                ) : (
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => setEditing(row)}>
                      Edit
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => handleDelete(row.id)}>
                      Delete
                    </Button>
                  </div>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit activity</DialogTitle>
          </DialogHeader>
          {editing && (
            <ActivityForm
              action={(input) => updateActivity(editing.id, input)}
              maxDate={maxDate}
              existing={editing}
              onSuccess={() => setEditing(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
