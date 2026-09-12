import { supabase } from "@/integrations/supabase/client";

export type AppNotification = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  trackId: string | null;
  claimId: string | null;
  readAt: string | null;
  createdAt: string;
};

export const notificationsQueryKey = ["notifications"] as const;

/** Latest notifications for the signed-in user (RLS scopes this to them). */
export async function listMyNotifications(limit = 30): Promise<AppNotification[]> {
  const { data, error } = await supabase
    .from("notifications")
    .select("id, type, title, body, track_id, claim_id, read_at, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((n) => ({
    id: n.id,
    type: n.type,
    title: n.title,
    body: n.body,
    trackId: n.track_id,
    claimId: n.claim_id,
    readAt: n.read_at,
    createdAt: n.created_at,
  }));
}

export async function markNotificationRead(id: string): Promise<void> {
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id)
    .is("read_at", null);
  if (error) throw error;
}

export async function markAllNotificationsRead(): Promise<void> {
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .is("read_at", null);
  if (error) throw error;
}
