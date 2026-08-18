import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { PackageSearch, Plus, ShieldCheck, ShieldOff, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "./EmptyState";
import { claimReceiptByTrackId, listMyRepairs, type ClaimedRepair } from "@/lib/customer-claims.functions";
import { DEFAULT_WARRANTY_DAYS, getWarrantyInfo, type Receipt, type StatusName } from "@/lib/warranty-db";
import { cn } from "@/lib/utils";

export const myRepairsQueryKey = ["warranty", "my-repairs"] as const;

function toReceipt(r: ClaimedRepair): Receipt {
  return {
    trackId: r.trackId,
    customerName: r.customerName,
    customerPhone: r.customerPhone,
    deviceModel: r.deviceModel,
    serialNumber: r.serialNumber,
    issueDescription: r.issueDescription,
    warrantyDays: r.warrantyDays ?? DEFAULT_WARRANTY_DAYS,
    currentStatus: r.currentStatus as StatusName,
    createdAt: r.createdAt,
    statusHistory: r.statusHistory.map((s) => ({
      status: s.status as StatusName,
      updatedAt: s.updatedAt,
    })),
  };
}

export function MyRepairs({ onOpen }: { onOpen: (trackId: string) => void }) {
  const [trackId, setTrackId] = useState("");
  const qc = useQueryClient();
  const list = useServerFn(listMyRepairs);
  const claim = useServerFn(claimReceiptByTrackId);

  const { data, isLoading } = useQuery({
    queryKey: myRepairsQueryKey,
    queryFn: () => list({ data: undefined as never }),
  });

  const mutation = useMutation({
    mutationFn: (id: string) => claim({ data: { trackId: id } }),
    onSuccess: (res) => {
      if (res.ok) {
        setTrackId("");
        void qc.invalidateQueries({ queryKey: myRepairsQueryKey });
        toast.success(`Repair ${res.trackId} added to your account`);
      } else {
        toast.error(res.message);
      }
    },
    onError: () => toast.error("That Track ID couldn't be claimed. Check the ID and try again."),
  });

  const repairs = data ?? [];

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">My repairs</h2>
          <p className="text-sm text-muted-foreground">
            Repairs you&apos;ve added to your account with their Track ID.
          </p>
        </div>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const v = trackId.trim();
            if (v.length < 4) {
              toast.error("Enter a valid Track ID");
              return;
            }
            mutation.mutate(v.toUpperCase());
          }}
        >
          <Input
            value={trackId}
            onChange={(e) => setTrackId(e.target.value)}
            placeholder="WF-2026-XXXX"
            className="h-10 w-44 font-mono uppercase"
            autoComplete="off"
          />
          <Button type="submit" size="sm" className="h-10 gap-1.5" disabled={mutation.isPending}>
            <Plus className="h-4 w-4" />
            {mutation.isPending ? "Adding…" : "Add repair"}
          </Button>
        </form>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading your repairs…</p>
      ) : repairs.length === 0 ? (
        <EmptyState
          icon={PackageSearch}
          title="No repairs linked yet"
          description="Add a repair with its Track ID to keep its full history in your account."
        />
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {repairs.map((r) => {
            const receipt = toReceipt(r);
            const w = getWarrantyInfo(receipt);
            const Icon =
              w.state === "active" ? ShieldCheck : w.state === "expired" ? ShieldOff : ShieldAlert;
            return (
              <li
                key={r.trackId}
                className="rounded-xl border border-border bg-background p-4 transition-colors hover:border-primary/40"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-mono text-sm font-semibold text-foreground">
                      {r.trackId}
                    </div>
                    <div className="truncate text-sm text-muted-foreground">{r.deviceModel}</div>
                  </div>
                  <span className="shrink-0 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary">
                    {r.currentStatus}
                  </span>
                </div>
                <div
                  className={cn(
                    "mt-3 flex items-center gap-1.5 text-xs",
                    w.state === "active"
                      ? "text-success"
                      : w.state === "expired"
                        ? "text-destructive"
                        : "text-muted-foreground",
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {w.state === "active"
                    ? `Warranty active · ${w.daysRemaining} day${w.daysRemaining === 1 ? "" : "s"} left`
                    : w.state === "expired"
                      ? "Warranty expired"
                      : "Warranty starts on delivery"}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3 w-full"
                  onClick={() => onOpen(r.trackId)}
                >
                  View details
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
