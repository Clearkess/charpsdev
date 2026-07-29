"use client";

import { useEffect } from "react";
import ErrorScreen from "@/components/common/ErrorScreen";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error("Admin error boundary caught:", error);
  }, [error]);

  return (
    <ErrorScreen
      title="Admin panel error"
      description="Something went wrong loading this admin view. Try again, or return to the dashboard."
      onRetry={reset}
      digest={error.digest}
    />
  );
}
