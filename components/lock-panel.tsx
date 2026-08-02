"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { CalendarRange, Lock } from "lucide-react";
import { toast } from "sonner";
import { lockPeriod, lockMonth, removeLock } from "@/app/manager/locks/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type PeriodLockRow = {
  id: string;
  label: string | null;
  startDate: string;
  endDate: string;
  reason: string | null;
  lockedByName: string;
  lockedAt: string;
};

export function LockPanel({ locks }: { locks: PeriodLockRow[] }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleLockMonth(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    // e.currentTarget is nulled after the await — keep a real reference.
    const formEl = e.currentTarget;
    const form = new FormData(formEl);
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
    formEl.reset();
    router.refresh();
  }

  async function handleLockRange(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formEl = e.currentTarget;
    const form = new FormData(formEl);
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
    formEl.reset();
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
        <form onSubmit={handleLockMonth} className="flex flex-col gap-3 rounded-xl border bg-card p-4">
          <p className="flex items-center gap-1.5 text-sm font-semibold"><Lock className="size-3.5 text-primary" aria-hidden />Lock This Month</p>
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

        <form onSubmit={handleLockRange} className="flex flex-col gap-3 rounded-xl border bg-card p-4">
          <p className="flex items-center gap-1.5 text-sm font-semibold"><CalendarRange className="size-3.5 text-primary" aria-hidden />Lock Custom Range</p>
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
        <p className="text-sm font-semibold">Existing Locks</p>
        {locks.length === 0 ? (
          <p className="rounded-xl border border-dashed bg-card px-4 py-6 text-center text-sm text-muted-foreground">
            No locked periods yet — all past dates are open for employee edits.
          </p>
        ) : (
          <ul className="space-y-2">
            {locks.map((l) => (
              <li key={l.id} className="flex items-center justify-between gap-3 rounded-xl border bg-card p-3 text-sm">
                <div>
                  <p className="font-medium">{l.label || `${l.startDate} → ${l.endDate}`}</p>
                  <p className="text-muted-foreground">
                    Locked by {l.lockedByName} on{" "}
                    {new Date(l.lockedAt).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
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
