import { useState } from "react";
import { Check, Copy } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface Props {
  trackId: string | null;
  onClose: () => void;
}

export function TrackIdModal({ trackId, onClose }: Props) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    if (!trackId) return;
    try {
      await navigator.clipboard.writeText(trackId);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <Dialog
      open={!!trackId}
      onOpenChange={(open) => {
        if (!open) {
          setCopied(false);
          onClose();
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Receipt locked</DialogTitle>
          <DialogDescription>
            The repair record is now immutable. Share this Track ID with your customer so they can
            follow progress in real time.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border border-border bg-muted/40 p-4">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
            Track ID
          </div>
          <div className="mt-1 font-mono text-2xl font-semibold tracking-tight text-foreground">
            {trackId}
          </div>
        </div>

        <DialogFooter className="sm:justify-between">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button onClick={copy} className="gap-2">
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? "Copied" : "Copy to clipboard"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}