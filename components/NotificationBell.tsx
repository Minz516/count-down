"use client";

import { useEffect, useRef, useState } from "react";
import { Bell, CheckCircle, Trash } from "@phosphor-icons/react/ssr";
import { clsx } from "clsx";
import { useAppDispatch, useAppSelector } from "@/lib/store/hooks";
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  removeNotification,
} from "@/lib/store/notificationsSlice";
import { fetchSession } from "@/lib/store/sessionSlice";
import { formatRelativeTime } from "@/lib/dateFormat";
import type { NotificationDTO } from "@/modules/notifications/notifications.interface";

/**
 * Account-scoped notification bell (event passed / due today-tomorrow -
 * generated server-side by supabase/functions/daily-digest/index.ts, never
 * created by the client) - shared by Nav.tsx/GroupNav.tsx like UserMenu.tsx.
 *
 * Reads from lib/store/sessionSlice.ts and lib/store/notificationsSlice.ts rather than
 * fetching on every mount, for the same reason UserMenu.tsx does: Nav/GroupNav render a
 * fresh instance on every tab switch, so a per-mount fetch meant re-hitting Supabase
 * Auth + the notifications table on every navigation. Both fetches dispatch only while
 * their slice's status is still "idle", so only the very first mount (of either this or
 * UserMenu.tsx - each guards its own idle check the same way, so whichever mounts first
 * wins and the other's dispatch is a no-op) does any network work.
 */
export function NotificationBell() {
  const dispatch = useAppDispatch();
  const [open, setOpen] = useState(false);
  const userId = useAppSelector((state) => state.session.userId);
  const sessionStatus = useAppSelector((state) => state.session.status);
  const notifications = useAppSelector((state) => state.notifications.items);
  const notificationsStatus = useAppSelector((state) => state.notifications.status);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (sessionStatus === "idle") {
      void dispatch(fetchSession());
    }
  }, [sessionStatus, dispatch]);

  useEffect(() => {
    if (userId && notificationsStatus === "idle") {
      void dispatch(fetchNotifications(userId));
    }
  }, [userId, notificationsStatus, dispatch]);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const unreadCount = notifications?.filter((notification) => !notification.is_read).length ?? 0;

  function handleMarkRead(notification: NotificationDTO) {
    if (!userId || notification.is_read) return;
    void dispatch(markNotificationRead({ userId, id: notification.id }));
  }

  function handleMarkAllRead() {
    if (!userId) return;
    void dispatch(markAllNotificationsRead(userId));
  }

  /** A real delete, not a soft-hide - notifications.repository.ts's remove() is a plain
   * `.delete()` against the table, and the row is gone from the database, not just the list. */
  function handleDelete(notification: NotificationDTO) {
    if (!userId) return;
    void dispatch(removeNotification({ userId, id: notification.id }));
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label="Notifications"
        aria-haspopup="menu"
        aria-expanded={open}
        className="relative rounded p-1.5 text-text-muted transition-colors hover:text-on-surface"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute top-0.5 right-0.5 flex size-2 rounded-full bg-error" />
        )}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-20 mt-2 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-lg border border-primary-container/15 bg-surface-elevated"
        >
          <div className="flex items-center justify-between px-3 py-2.5">
            <span className="font-mono text-xs font-medium tracking-[0.1em] text-text-muted uppercase">
              Notifications
            </span>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="flex items-center gap-1 font-body text-xs text-primary transition-colors hover:text-on-surface"
              >
                <CheckCircle size={14} />
                Mark all as read
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto border-t border-primary-container/10">
            {notifications === null ? (
              <p className="px-3 py-4 text-center font-body text-sm text-text-muted">Loading...</p>
            ) : notifications.length === 0 ? (
              <p className="px-3 py-4 text-center font-body text-sm text-text-muted">
                No notifications yet.
              </p>
            ) : (
              notifications.map((notification) => (
                // A div, not a nested <button> - it contains its own delete button, and a
                // button can't validly contain another button (same pattern as
                // EventListItem.tsx's whole-card click target).
                <div
                  key={notification.id}
                  role="menuitem"
                  tabIndex={0}
                  onClick={() => handleMarkRead(notification)}
                  onKeyDown={(keyEvent) => {
                    if (keyEvent.key === "Enter" || keyEvent.key === " ") {
                      keyEvent.preventDefault();
                      handleMarkRead(notification);
                    }
                  }}
                  className="group flex w-full cursor-pointer items-start gap-2.5 border-b border-primary-container/10 px-3 py-2.5 text-left transition-colors last:border-b-0 hover:bg-surface-container focus-visible:outline-2 focus-visible:outline-primary/50 focus-visible:outline-offset-2"
                >
                  <span
                    aria-hidden
                    className={clsx(
                      "mt-1.5 size-2 shrink-0 rounded-full",
                      notification.is_read ? "bg-transparent" : "bg-primary",
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <p
                      className={clsx(
                        "font-body text-sm",
                        notification.is_read ? "text-text-muted" : "text-on-surface",
                      )}
                    >
                      {notification.message}
                    </p>
                    <p className="mt-0.5 font-mono text-[11px] text-text-muted">
                      {formatRelativeTime(notification.created_at)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={(clickEvent) => {
                      clickEvent.stopPropagation();
                      handleDelete(notification);
                    }}
                    aria-label="Delete notification"
                    className="shrink-0 rounded p-1 text-text-muted opacity-0 transition-opacity group-hover:opacity-100 hover:text-error focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-primary/50 focus-visible:outline-offset-2"
                  >
                    <Trash size={14} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
