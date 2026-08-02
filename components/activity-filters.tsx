"use client";

import { useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { STATUSES, statusLabel } from "@/components/status-badge";

export function ActivityFilters() {
  const router = useRouter();
  const params = useSearchParams();
  const [status, setStatus] = useState(params.get("status") ?? "ALL");

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const qs = new URLSearchParams();
    for (const key of ["employeeName", "designation", "assignedBy", "dateFrom", "dateTo", "search"]) {
      const value = String(form.get(key) ?? "").trim();
      if (value) qs.set(key, value);
    }
    if (status !== "ALL") qs.set("status", status);
    router.push(qs.size ? `/manager?${qs.toString()}` : "/manager");
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3 rounded-xl border bg-card p-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="employeeName">Employee</Label>
        <Input id="employeeName" name="employeeName" defaultValue={params.get("employeeName") ?? ""} className="w-40" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="designation">Designation</Label>
        <Input id="designation" name="designation" defaultValue={params.get("designation") ?? ""} className="w-40" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="status">Status</Label>
        <Select value={status} onValueChange={(v) => setStatus(v ?? "ALL")}>
          <SelectTrigger id="status" className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All</SelectItem>
            {STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {statusLabel(s)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="assignedBy">Assigned By</Label>
        <Input id="assignedBy" name="assignedBy" defaultValue={params.get("assignedBy") ?? ""} className="w-40" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="dateFrom">Date From</Label>
        <Input id="dateFrom" name="dateFrom" type="date" defaultValue={params.get("dateFrom") ?? ""} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="dateTo">Date To</Label>
        <Input id="dateTo" name="dateTo" type="date" defaultValue={params.get("dateTo") ?? ""} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="search">Search</Label>
        <Input id="search" name="search" defaultValue={params.get("search") ?? ""} className="w-40" />
      </div>
      <div className="flex gap-2">
        <Button type="submit">Apply</Button>
        <Button type="button" variant="outline" onClick={() => router.push("/manager")}>
          Clear
        </Button>
      </div>
    </form>
  );
}
