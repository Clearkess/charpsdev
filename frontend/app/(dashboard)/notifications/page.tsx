"use client";

import { useState } from "react";
import { BellIcon, CheckIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyBlock, ErrorBlock, TableSkeleton } from "@/components/common/StateBlock";
import { useMarkNotificationReadMutation, useNotificationsQuery } from "@/hooks/queries/useNotificationsQueries";
import { extractErrorMessage } from "@/lib/api";
import { formatDate } from "@/lib/format";

export default function NotificationsPage() {
  const notifications = useNotificationsQuery();
  const markRead = useMarkNotificationReadMutation();
  const [message, setMessage] = useState<string | null>(null);

  if (notifications.isPending) return <TableSkeleton rows={4} cols={2} />;
  if (notifications.error) return <ErrorBlock message={extractErrorMessage(notifications.error, "Failed to load notifications.")} />;
  const items = notifications.data?.data || [];
  if (!items.length) {
    return <EmptyBlock title="No notifications" description="You're all caught up — new notifications will appear here." />;
  }

  const onMarkRead = async (id: number) => {
    setMessage(null);
    try {
      const response = await markRead.mutateAsync(id);
      setMessage(response.message);
    } catch (error) {
      setMessage(extractErrorMessage(error, "Failed to mark notification as read."));
    }
  };

  return (
    <section className="space-y-4">
      <h1 className="font-heading text-3xl font-bold">Notifications</h1>
      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
      <div className="space-y-3">
        {items.map((item) => (
          <Card key={item.id}>
            <CardContent className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <BellIcon className="size-4" aria-hidden="true" />
                </div>
                <div>
                  <h2 className="font-semibold">{item.title || `Notification #${item.id}`}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">{item.message || "No message text available."}</p>
                  <p className="mt-2 text-xs text-muted-foreground">{formatDate(item.created_at)}</p>
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <Badge variant={item.is_read ? "muted" : "default"}>{item.is_read ? "Read" : "Unread"}</Badge>
                {!item.is_read ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void onMarkRead(item.id)}
                    disabled={markRead.isPending && markRead.variables === item.id}
                  >
                    <CheckIcon data-icon="inline-start" aria-hidden="true" />
                    {markRead.isPending && markRead.variables === item.id ? "Saving..." : "Mark as read"}
                  </Button>
                ) : null}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
