import { ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  variant?: "full" | "compact";
  className?: string;
}

/** Reinforces Warranty Flow's core value prop: the receipt cannot be
 *  edited or deleted after issue. Rendered on receipt views. */
export function ImmutableBadge({ variant = "full", className }: Props) {
  if (variant === "compact") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-full border border-success/30 bg-success/10 px-2 py-0.5 text-[11px] font-medium text-success",
          className,
        )}
        title="Customer and device details cannot be modified after receipt creation."
      >
        <ShieldCheck className="h-3 w-3" aria-hidden />
        Verified Immutable Record
      </span>
    );
  }
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-xl border border-success/30 bg-success/5 p-3.5",
        className,
      )}
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-success/15 text-success">
        <ShieldCheck className="h-4 w-4" aria-hidden />
      </div>
      <div className="min-w-0 text-xs leading-relaxed">
        <div className="text-sm font-semibold text-success">Verified Immutable Record</div>
        <p className="mt-0.5 text-muted-foreground">
          Customer and device information cannot be modified after receipt creation.
          Only repair status can be updated.
        </p>
      </div>
    </div>
  );
}