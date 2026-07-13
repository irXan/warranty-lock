import { ClipboardList, Lock, ShieldCheck, ShieldOff } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useReceipts } from "@/hooks/use-warranty-db";
import {
  STATUS_STAGES,
  updateStatus,
  getWarrantyInfo,
  type Receipt,
  type StatusName,
} from "@/lib/warranty-db";

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function JobBoard() {
  const receipts = useReceipts();

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
      <div className="mb-5 flex items-start gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <ClipboardList className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <h2 className="text-lg font-semibold text-foreground">Workshop job board</h2>
          <p className="text-sm text-muted-foreground">
            {receipts.length === 0
              ? "No receipts yet."
              : `${receipts.length} receipt${receipts.length === 1 ? "" : "s"} on file — sorted newest first.`}
          </p>
        </div>
      </div>

      {receipts.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
          Create your first receipt to see it here.
        </div>
      ) : (
        <ul className="space-y-3">
          {receipts.map((r) => (
            <JobCard key={r.trackId} receipt={r} />
          ))}
        </ul>
      )}
    </div>
  );
}

function JobCard({ receipt }: { receipt: Receipt }) {
  return (
    <li className="rounded-xl border border-border bg-background p-4 transition-colors hover:border-primary/40">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 font-mono text-xs font-semibold text-primary">
              <Lock className="h-3 w-3" />
              {receipt.trackId}
            </span>
            <span className="text-xs text-muted-foreground">{fmtDate(receipt.createdAt)}</span>
            <WarrantyPill receipt={receipt} />
          </div>
          <div className="mt-2 grid grid-cols-1 gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
            <div>
              <span className="text-muted-foreground">Customer: </span>
              <span className="font-medium text-foreground">{receipt.customerName}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Device: </span>
              <span className="font-medium text-foreground">{receipt.deviceModel}</span>
            </div>
            <div className="sm:col-span-2 truncate">
              <span className="text-muted-foreground">Serial: </span>
              <span className="font-mono text-xs text-foreground">{receipt.serialNumber}</span>
            </div>
          </div>
        </div>

        <div className="md:w-56">
          <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Status
          </label>
          <Select
            value={receipt.currentStatus}
            onValueChange={(v) => updateStatus(receipt.trackId, v as StatusName)}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_STAGES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </li>
  );
}

function WarrantyPill({ receipt }: { receipt: Receipt }) {
  const w = getWarrantyInfo(receipt);
  if (w.state === "pending") return null;
  if (w.state === "active") {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-success/10 px-2 py-0.5 text-xs font-medium text-success">
        <ShieldCheck className="h-3 w-3" />
        Warranty · {w.daysRemaining}d left
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
      <ShieldOff className="h-3 w-3" />
      Warranty expired
    </span>
  );
}