import { Bell } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/dates";
import { apiFetch } from "@/lib/api";
import { getUser } from "@/lib/auth";
import { cn } from "@/lib/utils";

export type NotificationItem = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  relatedAppointmentId: string | null;
  readAt: string | null;
  createdAt: string;
};

export function NotificationBell() {
  const user = getUser();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const panelRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const data = await apiFetch<{ notifications: NotificationItem[] }>(
        `/api/notifications?userId=${encodeURIComponent(user.id)}`
      );
      setNotifications(data.notifications);
    } catch {
      /* ignore poll errors */
    }
  }, [user]);

  useEffect(() => {
    void load();
    const interval = setInterval(() => void load(), 30_000);
    return () => clearInterval(interval);
  }, [load]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  async function markRead(ids: string[]) {
    await apiFetch("/api/notifications", {
      method: "POST",
      body: JSON.stringify({ notificationIds: ids })
    });
    await load();
  }

  async function markAllRead() {
    await apiFetch("/api/notifications", {
      method: "POST",
      body: JSON.stringify({ markAll: true })
    });
    await load();
  }

  const unreadCount = notifications.length;

  return (
    <div className="relative" ref={panelRef}>
      <Button
        variant="outline"
        size="icon"
        className="relative"
        aria-label="Notifications"
        onClick={() => setOpen((v) => !v)}
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 ? (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        ) : null}
      </Button>

      {open ? (
        <div className="absolute right-0 z-50 mt-2 w-80 rounded-lg border bg-popover text-popover-foreground shadow-lg">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <p className="text-sm font-semibold">Notifications</p>
            {unreadCount > 0 ? (
              <button
                type="button"
                className="text-xs text-primary hover:underline"
                onClick={() => void markAllRead()}
              >
                Mark all read
              </button>
            ) : null}
          </div>
          <ul className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <li className="px-4 py-6 text-center text-sm text-muted-foreground">
                No unread notifications
              </li>
            ) : (
              notifications.map((n) => (
                <li key={n.id} className="border-b last:border-0">
                  <button
                    type="button"
                    className={cn(
                      "w-full px-4 py-3 text-left text-sm hover:bg-accent",
                      !n.readAt && "bg-muted/40"
                    )}
                    onClick={() => void markRead([n.id])}
                  >
                    <p className="font-medium">{n.title}</p>
                    {n.body ? (
                      <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{n.body}</p>
                    ) : null}
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      {formatDateTime(n.createdAt)}
                    </p>
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
