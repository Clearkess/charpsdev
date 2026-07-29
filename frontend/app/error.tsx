"use client";

import { useEffect } from "react";
import ErrorScreen from "@/components/common/ErrorScreen";

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error("Route error boundary caught:", error);
  }, [error]);

  return (
    <ErrorScreen
      title="Something went wrong"
      description="An unexpected error occurred while loading this page. Try again, or head back to the dashboard."
      onRetry={reset}
      digest={error.digest}
    />
  );
}
