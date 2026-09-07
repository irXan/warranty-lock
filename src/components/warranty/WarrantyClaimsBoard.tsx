import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { LifeBuoy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "./EmptyState";
import {
  listWorkshopWarrantyClaims,
  updateWarrantyClaimStatus,
  WARRANTY_CLAIM_STATUSES,
  type WarrantyClaimStatus,
} from "@/lib/warranty-claims.functions";
import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<WarrantyClaimStatus, string> = {
  Submitted: "bg-primary/10 text-primary",
  Reviewing: "bg-primary/10 text-primary",
  Approved: "bg-success/10 text-success",
  Rejected: "bg-destructive/10 text-destructive",
  Resolved: "bg-muted text-muted-foreground",
};

const fmt = (iso: string) =>
  new Date(iso).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

const workshopClaimsQueryKey = ["warranty", "workshop-warranty-claims"] as const;

export function WarrantyClaimsBoard() {
  const qc = useQueryClient();
  const list = useServerFn(listWorkshopWarrantyClaims);
  const update = useServerFn(updateWarrantyClaimStatus);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const { data, isLoading } = useQuery({
    queryKey: workshopClaimsQueryKey,
    queryFn: () => list({ data: undefined as never }),
  });

  const mutation = useMutation({
    mutationFn: (v: { claimId: string; status: WarrantyClaimStatus; note?: string }) =>
      update({ data: v }),
    onSuccess: (res, v) => {
      if (res.ok) {
        setNotes((n) => ({ ...n, [v.claimId]: "" }));
        void qc.invalidateQueries({ queryKey: workshopClaimsQueryKey });
        toast.success(`Claim moved to ${v.status}`);
      } else {
        toast.error(res.message ?? "Couldn't update that claim.");
      }
    },
    onError: () => toast.error("Couldn't update that claim."),
  });

  const claims = data ?? [];

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
      <div className="mb-5">
        <h2 className="text-lg font-semibold text-foreground">Warranty claims</h2>
        <p className="text-sm text-muted-foreground">
          Claims raised by customers for repairs in your workshop.
        </p>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading claims…</p>
      ) : claims.length === 0 ? (
        <EmptyState
          icon={LifeBuoy}
          title="No warranty claims"
          description="When a customer raises a claim on one of your repairs, it appears here."
        />
      ) : (
        <ul className="space-y-3">
          {claims.map((c) => (
            <li key={c.id} className="rounded-xl border border-border bg-background p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm text-foreground">
                  <span className="font-mono font-semibold">{c.trackId}</span> · {c.deviceModel} ·{" "}
                  <span className="text-muted-foreground">{c.customerName}</span>
                </div>
                <span
                  className={cn(
                    "rounded-full px-2.5 py-1 text-[11px] font-medium",
                    STATUS_STYLES[c.status],
                  )}
                >
                  {c.status}
                </span>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{c.reason}</p>

              <div className="mt-3 flex flex-col gap-2 border-t border-border pt-3 sm:flex-row sm:items-center">
                <Input
                  value={notes[c.id] ?? ""}
                  onChange={(e) => setNotes((n) => ({ ...n, [c.id]: e.target.value }))}
                  placeholder="Optional note for the history"
                  className="h-9 flex-1"
                />
                <div className="flex flex-wrap gap-1.5">
                  {WARRANTY_CLAIM_STATUSES.filter((s) => s !== c.status).map((s) => (
                    <Button
                      key={s}
                      variant="outline"
                      size="sm"
                      disabled={mutation.isPending}
                      onClick={() =>
                        mutation.mutate({ claimId: c.id, status: s, note: notes[c.id] })
                      }
                    >
                      {s}
                    </Button>
                  ))}
                </div>
              </div>

              <ol className="mt-3 space-y-1 text-xs text-muted-foreground">
                {c.events.map((e, i) => (
                  <li key={i} className="flex flex-wrap gap-2">
                    <span className="font-medium text-foreground">{e.status}</span>
                    <span>{fmt(e.createdAt)}</span>
                    {e.note && <span className="italic">“{e.note}”</span>}
                  </li>
                ))}
              </ol>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
