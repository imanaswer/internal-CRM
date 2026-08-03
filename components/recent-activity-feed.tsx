import { ChevronDown } from "lucide-react";
import { formatDuration, istStamp } from "@/lib/duration";

export function RecentActivityFeed({
  events,
}: {
  events: { at: string; text: string }[];
}) {
  return (
    <details className="group rounded-xl border bg-card">
      <summary className="flex cursor-pointer items-center justify-between gap-2 px-6 py-4 text-sm font-medium select-none [&::-webkit-details-marker]:hidden">
        <span className="flex items-center gap-2">
          Recent activity
          <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-semibold text-accent-foreground">
            {events.length}
          </span>
        </span>
        <span className="flex items-center gap-1.5 text-xs font-normal text-muted-foreground">
          {events[0] ? `Latest: ${istStamp(new Date(events[0].at))}` : "No events yet"}
          <ChevronDown className="size-4 transition-transform group-open:rotate-180" aria-hidden />
        </span>
      </summary>
      <div className="border-t px-6 py-4">
        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing yet.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {events.map((e, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <span
                  className="mt-1.5 size-1.5 shrink-0 rounded-full bg-muted-foreground/50"
                  aria-hidden
                />
                <div className="flex flex-col">
                  <span className="text-sm">{e.text}</span>
                  <span className="text-xs text-muted-foreground">
                    {istStamp(new Date(e.at))} · {formatDuration(Date.now() - Date.parse(e.at))} ago
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </details>
  );
}
