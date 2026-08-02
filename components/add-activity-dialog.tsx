"use client";

import { useState } from "react";
import { ActivityForm } from "@/components/activity-form";
import { createActivity } from "@/app/activities/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function AddActivityDialog({ maxDate }: { maxDate: string }) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>Add Activity</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add activity</DialogTitle>
        </DialogHeader>
        <ActivityForm action={createActivity} maxDate={maxDate} onSuccess={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}
