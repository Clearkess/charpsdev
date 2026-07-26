"use client";

import { useState } from "react";
import { useApiQuery } from "@/hooks/useApiQuery";
import { markNotificationRead, selectors } from "@/lib/backend";
import { formatDate } from "@/lib/format";
import { EmptyBlock, ErrorBlock, LoadingBlock } from "@/components/common/StateBlock";
import type { NotificationItem, PaginatedResponse } from "@/types/api";

export default function NotificationsPage() {
  const notifications = useApiQuery<PaginatedResponse<NotificationItem>, PaginatedResponse<NotificationItem>>("/notifications", { select: selectors.notifications });
  const [message, setMessage] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  if (notifications.loading) return <LoadingBlock label="Loading notifications..." />;
  if (notifications.error) return <ErrorBlock message={notifications.error} />;
  if (!notifications.data?.data?.length) return <EmptyBlock title="No notifications" description="This endpoint returns a raw paginator object; its `data` array is currently empty." />;

  const onMarkRead = async (id: number) => {
    setBusyId(id);
    setMessage(null);
    try {
      const response = await markNotificationRead(id);
      setMessage(response.message);
      notifications.refetch();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to mark notification as read.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="space-y-4">
      <h1 className="text-3xl font-bold">Notifications</h1>
      {message ? <p className="text-sm text-neutral-600">{message}</p> : null}
      <div className="space-y-3">
        {notifications.data.data.map((item) => (
          <div key={item.id} className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="font-semibold">{item.title || `Notification #${item.id}`}</h2>
                <p className="mt-1 text-sm text-neutral-600">{item.message || "No message text available."}</p>
              </div>
              <div className="text-right">
                <span className={`rounded-full px-3 py-1 text-xs font-medium ${item.is_read ? "bg-neutral-100 text-neutral-600" : "bg-blue-100 text-blue-700"}`}>{item.is_read ? "Read" : "Unread"}</span>
                {!item.is_read ? <button onClick={() => void onMarkRead(item.id)} disabled={busyId === item.id} className="mt-2 block rounded-lg bg-neutral-900 px-3 py-2 text-xs text-white">{busyId === item.id ? "Saving..." : "Mark as read"}</button> : null}
              </div>
            </div>
            <p className="mt-3 text-xs text-neutral-400">{formatDate(item.created_at)}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
