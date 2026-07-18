import { Lock, LogOut } from "lucide-react";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

interface Props {
  children: React.ReactNode;
}

export function AdminAuthGate({ children }: Props) {
  const { ready, user, isAdmin } = useAuth();
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
        <Button
          variant="outline"
          className="mt-4 w-full"
          onClick={async () => {
            await supabase.auth.signOut();
            toast.success("Signed out");
          }}
        >
          Sign out
        </Button>
      )}
    </div>
  );
}