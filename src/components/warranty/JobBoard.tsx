import { useMemo, useState } from "react";
import {
  ClipboardList,
  Lock,
  Printer,
  Search,
  SearchX,
  ShieldCheck,
  ShieldOff,
  Inbox,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useReceipts } from "@/hooks/use-warranty-db";
import {
  STATUS_STAGES,
  getWarrantyInfo,
  type Receipt,
  type StatusName,
} from "@/lib/warranty-db";
import { updateStatus, receiptsQueryKey } from "@/lib/warranty-repo";
import { printReceipt } from "@/lib/print-receipt";
import { EmptyState } from "./EmptyState";
import { RepairPhotos } from "./RepairPhotos";

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
  const { data: receipts = [], isLoading } = useReceipts();
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return receipts;
    return receipts.filter((r) =>
      [
        r.trackId,
        r.customerName,
        r.customerPhone,
        r.deviceModel,
        r.serialNumber,
        r.issueDescription,
        r.currentStatus,
      ]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [receipts, query]);

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

      {receipts.length > 0 && (
        <div className="mb-4 relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by Track ID, customer, device, serial…"
            className="pl-9"
          />
        </div>
      )}

      {receipts.length === 0 ? (
        isLoading ? (
          <div className="py-8 text-center text-sm text-muted-foreground">Loading receipts…</div>
        ) : (
        <EmptyState
          icon={Inbox}
          title="No receipts yet"
          description="Use the form above to create your first immutable repair receipt — it will land here instantly."
        />
        )
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={SearchX}
          title="No matches found"
          description={`Nothing matched “${query}”. Try a different Track ID, customer, device, or serial.`}
        />
      ) : (
        <ul className="space-y-3">
          {filtered.map((r) => (
            <JobCard key={r.trackId} receipt={r} />
          ))}
        </ul>
      )}
    </div>
  );
}

function JobCard({ receipt }: { receipt: Receipt }) {
  const qc = useQueryClient();
  const mut = useMutation({
    mutationFn: ({ status }: { status: StatusName }) => updateStatus(receipt.trackId, status),
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: receiptsQueryKey });
      toast.success(`Status updated to “${vars.status}”`, { description: receipt.trackId });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Update failed"),
  });
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
            onValueChange={(v) => {
              const next = v as StatusName;
              if (next === receipt.currentStatus) return;
              mut.mutate({ status: next });
            }}
            disabled={mut.isPending}
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
          <Button
            variant="outline"
            size="sm"
            className="mt-2 w-full gap-2"
            onClick={async () => {
              await printReceipt(receipt);
              toast.success("Opened printable receipt");
            }}
          >
            <Printer className="h-3.5 w-3.5" />
            Print / PDF
          </Button>
        </div>
      </div>

      {receipt.id && receipt.workshopId && (
        <RepairPhotos receiptId={receipt.id} workshopId={receipt.workshopId} />
      )}
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