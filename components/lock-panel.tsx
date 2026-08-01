"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { lockPeriod, lockMonth, removeLock } from "@/app/manager/locks/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Lock = {
  id: string;
  label: string | null;
  startDate: string;
  endDate: string;
  reason: string | null;
  lockedByName: string;
  lockedAt: string;
};

export function LockPanel({ locks }: { locks: Lock[] }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleLockMonth(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const month = String(form.get("month") ?? "");
    const reason = String(form.get("reason") ?? "").trim();
    if (!month) return;
    setPending(true);
    const result = await lockMonth(month, reason || undefined);
    setPending(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Month locked");
    e.currentTarget.reset();
    router.refresh();
  }

  async function handleLockRange(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const startDate = String(form.get("startDate") ?? "");
    const endDate = String(form.get("endDate") ?? "");
    const label = String(form.get("label") ?? "").trim();
    const reason = String(form.get("reason") ?? "").trim();
    if (!startDate || !endDate) return;
    setPending(true);
    const result = await lockPeriod({
      startDate,
      endDate,
      label: label || undefined,
      reason: reason || undefined,
    });
    setPending(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Period locked");
    e.currentTarget.reset();
    router.refresh();
  }

  async function handleRemove(id: string) {
    const result = await removeLock(id);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Lock removed");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <form onSubmit={handleLockMonth} className="flex flex-col gap-2 rounded-lg border p-4">
          <p className="text-sm font-medium">Lock This Month</p>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="month">Month</Label>
            <Input id="month" name="month" type="month" required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="month-reason">Reason (optional)</Label>
            <Textarea id="month-reason" name="reason" rows={2} />
          </div>
          <Button type="submit" disabled={pending}>
            Lock Month
          </Button>
        </form>

        <form onSubmit={handleLockRange} className="flex flex-col gap-2 rounded-lg border p-4">
          <p className="text-sm font-medium">Lock Custom Range</p>
          <div className="flex gap-2">
            <div className="flex flex-1 flex-col gap-1.5">
              <Label htmlFor="startDate">Start</Label>
              <Input id="startDate" name="startDate" type="date" required />
            </div>
            <div className="flex flex-1 flex-col gap-1.5">
              <Label htmlFor="endDate">End</Label>
              <Input id="endDate" name="endDate" type="date" required />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="label">Label (optional)</Label>
            <Input id="label" name="label" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="range-reason">Reason (optional)</Label>
            <Textarea id="range-reason" name="reason" rows={2} />
          </div>
          <Button type="submit" disabled={pending}>
            Lock Range
          </Button>
        </form>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium">Existing Locks</p>
        {locks.length === 0 ? (
          <p className="text-sm text-muted-foreground">No locks.</p>
        ) : (
          <ul className="space-y-2">
            {locks.map((l) => (
              <li key={l.id} className="flex items-center justify-between rounded-lg border p-3 text-sm">
                <div>
                  <p className="font-medium">{l.label || `${l.startDate} → ${l.endDate}`}</p>
                  <p className="text-muted-foreground">
                    Locked by {l.lockedByName} on {l.lockedAt}
                    {l.reason ? ` — ${l.reason}` : ""}
                  </p>
                </div>
                <Button size="sm" variant="destructive" onClick={() => handleRemove(l.id)}>
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
