import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { LifeBuoy, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "./EmptyState";
import {
  listMyWarrantyClaims,
  submitWarrantyClaim,
  type WarrantyClaimStatus,
} from "@/lib/warranty-claims.functions";
import { listMyRepairs } from "@/lib/customer-claims.functions";
import { DEFAULT_WARRANTY_DAYS, getWarrantyInfo, type StatusName } from "@/lib/warranty-db";
import { cn } from "@/lib/utils";

export const myWarrantyClaimsQueryKey = ["warranty", "my-warranty-claims"] as const;

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

export function MyWarrantyClaims() {
  const qc = useQueryClient();
  const listClaims = useServerFn(listMyWarrantyClaims);
  const listRepairs = useServerFn(listMyRepairs);
  const submit = useServerFn(submitWarrantyClaim);

  const [trackId, setTrackId] = useState("");
  const [reason, setReason] = useState("");

  const { data: claims, isLoading } = useQuery({
    queryKey: myWarrantyClaimsQueryKey,
    queryFn: () => listClaims({ data: undefined as never }),
  });

  const { data: repairs } = useQuery({
    queryKey: ["warranty", "my-repairs"],
    queryFn: () => listRepairs({ data: undefined as never }),
  });

  const eligible = (repairs ?? []).filter((r) => {
    const info = getWarrantyInfo({
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
    });
    return info.state === "active";
  });

  const mutation = useMutation({
    mutationFn: () => submit({ data: { trackId, reason: reason.trim() } }),
    onSuccess: (res) => {
      if (res.ok) {
        setReason("");
        setTrackId("");
        void qc.invalidateQueries({ queryKey: myWarrantyClaimsQueryKey });
        toast.success("Warranty claim submitted");
      } else {
        toast.error(res.message);
      }
    },
    onError: () => toast.error("Couldn't submit that claim. Please try again."),
  });

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
      <div className="mb-5">
        <h2 className="text-lg font-semibold text-foreground">Warranty claims</h2>
        <p className="text-sm text-muted-foreground">
          Raise a claim for a repair in your account that is still under warranty.
        </p>
      </div>

      <form
        className="mb-6 space-y-3 rounded-xl border border-border bg-background p-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!trackId) {
            toast.error("Choose a repair to claim against");
            return;
          }
          if (reason.trim().length < 10) {
            toast.error("Describe the problem in at least 10 characters");
            return;
          }
          mutation.mutate();
        }}
      >
        <div>
          <label
            htmlFor="claim-repair"
            className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground"
          >
            Repair
          </label>
          <select
            id="claim-repair"
            value={trackId}
            onChange={(e) => setTrackId(e.target.value)}
            className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
          >
            <option value="">
              {eligible.length === 0 ? "No repairs under active warranty" : "Select a repair…"}
            </option>
            {eligible.map((r) => (
              <option key={r.trackId} value={r.trackId}>
                {r.trackId} · {r.deviceModel}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label
            htmlFor="claim-reason"
            className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground"
          >
            What went wrong?
          </label>
          <Textarea
            id="claim-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Describe the fault you're experiencing after the repair."
            className="mt-1 min-h-24"
          />
        </div>
        <Button type="submit" size="sm" className="gap-1.5" disabled={mutation.isPending}>
          <Send className="h-4 w-4" />
          {mutation.isPending ? "Submitting…" : "Submit claim"}
        </Button>
      </form>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading your claims…</p>
      ) : (claims ?? []).length === 0 ? (
        <EmptyState
          icon={LifeBuoy}
          title="No warranty claims yet"
          description="If something goes wrong after a repair, submit a claim and track its progress here."
        />
      ) : (
        <ul className="space-y-3">
          {(claims ?? []).map((c) => (
            <li key={c.id} className="rounded-xl border border-border bg-background p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="font-mono text-sm font-semibold text-foreground">
                  {c.trackId} · <span className="font-sans font-normal">{c.deviceModel}</span>
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
              <ol className="mt-3 space-y-1 border-t border-border pt-3 text-xs text-muted-foreground">
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
