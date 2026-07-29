"use client";

import { BellIcon, BellOffIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { usePushSubscription } from "@/hooks/queries/usePushSubscription";

/**
 * Self-contained card that lets the signed-in user enable/disable browser
 * push notifications (e.g. order status updates). Renders a graceful
 * "not supported" state on browsers without the Push API.
 */
export default function PushNotificationsCard() {
  const { supported, permission, isSubscribed, checking, error, subscribe, unsubscribe, isPending } =
    usePushSubscription();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Push notifications</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Get notified in your browser when your order status changes.
        </p>

        {!supported ? (
          <Badge variant="muted">Not supported in this browser</Badge>
        ) : permission === "denied" ? (
          <Badge variant="warning">Notifications are blocked. Enable them in your browser settings.</Badge>
        ) : (
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant={isSubscribed ? "outline" : "default"}
              size="sm"
              disabled={checking || isPending}
              onClick={isSubscribed ? unsubscribe : subscribe}
            >
              {isSubscribed ? (
                <BellOffIcon data-icon="inline-start" aria-hidden="true" />
              ) : (
                <BellIcon data-icon="inline-start" aria-hidden="true" />
              )}
              {checking ? "Checking..." : isSubscribed ? "Disable notifications" : "Enable notifications"}
            </Button>
            {isSubscribed ? <Badge variant="success">Enabled</Badge> : null}
          </div>
        )}

        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </CardContent>
    </Card>
  );
}
