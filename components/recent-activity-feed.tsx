import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDuration, istStamp } from "@/lib/duration";

export function RecentActivityFeed({
  events,
}: {
  events: { at: string; text: string }[];
}) {
  return (
    <Card className="gap-1 py-4">
      <CardHeader className="pb-0">
        <CardTitle className="text-[13px] font-medium text-muted-foreground">
          Recent activity
        </CardTitle>
      </CardHeader>
      <CardContent>
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
      </CardContent>
    </Card>
  );
}
