"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ActivityInput } from "@/lib/validation";

const STATUSES = ["PENDING", "IN_PROGRESS", "COMPLETED", "ON_HOLD"] as const;

type ExistingActivity = {
  id: string;
  date: string; // ISO
  activity: string;
  description: string | null;
  assignedBy: string;
  status: (typeof STATUSES)[number];
  deadline: string | null; // ISO
  timeTaken: number;
};

type Props = {
  action: (input: ActivityInput) => Promise<{ ok: true } | { ok: false; error: string }>;
  maxDate: string;
  existing?: ExistingActivity;
  onSuccess?: () => void;
};

export function ActivityForm({ action, maxDate, existing, onSuccess }: Props) {
  const router = useRouter();
  const [status, setStatus] = useState<(typeof STATUSES)[number]>(existing?.status ?? "PENDING");
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    // e.currentTarget is nulled after the await — keep a real reference.
    const formEl = e.currentTarget;
    const form = new FormData(formEl);
    const input: ActivityInput = {
      date: String(form.get("date") ?? ""),
      activity: String(form.get("activity") ?? ""),
      description: String(form.get("description") ?? "") || undefined,
      assignedBy: String(form.get("assignedBy") ?? ""),
      status,
      deadline: String(form.get("deadline") ?? "") || undefined,
      timeTaken: Number(form.get("timeTaken")),
    };

    setPending(true);
    const result = await action(input);
    setPending(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(existing ? "Activity updated" : "Activity added");
    if (!existing) formEl.reset();
    router.refresh();
    onSuccess?.();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="date">Date</Label>
          <Input id="date" name="date" type="date" max={maxDate} defaultValue={existing?.date ?? maxDate} required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="deadline">Deadline</Label>
          <Input id="deadline" name="deadline" type="date" defaultValue={existing?.deadline ?? ""} />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="activity">Activity</Label>
        <Input id="activity" name="activity" defaultValue={existing?.activity} required />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="description">Description</Label>
        <Textarea id="description" name="description" defaultValue={existing?.description ?? ""} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="assignedBy">Assigned By</Label>
          <Input id="assignedBy" name="assignedBy" defaultValue={existing?.assignedBy} required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="timeTaken">Time Taken (hrs)</Label>
          <Input
            id="timeTaken"
            name="timeTaken"
            type="number"
            step={0.25}
            min={0.25}
            defaultValue={existing?.timeTaken}
            required
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="status">Status</Label>
        <Select value={status} onValueChange={(v) => setStatus(v as (typeof STATUSES)[number])}>
          <SelectTrigger id="status" className="w-full">
            <SelectValue placeholder="Select status" />
          </SelectTrigger>
          <SelectContent>
            {STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {s.replace("_", " ")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Button type="submit" disabled={pending}>
        {pending ? "Saving..." : existing ? "Save changes" : "Add activity"}
      </Button>
    </form>
  );
}
