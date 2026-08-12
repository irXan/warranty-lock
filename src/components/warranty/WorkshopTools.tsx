import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { DatabaseBackup, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { grantWorkshopAdmin, importLegacyReceipts } from "@/lib/workshop.functions";
import { receiptsQueryKey } from "@/lib/warranty-repo";

const LEGACY_KEY = "warranty_flow_db";

type LegacyReceipt = {
  trackId: string;
  customerName: string;
  customerPhone?: string;
  deviceModel?: string;
  serialNumber?: string;
  issueDescription?: string;
  warrantyDays?: number;
  createdAt: string;
  currentStatus: string;
  statusHistory?: { status: string; updatedAt: string }[];
};

function readLegacyReceipts(): LegacyReceipt[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(LEGACY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    const list = Array.isArray(parsed)
      ? parsed
      : ((parsed as { receipts?: unknown })?.receipts ?? []);
    return Array.isArray(list) ? (list as LegacyReceipt[]) : [];
  } catch {
    return [];
  }
}

export function WorkshopTools() {
  const queryClient = useQueryClient();
  const grant = useServerFn(grantWorkshopAdmin);
  const importFn = useServerFn(importLegacyReceipts);
  const [email, setEmail] = useState("");
  const [granting, setGranting] = useState(false);
  const [importing, setImporting] = useState(false);
  const legacyCount = readLegacyReceipts().length;

  const onGrant = async (e: React.FormEvent) => {
    e.preventDefault();
    setGranting(true);
    try {
      const res = await grant({ data: { email } });
      toast.success(`Admin access granted to ${res.granted}`);
      setEmail("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not grant admin access");
    } finally {
      setGranting(false);
    }
  };

  const onImport = async () => {
    const receipts = readLegacyReceipts();
    if (receipts.length === 0) {
      toast.info("No legacy receipts found in this browser");
      return;
    }
    setImporting(true);
    try {
      const res = await importFn({
        data: {
          receipts: receipts.map((r) => ({
            trackId: r.trackId,
            customerName: r.customerName,
            customerPhone: r.customerPhone ?? "",
            deviceModel: r.deviceModel ?? "",
            serialNumber: r.serialNumber ?? "",
            issueDescription: r.issueDescription ?? "",
            warrantyDays: r.warrantyDays ?? 90,
            createdAt: r.createdAt,
            currentStatus: r.currentStatus,
            statusHistory: r.statusHistory ?? [],
          })),
        },
      });
      window.localStorage.removeItem(LEGACY_KEY);
      await queryClient.invalidateQueries({ queryKey: receiptsQueryKey });
      toast.success(`Imported ${res.imported} receipt(s), skipped ${res.skipped} duplicate(s)`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImporting(false);
    }
  };

  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
      <h2 className="text-sm font-semibold text-foreground">Workshop settings</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Manage staff access and bring across receipts created before the cloud upgrade.
      </p>

      <form onSubmit={onGrant} className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="flex-1 space-y-1.5">
          <Label htmlFor="grant-email" className="text-xs">
            Grant admin access by email
          </Label>
          <Input
            id="grant-email"
            type="email"
            required
            placeholder="staff@workshop.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <Button type="submit" variant="outline" className="gap-2" disabled={granting}>
          <UserPlus className="h-4 w-4" />
          {granting ? "Granting…" : "Grant access"}
        </Button>
      </form>

      {legacyCount > 0 && (
        <div className="mt-4 flex flex-col gap-2 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            {legacyCount} receipt(s) from the old offline storage found in this browser.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={onImport}
            disabled={importing}
          >
            <DatabaseBackup className="h-4 w-4" />
            {importing ? "Importing…" : "Import legacy receipts"}
          </Button>
        </div>
      )}
    </section>
  );
}
