import { useState } from "react";
import { Lock, LogOut, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { claimWorkshopOwnership } from "@/lib/workshop.functions";

interface Props {
  children: React.ReactNode;
}

export function AdminAuthGate({ children }: Props) {
  const { ready, user, isAdmin } = useAuth();
  const claim = useServerFn(claimWorkshopOwnership);
  const [claiming, setClaiming] = useState(false);

  if (!ready) {
    return (
      <div className="mx-auto max-w-md rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  if (user && isAdmin) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-end gap-3">
          <span className="text-xs text-muted-foreground">
            Signed in as <span className="font-medium text-foreground">{user.email}</span>
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="gap-2 text-muted-foreground"
            onClick={async () => {
              await supabase.auth.signOut();
              toast.success("Signed out");
            }}
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </Button>
        </div>
        {children}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md rounded-2xl border border-border bg-card p-6 text-center shadow-sm sm:p-8">
      <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Lock className="h-5 w-5" />
      </div>
      <h2 className="mt-3 text-lg font-semibold text-foreground">Admin sign-in required</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {user
          ? "You're signed in but don't have workshop admin access yet. An existing admin can grant your account the admin role."
          : "Sign in with your workshop account to access receipts."}
      </p>
      {!user && (
        <Button asChild className="mt-4 w-full">
          <Link to="/auth">Go to sign in</Link>
        </Button>
      )}
      {user && (
        <div className="mt-4 space-y-2">
          <Button
            className="w-full gap-2"
            disabled={claiming}
            onClick={async () => {
              setClaiming(true);
              try {
                await claim({});
                toast.success("You're now the workshop owner — reloading…");
                window.location.reload();
              } catch (err) {
                toast.error(
                  err instanceof Error ? err.message : "Could not claim workshop ownership",
                );
              } finally {
                setClaiming(false);
              }
            }}
          >
            <ShieldCheck className="h-4 w-4" />
            {claiming ? "Setting up…" : "Claim workshop ownership"}
          </Button>
          <p className="text-[11px] text-muted-foreground">
            Available only until the first owner is set up.
          </p>
          <Button
            variant="outline"
            className="w-full"
            onClick={async () => {
              await supabase.auth.signOut();
              toast.success("Signed out");
            }}
          >
            Sign out
          </Button>
        </div>
      )}
    </div>
  );
}