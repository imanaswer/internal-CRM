"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { getTicketDetail, uploadAttachments, type TicketDetail } from "@/app/tickets/actions";
import {
  TicketStatusBadge,
  TicketCategoryBadge,
  TicketPriorityBadge,
  TicketSourceBadge,
} from "@/components/ticket-badges";
import { ticketNo } from "@/lib/whatsapp";
import { formatDuration } from "@/lib/duration";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { TicketRow } from "@/components/tickets-table";

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

const truncateTitle = (s: string) => (s.length > 40 ? `${s.slice(0, 39)}…` : s);

const fmtSize = (bytes: number) =>
  bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)}MB` : `${Math.max(1, Math.ceil(bytes / 1024))}KB`;

export function TicketDetailDialog({
  row,
  onOpenChange,
}: {
  row: TicketRow | null;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [detail, setDetail] = useState<TicketDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!row) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    setDetail(null);
    setLoading(true);
    getTicketDetail(row.id)
      .then((result) => {
        if (cancelled) return;
        if (!result.ok) {
          toast.error(result.error);
          onOpenChange(false);
          return;
        }
        setDetail(result.detail);
      })
      .catch(() => {
        if (cancelled) return;
        toast.error("Request failed — your session may have expired. Refresh the page.");
        onOpenChange(false);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [row?.id]);

  async function handleUpload(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!row) return;
    const formEl = e.currentTarget;
    const fd = new FormData(formEl);
    const hasFile = fd.getAll("files").some((f) => f instanceof File && f.size > 0);
    if (!hasFile) {
      toast.error("Choose at least one file");
      return;
    }
    setUploading(true);
    let result: Awaited<ReturnType<typeof uploadAttachments>>;
    try {
      result = await uploadAttachments(row.id, fd);
    } catch {
      toast.error("Request failed — your session may have expired. Refresh the page.");
      setUploading(false);
      return;
    }
    setUploading(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    formEl.reset();
    toast.success("Attachment uploaded");
    const refreshed = await getTicketDetail(row.id);
    if (refreshed.ok) setDetail(refreshed.detail);
    router.refresh();
  }

  return (
    <Dialog open={!!row} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
        {row && (
          <>
            <DialogHeader>
              <DialogTitle>
                {ticketNo(row.num)} — {row.title}
              </DialogTitle>
              <div className="flex flex-wrap gap-1.5 pt-1">
                <TicketStatusBadge status={row.status} />
                <TicketCategoryBadge category={row.category} />
                <TicketPriorityBadge priority={row.priority} />
                <TicketSourceBadge source={row.source} />
              </div>
            </DialogHeader>

            <p className="text-sm whitespace-pre-wrap">{row.description || "No description"}</p>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-muted-foreground">Contact</div>
                <div>{row.contactName}</div>
                <div>{row.contactPhone}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Branch</div>
                <div>{row.branch || "—"}</div>
              </div>
              <div>
                <div className="text-muted-foreground">IP</div>
                <div>{row.ipAddress || "—"}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Asset</div>
                <div>{row.assetId || "—"}</div>
              </div>
            </div>

            <div>
              <div className="mb-1.5 text-sm font-medium">Timeline</div>
              {loading || !detail ? (
                <p className="text-sm text-muted-foreground">Loading…</p>
              ) : (
                <ul className="space-y-1.5 border-l pl-3 text-sm">
                  <li>
                    Logged by {row.createdByName} · {fmtDate(row.createdAt)}
                  </li>
                  {row.takenAt && (
                    <li>
                      Taken up by {row.takenByName} · {fmtDate(row.takenAt)} (
                      {formatDuration(Date.parse(row.takenAt) - Date.parse(row.createdAt))} after logging)
                    </li>
                  )}
                  {[...detail.forwards].reverse().map((f, i) => (
                    <li key={i}>
                      Forwarded to {f.to} by {f.byName} · {fmtDate(f.at)} — {f.reason} (
                      {formatDuration(Date.parse(f.at) - Date.parse(row.createdAt))} after logging)
                    </li>
                  ))}
                  {row.solvedAt && (
                    <li>
                      Solved by {row.solvedByName} · {fmtDate(row.solvedAt)} — {row.resolutionNote} — resolved in{" "}
                      {formatDuration(Date.parse(row.solvedAt) - Date.parse(row.createdAt))}
                    </li>
                  )}
                </ul>
              )}
            </div>

            {detail?.estimate && (
              <div>
                <div className="mb-1.5 text-sm font-medium">Similar issues</div>
                <p className="text-sm text-muted-foreground">
                  {detail.estimate.count} solved before · typically resolved in ~
                  {formatDuration(detail.estimate.avgMs)}
                </p>
                <ul className="mt-1 space-y-1 text-sm">
                  {detail.estimate.examples.map((ex) => (
                    <li key={ex.num}>
                      {ticketNo(ex.num)} “{truncateTitle(ex.title)}” — {formatDuration(ex.ms)}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div>
              <div className="mb-1.5 text-sm font-medium">Attachments</div>
              {loading || !detail ? (
                <p className="text-sm text-muted-foreground">Loading…</p>
              ) : detail.attachments.length > 0 ? (
                <ul className="space-y-1 text-sm">
                  {detail.attachments.map((a) => (
                    <li key={a.id}>
                      <a
                        href={`/api/tickets/attachment/${a.id}`}
                        download
                        className="underline underline-offset-2 hover:text-foreground"
                      >
                        {a.filename} ({fmtSize(a.size)})
                      </a>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">No attachments</p>
              )}
              <form onSubmit={handleUpload} className="mt-2 flex items-center gap-2">
                <Input
                  type="file"
                  name="files"
                  multiple
                  accept=".png,.jpg,.jpeg,.webp,.gif,.pdf,.doc,.docx,.xls,.xlsx,.txt"
                  className="text-sm"
                />
                <Button type="submit" size="sm" disabled={uploading}>
                  {uploading ? "Uploading..." : "Upload"}
                </Button>
              </form>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
