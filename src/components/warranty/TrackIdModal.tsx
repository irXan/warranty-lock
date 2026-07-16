import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { toast } from "sonner";
import { Check, Copy, Printer } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { findByTrackId } from "@/lib/warranty-db";
import { printReceipt } from "@/lib/print-receipt";
import { buildTrackUrl } from "@/lib/receipt-share";
import { ImmutableBadge } from "./ImmutableBadge";

interface Props {
  trackId: string | null;
  onClose: () => void;
}

export function TrackIdModal({ trackId, onClose }: Props) {
  const [copied, setCopied] = useState(false);
  const [qr, setQr] = useState<string | null>(null);

  useEffect(() => {
    if (!trackId) {
      setQr(null);
      return;
    }
    const receipt = findByTrackId(trackId);
    const url = receipt
      ? buildTrackUrl(receipt)
      : `${window.location.origin}/?track=${encodeURIComponent(trackId)}`;
    QRCode.toDataURL(url, { width: 200, margin: 1, color: { dark: "#0f172a", light: "#ffffff" } })
      .then(setQr)
      .catch(() => setQr(null));
  }, [trackId]);

  const copy = async () => {
    if (!trackId) return;
    try {
      await navigator.clipboard.writeText(trackId);
      setCopied(true);
      toast.success("Track ID copied to clipboard");
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("Could not copy — clipboard unavailable");
    }
  };

  const print = async () => {
    if (!trackId) return;
    const r = findByTrackId(trackId);
    if (r) {
      await printReceipt(r);
      toast.success("Opened printable receipt");
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

        <ImmutableBadge />

        <div className="flex items-center gap-4 rounded-lg border border-border bg-muted/40 p-4">
          <div className="flex-1">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
              Track ID
            </div>
            <div className="mt-1 font-mono text-2xl font-semibold tracking-tight text-foreground">
              {trackId}
            </div>
            <div className="mt-2 text-[11px] text-muted-foreground">
              Scan the QR code to open live tracking.
            </div>
          </div>
          {qr && (
            <img
              src={qr}
              alt="QR code linking to live tracking"
              className="h-24 w-24 rounded border border-border bg-white p-1"
            />
          )}
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={print} className="gap-2">
              <Printer className="h-4 w-4" />
              Print
            </Button>
            <Button onClick={copy} className="gap-2">
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? "Copied" : "Copy ID"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}