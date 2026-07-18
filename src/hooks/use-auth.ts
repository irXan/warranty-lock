import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export interface AuthState {
  ready: boolean;
  session: Session | null;
  user: User | null;
  isAdmin: boolean;
}

export function useAuth(): AuthState {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let mounted = true;

    const loadRole = async (userId: string | undefined) => {
      if (!userId) {
        if (mounted) setIsAdmin(false);
        return;
      }
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .eq("role", "admin")
        .maybeSingle();
      if (mounted) setIsAdmin(!!data);
    };

    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      if (!mounted) return;
      setSession(s);
      // Defer role fetch to avoid nested supabase calls inside the callback.
      setTimeout(() => void loadRole(s?.user.id), 0);
    });

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      void loadRole(data.session?.user.id).finally(() => {
        if (mounted) setReady(true);
      });
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { ready, session, user: session?.user ?? null, isAdmin };
}