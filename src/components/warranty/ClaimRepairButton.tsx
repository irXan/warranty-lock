import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { BadgePlus, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  claimReceiptByTrackId,
  isTrackIdClaimedByMe,
} from "@/lib/customer-claims.functions";
import { myRepairsQueryKey } from "./MyRepairs";

/** Shown on a public tracking result when the visitor is signed in, so they can
 * link the repair to their account. Claiming is the only way private history
 * becomes visible to a customer account. */
export function ClaimRepairButton({ trackId }: { trackId: string }) {
  const qc = useQueryClient();
  const check = useServerFn(isTrackIdClaimedByMe);
  const claim = useServerFn(claimReceiptByTrackId);

  const { data: claimed } = useQuery({
    queryKey: ["warranty", "claimed-by-me", trackId.toUpperCase()],
    queryFn: () => check({ data: { trackId } }),
  });

  const mutation = useMutation({
    mutationFn: () => claim({ data: { trackId } }),
    onSuccess: (res) => {
      if (res.ok) {
        void qc.invalidateQueries({ queryKey: myRepairsQueryKey });
        void qc.invalidateQueries({ queryKey: ["warranty", "claimed-by-me", trackId.toUpperCase()] });
        toast.success("Repair added to your account");
      } else {
        toast.error(res.message);
      }
    },
    onError: () => toast.error("That Track ID couldn't be claimed. Check the ID and try again."),
  });

  if (claimed) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-3 py-1 text-xs font-medium text-success">
        <Check className="h-3.5 w-3.5" />
        In your account
      </span>
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      className="gap-2"
      disabled={mutation.isPending}
      onClick={() => mutation.mutate()}
    >
      <BadgePlus className="h-3.5 w-3.5" />
      {mutation.isPending ? "Adding…" : "Claim this repair"}
    </Button>
  );
}
