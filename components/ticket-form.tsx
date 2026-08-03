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
import {
  TICKET_SOURCES,
  TICKET_PRIORITIES,
  TICKET_CATEGORIES,
  label as fmtLabel,
  type TicketSource,
  type TicketPriority,
  type TicketCategory,
} from "@/components/ticket-badges";
import { uploadAttachments } from "@/app/tickets/actions";
import type { TicketInput } from "@/lib/validation";

type Props = {
  action: (input: TicketInput) => Promise<{ ok: true; id: string } | { ok: false; error: string }>;
  onSuccess?: () => void;
};

export function TicketForm({ action, onSuccess }: Props) {
  const router = useRouter();
  const [source, setSource] = useState<TicketSource>("PHONE");
  const [priority, setPriority] = useState<TicketPriority>("MEDIUM");
  const [category, setCategory] = useState<TicketCategory>("TECH");
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    // e.currentTarget is nulled after the await — keep a real reference.
    const formEl = e.currentTarget;
    const form = new FormData(formEl);
    const files = (form.getAll("files") as File[]).filter((f) => f.size > 0);
    const input: TicketInput = {
      title: String(form.get("title") ?? ""),
      description: String(form.get("description") ?? "") || undefined,
      contactName: String(form.get("contactName") ?? ""),
      contactPhone: String(form.get("contactPhone") ?? ""),
      branch: String(form.get("branch") ?? "") || undefined,
      source,
      priority,
      ipAddress: String(form.get("ipAddress") ?? "") || undefined,
      assetId: String(form.get("assetId") ?? "") || undefined,
      category,
    };

    setPending(true);
    let result: Awaited<ReturnType<typeof action>>;
    try {
      result = await action(input);
    } catch {
      toast.error("Request failed — your session may have expired. Refresh the page.");
      setPending(false);
      return;
    }

    if (!result.ok) {
      toast.error(result.error);
      setPending(false);
      return;
    }

    let uploadFailed = false;
    if (files.length > 0) {
      const fd = new FormData();
      for (const f of files) fd.append("files", f);
      try {
        const uploadResult = await uploadAttachments(result.id, fd);
        if (!uploadResult.ok) {
          uploadFailed = true;
          toast.error(`Ticket created, but attachment failed: ${uploadResult.error}`);
        }
      } catch {
        uploadFailed = true;
        toast.error("Ticket created, but attachment upload failed — your session may have expired.");
      }
    }
    setPending(false);

    if (!uploadFailed) toast.success("Ticket created");
    formEl.reset();
    setSource("PHONE");
    setPriority("MEDIUM");
    setCategory("TECH");
    router.refresh();
    onSuccess?.();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="title">Title</Label>
        <Input id="title" name="title" required />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="description">Description</Label>
        <Textarea id="description" name="description" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="contactName">Contact Name</Label>
          <Input id="contactName" name="contactName" required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="contactPhone">Contact Phone</Label>
          <Input id="contactPhone" name="contactPhone" inputMode="tel" required />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="branch">Branch</Label>
        <Input id="branch" name="branch" />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="source">Source</Label>
          <Select value={source} onValueChange={(v) => setSource(v as TicketSource)}>
            <SelectTrigger id="source" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TICKET_SOURCES.map((s) => (
                <SelectItem key={s} value={s}>
                  {fmtLabel(s)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="priority">Priority</Label>
          <Select value={priority} onValueChange={(v) => setPriority(v as TicketPriority)}>
            <SelectTrigger id="priority" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TICKET_PRIORITIES.map((p) => (
                <SelectItem key={p} value={p}>
                  {fmtLabel(p)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="category">Category</Label>
          <Select value={category} onValueChange={(v) => setCategory(v as TicketCategory)}>
            <SelectTrigger id="category" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TICKET_CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {fmtLabel(c)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ipAddress">IP Address</Label>
          <Input id="ipAddress" name="ipAddress" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="assetId">Asset/Device ID</Label>
          <Input id="assetId" name="assetId" />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="files">Attachments</Label>
        <Input
          id="files"
          name="files"
          type="file"
          multiple
          accept=".png,.jpg,.jpeg,.webp,.gif,.pdf,.doc,.docx,.xls,.xlsx,.txt"
        />
      </div>

      <Button type="submit" disabled={pending}>
        {pending ? "Saving..." : "Create ticket"}
      </Button>
    </form>
  );
}
