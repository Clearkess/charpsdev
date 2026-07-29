"use client";

import { useEffect } from "react";
import ErrorScreen from "@/components/common/ErrorScreen";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error("Dashboard error boundary caught:", error);
  }, [error]);

  return (
    <ErrorScreen
      title="This page hit a snag"
      description="Something went wrong loading this part of your dashboard. Try again — if it keeps happening, please reach out to support."
      onRetry={reset}
      digest={error.digest}
    />
  );
}
