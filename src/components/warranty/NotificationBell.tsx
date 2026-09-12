import { Bell } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/hooks/use-auth";
import {
  listMyNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  notificationsQueryKey,
  type AppNotification,
} from "@/lib/notifications";
import { cn } from "@/lib/utils";

export function NotificationBell() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: items = [] } = useQuery({
    queryKey: notificationsQueryKey,
    queryFn: () => listMyNotifications(),
    enabled: !!user,
    refetchInterval: 60_000,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: notificationsQueryKey });
  const readOne = useMutation({ mutationFn: markNotificationRead, onSuccess: invalidate });
  const readAll = useMutation({ mutationFn: markAllNotificationsRead, onSuccess: invalidate });

  if (!user) return null;

  const unread = items.filter((n) => !n.readAt).length;

  const open = (n: AppNotification) => {
    if (!n.readAt) readOne.mutate(n.id);
    if (n.trackId && typeof window !== "undefined") {
      window.location.assign(`/?track=${encodeURIComponent(n.trackId)}`);
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="relative h-9 w-9 shrink-0"
          aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
        >
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(22rem,calc(100vw-2rem))] p-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <span className="text-sm font-semibold text-foreground">Notifications</span>
          {unread > 0 && (
            <button
              type="button"
              onClick={() => readAll.mutate()}
              className="text-xs font-medium text-primary hover:underline"
            >
              Mark all as read
            </button>
          )}
        </div>
        {items.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">
            No notifications yet.
          </p>
        ) : (
          <ScrollArea className="max-h-80">
            <ul className="divide-y divide-border">
              {items.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => open(n)}
                    className={cn(
                      "flex w-full flex-col items-start gap-1 px-4 py-3 text-left transition-colors hover:bg-muted/60",
                      !n.readAt && "bg-primary/5",
                    )}
                  >
                    <span className="flex w-full items-start gap-2">
                      {!n.readAt && (
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                      )}
                      <span className="text-sm font-medium text-foreground">{n.title}</span>
                    </span>
                    {n.body && (
                      <span className="text-xs text-muted-foreground">{n.body}</span>
                    )}
                    <span className="text-[11px] text-muted-foreground/80">
                      {new Date(n.createdAt).toLocaleString(undefined, {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </ScrollArea>
        )}
      </PopoverContent>
    </Popover>
  );
}
