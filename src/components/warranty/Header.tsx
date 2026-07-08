import { ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

export type View = "admin" | "customer";

interface HeaderProps {
  view: View;
  onChange: (v: View) => void;
}

export function Header({ view, onChange }: HeaderProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div className="leading-tight">
            <div className="text-base font-semibold tracking-tight text-foreground">
              Warranty Flow
            </div>
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
              Immutable repair receipts
            </div>
          </div>
        </div>

        <div
          role="tablist"
          aria-label="Switch view"
          className="inline-flex rounded-full border border-border bg-card p-1 text-sm shadow-sm"
        >
          <ViewButton active={view === "admin"} onClick={() => onChange("admin")}>
            Admin View
          </ViewButton>
          <ViewButton active={view === "customer"} onClick={() => onChange("customer")}>
            Customer View
          </ViewButton>
        </div>
      </div>
    </header>
  );
}

function ViewButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors sm:text-sm",
        active
          ? "bg-primary text-primary-foreground shadow"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}