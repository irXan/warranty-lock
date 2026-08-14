import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export interface AuthState {
  ready: boolean;
  session: Session | null;
  user: User | null;
  isAdmin: boolean;
  workshopId: string | null;
  workshopRole: "owner" | "staff" | null;
}

export function useAuth(): AuthState {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [workshopId, setWorkshopId] = useState<string | null>(null);
  const [workshopRole, setWorkshopRole] = useState<"owner" | "staff" | null>(null);

  useEffect(() => {
    let mounted = true;

    const loadRole = async (userId: string | undefined) => {
      if (!userId) {
        if (mounted) {
          setIsAdmin(false);
          setWorkshopId(null);
          setWorkshopRole(null);
        }
        return;
      }
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .eq("role", "admin")
        .maybeSingle();
      if (mounted) setIsAdmin(!!data);

      const { data: memberships } = await supabase
        .from("workshop_members")
        .select("workshop_id, role, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: true });
      const rows = memberships ?? [];
      const own = rows.find((r) => r.role === "owner") ?? rows[0];
      if (mounted) {
        setWorkshopId(own?.workshop_id ?? null);
        setWorkshopRole((own?.role as "owner" | "staff" | undefined) ?? null);
      }
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

  return { ready, session, user: session?.user ?? null, isAdmin, workshopId, workshopRole };
}