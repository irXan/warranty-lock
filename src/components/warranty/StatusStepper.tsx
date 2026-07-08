import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { STATUS_STAGES, type Receipt, type StatusName } from "@/lib/warranty-db";

function fmt(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function StatusStepper({ receipt }: { receipt: Receipt }) {
  const currentIdx = STATUS_STAGES.indexOf(receipt.currentStatus);
  const timestampByStatus = new Map<StatusName, string>();
  for (const entry of receipt.statusHistory) {
    if (!timestampByStatus.has(entry.status)) {
      timestampByStatus.set(entry.status, entry.updatedAt);
    }
  }

  return (
    <ol className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between md:gap-2">
      {STATUS_STAGES.map((stage, idx) => {
        const state: "done" | "active" | "future" =
          idx < currentIdx ? "done" : idx === currentIdx ? "active" : "future";
        const ts = timestampByStatus.get(stage);
        const isLast = idx === STATUS_STAGES.length - 1;

        return (
          <li key={stage} className="relative flex flex-1 gap-3 md:flex-col md:items-center md:text-center">
            {/* Connector (vertical on mobile, horizontal on desktop) */}
            {!isLast && (
              <>
                <span
                  aria-hidden
                  className={cn(
                    "absolute left-[15px] top-9 h-[calc(100%+0.5rem)] w-0.5 md:hidden",
                    state === "done" ? "bg-success" : "bg-border",
                  )}
                />
                <span
                  aria-hidden
                  className={cn(
                    "absolute left-1/2 top-4 hidden h-0.5 w-full md:block",
                    state === "done" ? "bg-success" : "bg-border",
                  )}
                />
              </>
            )}

            <div
              className={cn(
                "relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-xs font-semibold transition-colors",
                state === "done" &&
                  "border-success bg-success text-success-foreground",
                state === "active" &&
                  "border-primary bg-primary text-primary-foreground shadow-[0_0_0_4px_hsl(var(--primary)/0.15)] animate-pulse-ring",
                state === "future" && "border-border bg-background text-muted-foreground",
              )}
            >
              {state === "done" ? <Check className="h-4 w-4" /> : idx + 1}
            </div>

            <div className="min-w-0 flex-1 md:mt-2 md:flex-none">
              <div
                className={cn(
                  "text-sm font-medium",
                  state === "future" ? "text-muted-foreground" : "text-foreground",
                )}
              >
                {stage}
              </div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                {ts ? fmt(ts) : state === "future" ? "Pending" : ""}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}