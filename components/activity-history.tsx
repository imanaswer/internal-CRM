"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ActivityForm } from "@/components/activity-form";
import { updateActivity, deleteActivity } from "@/app/activities/actions";
import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge, LockedBadge } from "@/components/status-badge";
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
    let result: Awaited<ReturnType<typeof deleteActivity>>;
    try {
      result = await deleteActivity(id);
    } catch {
      toast.error("Request failed \u2014 your session may have expired. Refresh the page.");
      return;
    }
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Activity deleted");
    router.refresh();
  }

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center gap-1 rounded-xl border bg-card py-12 text-center">
        <p className="text-sm font-medium">No activities yet</p>
        <p className="text-sm text-muted-foreground">Entries you add from the dashboard appear here.</p>
      </div>
    );
  }

  return (
    <>
      <div className="overflow-x-auto rounded-xl border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Activity</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Time (hrs)</TableHead>
            <TableHead>Deadline</TableHead>
            <TableHead className="w-28 text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id} className={row.locked ? "bg-muted/40" : undefined}>
              <TableCell className="text-muted-foreground tabular-nums">{row.date}</TableCell>
              <TableCell className="max-w-72 truncate font-medium" title={row.description ?? row.activity}>
                {row.activity}
              </TableCell>
              <TableCell>
                <StatusBadge status={row.status} />
              </TableCell>
              <TableCell className="text-right tabular-nums">{row.timeTaken}</TableCell>
              <TableCell className="text-muted-foreground">{row.deadline ?? "—"}</TableCell>
              <TableCell className="text-right">
                {row.locked ? (
                  <LockedBadge />
                ) : (
                  <div className="flex justify-end gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label={`Edit ${row.activity}`}
                      onClick={() => setEditing(row)}
                    >
                      <Pencil className="size-3.5" aria-hidden />
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label={`Delete ${row.activity}`}
                      className="text-destructive hover:text-destructive"
                      onClick={() => handleDelete(row.id)}
                    >
                      <Trash2 className="size-3.5" aria-hidden />
                    </Button>
                  </div>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      </div>

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
