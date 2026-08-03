"use client";

import { useState, type FormEvent, type MouseEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2, SearchX } from "lucide-react";
import {
  takeUpTicket,
  solveTicket,
  markDuplicate,
  reopenTicket,
  deleteTicket,
  forwardTicket,
  takeBackTicket,
} from "@/app/tickets/actions";
import { buildWaLink, solvedMessage, ticketNo } from "@/lib/whatsapp";
import { formatDuration, istStamp } from "@/lib/duration";
import {
  TicketStatusBadge,
  TicketPriorityBadge,
  TicketSourceBadge,
  TicketCategoryBadge,
  type TicketSource,
  type TicketPriority,
  type TicketStatus,
  type TicketCategory,
} from "@/components/ticket-badges";
import { TicketDetailDialog } from "@/components/ticket-detail-dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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

export type TicketRow = {
  id: string;
  num: number;
  title: string;
  description: string | null;
  contactName: string;
  contactPhone: string;
  branch: string | null;
  source: TicketSource;
  ipAddress: string | null;
  assetId: string | null;
  priority: TicketPriority;
  category: TicketCategory;
  status: TicketStatus;
  forwardedTo: string | null;
  forwardedAt: string | null;
  takenByName: string | null;
  takenAt: string | null;
  solvedByName: string | null;
  solvedAt: string | null;
  resolutionNote: string | null;
  createdAt: string;
  createdByName: string;
};

function truncate(s: string, n: number) {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

function timeLine2(row: TicketRow, now: number): string {
  const created = Date.parse(row.createdAt);
  const taken = row.takenAt ? Date.parse(row.takenAt) : created;
  switch (row.status) {
    case "SOLVED":
      return row.solvedAt ? `Resolved in ${formatDuration(Date.parse(row.solvedAt) - created)}` : "";
    case "TAKEN_UP":
      return `In progress ${formatDuration(now - taken)}`;
    case "FORWARDED": {
      const since = row.forwardedAt ? Date.parse(row.forwardedAt) : taken;
      return `With ${truncate(row.forwardedTo ?? "—", 16)} ${formatDuration(now - since)}`;
    }
    default:
      return `Raised ${formatDuration(now - created)} ago`;
  }
}

export function TicketsTable({ rows, isManager }: { rows: TicketRow[]; isManager: boolean }) {
  const router = useRouter();
  const [solvingId, setSolvingId] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [forwardingId, setForwardingId] = useState<string | null>(null);
  const [forwardTo, setForwardTo] = useState("");
  const [forwardReason, setForwardReason] = useState("");
  const [detailRow, setDetailRow] = useState<TicketRow | null>(null);
  const [pending, setPending] = useState(false);

  async function runAction(action: () => Promise<{ ok: true } | { ok: false; error: string }>, successMsg: string) {
    let result: { ok: true } | { ok: false; error: string };
    try {
      result = await action();
    } catch {
      toast.error("Request failed — your session may have expired. Refresh the page.");
      return;
    }
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(successMsg);
    router.refresh();
  }

  async function handleSolveSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!solvingId) return;
    setPending(true);
    let result: Awaited<ReturnType<typeof solveTicket>>;
    try {
      result = await solveTicket(solvingId, note);
    } catch {
      toast.error("Request failed — your session may have expired. Refresh the page.");
      setPending(false);
      return;
    }
    setPending(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Ticket solved");
    setSolvingId(null);
    setNote("");
    router.refresh();
  }

  async function handleForwardSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!forwardingId) return;
    setPending(true);
    let result: Awaited<ReturnType<typeof forwardTicket>>;
    try {
      result = await forwardTicket(forwardingId, forwardTo, forwardReason);
    } catch {
      toast.error("Request failed — your session may have expired. Refresh the page.");
      setPending(false);
      return;
    }
    setPending(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Ticket forwarded");
    setForwardingId(null);
    setForwardTo("");
    setForwardReason("");
    router.refresh();
  }

  function handleRowClick(row: TicketRow, e: MouseEvent<HTMLTableRowElement>) {
    if ((e.target as HTMLElement).closest("button,a")) return;
    setDetailRow(row);
  }

  const now = Date.now();

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border bg-card py-12 text-center">
        <SearchX className="size-8 text-muted-foreground/50" aria-hidden />
        <p className="text-sm font-medium">No tickets match. Adjust filters or log a new ticket.</p>
      </div>
    );
  }

  return (
    <>
      <div className="overflow-x-auto rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>T-no</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Time</TableHead>
              <TableHead>Taken by</TableHead>
              <TableHead className="text-right">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => {
              const waLink =
                row.status === "SOLVED" && row.solvedAt
                  ? buildWaLink(
                      row.contactPhone,
                      solvedMessage({
                        contactName: row.contactName,
                        num: row.num,
                        title: row.title,
                        resolutionNote: row.resolutionNote ?? "",
                        solvedAt: new Date(row.solvedAt),
                      })
                    )
                  : null;

              return (
                <TableRow
                  key={row.id}
                  className="cursor-pointer"
                  onClick={(e) => handleRowClick(row, e)}
                >
                  <TableCell className="font-medium tabular-nums">{ticketNo(row.num)}</TableCell>
                  <TableCell className="max-w-56 truncate" title={row.description ?? row.title}>
                    {row.title}
                  </TableCell>
                  <TableCell className="text-sm">
                    <div>{row.contactName}</div>
                    <div className="text-muted-foreground">{row.contactPhone}</div>
                  </TableCell>
                  <TableCell>
                    <TicketSourceBadge source={row.source} />
                  </TableCell>
                  <TableCell>
                    <TicketCategoryBadge category={row.category} />
                  </TableCell>
                  <TableCell>
                    <TicketPriorityBadge priority={row.priority} />
                  </TableCell>
                  <TableCell>
                    <TicketStatusBadge status={row.status} />
                    {row.status === "FORWARDED" && row.forwardedTo && (
                      <div className="mt-0.5 text-xs text-muted-foreground">→ {row.forwardedTo}</div>
                    )}
                  </TableCell>
                  <TableCell className="text-sm whitespace-nowrap">
                    <div className="text-muted-foreground">{istStamp(new Date(row.createdAt))}</div>
                    <div>{timeLine2(row, now)}</div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{row.takenByName ?? "—"}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      {row.status === "OPEN" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          aria-label={`Take up ${ticketNo(row.num)}`}
                          onClick={() => runAction(() => takeUpTicket(row.id), "Ticket taken up")}
                        >
                          Take Up
                        </Button>
                      )}
                      {(row.status === "OPEN" || row.status === "TAKEN_UP" || row.status === "FORWARDED") && (
                        <Button
                          size="sm"
                          variant="ghost"
                          aria-label={`Solve ${ticketNo(row.num)}`}
                          onClick={() => {
                            setSolvingId(row.id);
                            setNote("");
                          }}
                        >
                          Solve
                        </Button>
                      )}
                      {(row.status === "OPEN" || row.status === "TAKEN_UP" || row.status === "FORWARDED") && (
                        <Button
                          size="sm"
                          variant="ghost"
                          aria-label={`Forward ${ticketNo(row.num)}`}
                          onClick={() => {
                            setForwardingId(row.id);
                            setForwardTo("");
                            setForwardReason("");
                          }}
                        >
                          Forward
                        </Button>
                      )}
                      {(row.status === "OPEN" || row.status === "TAKEN_UP") && (
                        <Button
                          size="sm"
                          variant="ghost"
                          aria-label={`Mark ${ticketNo(row.num)} duplicate`}
                          onClick={() => runAction(() => markDuplicate(row.id), "Marked duplicate")}
                        >
                          Duplicate
                        </Button>
                      )}
                      {row.status === "FORWARDED" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          aria-label={`Take back ${ticketNo(row.num)}`}
                          onClick={() => runAction(() => takeBackTicket(row.id), "Ticket taken back")}
                        >
                          Take Back
                        </Button>
                      )}
                      {row.status === "SOLVED" && waLink && (
                        <a
                          href={waLink}
                          target="_blank"
                          rel="noopener"
                          aria-label={`Send WhatsApp for ${ticketNo(row.num)}`}
                          className={buttonVariants({ size: "sm", variant: "ghost" })}
                        >
                          Send WhatsApp
                        </a>
                      )}
                      {(row.status === "SOLVED" || row.status === "DUPLICATE") && (
                        <Button
                          size="sm"
                          variant="ghost"
                          aria-label={`Reopen ${ticketNo(row.num)}`}
                          onClick={() => runAction(() => reopenTicket(row.id), "Ticket reopened")}
                        >
                          Reopen
                        </Button>
                      )}
                      {isManager && (
                        <Button
                          size="sm"
                          variant="ghost"
                          aria-label={`Delete ${ticketNo(row.num)}`}
                          className="text-destructive hover:text-destructive"
                          onClick={() => runAction(() => deleteTicket(row.id), "Ticket deleted")}
                        >
                          <Trash2 className="size-3.5" aria-hidden />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!solvingId} onOpenChange={(open) => !open && setSolvingId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Solve ticket</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSolveSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="resolutionNote">Resolution note</Label>
              <Textarea
                id="resolutionNote"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                minLength={3}
                required
                autoFocus
              />
            </div>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving..." : "Mark solved"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!forwardingId} onOpenChange={(open) => !open && setForwardingId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Forward ticket</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleForwardSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="forwardTo">Forward to</Label>
              <Input
                id="forwardTo"
                value={forwardTo}
                onChange={(e) => setForwardTo(e.target.value)}
                minLength={2}
                required
                autoFocus
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="forwardReason">Reason</Label>
              <Textarea
                id="forwardReason"
                value={forwardReason}
                onChange={(e) => setForwardReason(e.target.value)}
                minLength={3}
                required
              />
            </div>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving..." : "Forward"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <TicketDetailDialog row={detailRow} onOpenChange={(open) => !open && setDetailRow(null)} />
    </>
  );
}
