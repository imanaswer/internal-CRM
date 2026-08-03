"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { TicketForm } from "@/components/ticket-form";
import { createTicket } from "@/app/tickets/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function NewTicketDialog() {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>
        <Plus className="size-4" aria-hidden />
        New Ticket
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New ticket</DialogTitle>
        </DialogHeader>
        <TicketForm action={createTicket} onSuccess={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}
