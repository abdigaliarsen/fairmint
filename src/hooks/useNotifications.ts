"use client";

import { useState, useEffect, useCallback } from "react";
import type { Notification } from "@/types/database";

interface UseNotificationsReturn {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  markAsRead: (ids?: string[]) => Promise<void>;
  markAllRead: () => Promise<void>;
  refetch: () => void;
}

export function useNotifications(
  wallet: string | null
): UseNotificationsReturn {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const fetchNotifications = useCallback(async () => {
    if (!wallet) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(
        `/api/notifications?wallet=${encodeURIComponent(wallet)}`
      );
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications ?? []);
        setUnreadCount(data.unreadCount ?? 0);
      }
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  }, [wallet]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const markAsRead = useCallback(
    async (ids?: string[]) => {
      if (!wallet) return;
      try {
        await fetch("/api/notifications", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ wallet, notificationIds: ids }),
        });
        await fetchNotifications();
      } catch {
        // Silently fail
      }
    },
    [wallet, fetchNotifications]
  );

  const markAllRead = useCallback(async () => {
    if (!wallet) return;
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet, markAllRead: true }),
      });
      setUnreadCount(0);
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch {
      // Silently fail
    }
  }, [wallet]);

  return {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllRead,
    refetch: fetchNotifications,
  };
}
