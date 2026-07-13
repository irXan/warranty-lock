import { useState } from "react";
import { AlertCircle, Search, ShieldCheck, ShieldOff, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { findByTrackId, getWarrantyInfo, type Receipt } from "@/lib/warranty-db";
import { useReceipts } from "@/hooks/use-warranty-db";
import { StatusStepper } from "./StatusStepper";
import { cn } from "@/lib/utils";

export function CustomerPanel() {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<Receipt | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searchedId, setSearchedId] = useState<string | null>(null);

  // Live-update the shown receipt if admin advances status in another tab / view.
  const receipts = useReceipts();
  const liveResult =
    searchedId != null ? receipts.find((r) => r.trackId === searchedId) ?? null : result;

  const submit = (e?: React.FormEvent) => {
    e?.preventDefault();
    const q = query.trim();
    if (!q) return;
    const found = findByTrackId(q);
    if (!found) {
      setResult(null);
      setSearchedId(null);
      setError(
        "No active repair file found for this ID. Please check your spelling or contact the workshop.",
      );
      return;
    }
    setResult(found);
    setSearchedId(found.trackId);
    setError(null);
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
        <div className="mx-auto max-w-xl text-center">
          <div className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-[11px] font-medium uppercase tracking-wider text-primary">
            Live tracking
          </div>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Track your repair
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Enter the Track ID your workshop provided to see real-time status.
          </p>

          <form onSubmit={submit} className="mt-6 flex flex-col gap-2 sm:flex-row">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Enter your Track ID (e.g., WF-2026-XXXX)"
              className="h-11 flex-1 font-mono uppercase"
              autoComplete="off"
            />
            <Button type="submit" size="lg" className="gap-2">
              <Search className="h-4 w-4" />
              Track my device
            </Button>
          </form>

          {error && (
            <div
              role="alert"
              className="mt-4 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-left text-sm text-destructive"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>{error}</p>
            </div>
          )}
        </div>
      </div>

      {liveResult && <ReceiptDashboard receipt={liveResult} />}
    </div>
  );
}

function ReceiptDashboard({ receipt }: { receipt: Receipt }) {
  return (
    <div className="space-y-6 rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
        <div>
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
            Track ID
          </div>
          <div className="font-mono text-lg font-semibold text-foreground">{receipt.trackId}</div>
        </div>
        <div className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
          {receipt.currentStatus}
        </div>
      </div>

      <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <MetaRow label="Customer" value={receipt.customerName} />
        <MetaRow label="Device" value={receipt.deviceModel} />
        <MetaRow label="Serial / IMEI" value={receipt.serialNumber} mono />
        <MetaRow
          label="Reported"
          value={new Date(receipt.createdAt).toLocaleString(undefined, {
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        />
        <div className="sm:col-span-2">
          <MetaRow label="Issue" value={receipt.issueDescription} block />
        </div>
      </dl>

      <WarrantyCard receipt={receipt} />

      <div className="pt-2">
        <h3 className="mb-4 text-sm font-semibold text-foreground">Progress</h3>
        <StatusStepper receipt={receipt} />
      </div>
    </div>
  );
}

function WarrantyCard({ receipt }: { receipt: Receipt }) {
  const w = getWarrantyInfo(receipt);
  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });

  const styles =
    w.state === "active"
      ? "border-success/30 bg-success/5 text-success"
      : w.state === "expired"
        ? "border-destructive/30 bg-destructive/5 text-destructive"
        : "border-border bg-muted/40 text-muted-foreground";

  const Icon = w.state === "active" ? ShieldCheck : w.state === "expired" ? ShieldOff : ShieldAlert;
  const heading =
    w.state === "active"
      ? "Warranty active"
      : w.state === "expired"
        ? "Warranty expired"
        : "Warranty starts on delivery";

  return (
    <div className={cn("flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between", styles)}>
      <div className="flex items-start gap-3">
        <Icon className="mt-0.5 h-5 w-5 shrink-0" />
        <div>
          <div className="text-sm font-semibold">{heading}</div>
          <div className="mt-0.5 text-xs opacity-80">
            {w.state === "pending" && `${w.days}-day cover begins the moment the device is marked Delivered.`}
            {w.state === "active" && w.expiresAt && (
              <>
                {w.daysRemaining} day{w.daysRemaining === 1 ? "" : "s"} left · expires {fmtDate(w.expiresAt)}
              </>
            )}
            {w.state === "expired" && w.expiresAt && <>Expired on {fmtDate(w.expiresAt)}</>}
          </div>
        </div>
      </div>
      {w.state !== "pending" && (
        <div className="text-right text-xs">
          <div className="opacity-70">Period</div>
          <div className="font-medium">{w.days} days</div>
        </div>
      )}
    </div>
  );
}

function MetaRow({
  label,
  value,
  mono,
  block,
}: {
  label: string;
  value: string;
  mono?: boolean;
  block?: boolean;
}) {
  return (
    <div>
      <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd
        className={
          (mono ? "font-mono text-sm " : "text-sm ") +
          (block ? "mt-1 whitespace-pre-wrap text-foreground" : "mt-0.5 text-foreground")
        }
      >
        {value}
      </dd>
    </div>
  );
}