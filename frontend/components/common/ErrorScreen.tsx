"use client";

import Link from "next/link";
import { RefreshCwIcon, TriangleAlertIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

/**
 * Shared "something went wrong" screen used by every route-segment error.tsx
 * boundary (and, in a self-contained inline-styled form, by global-error.tsx
 * which cannot rely on globals.css/Tailwind having mounted).
 */
export default function ErrorScreen({
  title = "Something went wrong",
  description = "An unexpected error occurred. You can try again, or head back to the dashboard.",
  onRetry,
  digest,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
  digest?: string;
}) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
          <div className="flex size-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <TriangleAlertIcon className="size-7" aria-hidden="true" />
          </div>
          <div className="space-y-1.5">
            <p className="font-heading text-lg font-semibold">{title}</p>
            <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
            {digest ? (
              <p className="pt-1 font-mono text-xs text-muted-foreground/70">Ref: {digest}</p>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
            {onRetry ? (
              <Button onClick={onRetry}>
                <RefreshCwIcon data-icon="inline-start" aria-hidden="true" />
                Try again
              </Button>
            ) : null}
            <Button variant="outline" render={<Link href="/dashboard">Go to dashboard</Link>} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
