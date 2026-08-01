"use client";

import { useEffect, useState } from "react";
import StarRating from "@/components/common/StarRating";
import { Button } from "@/components/ui/button";
import { useServiceReviewsQuery, useSubmitReviewMutation } from "@/hooks/queries/useReviewsQueries";
import { extractErrorMessage } from "@/lib/api";

/**
 * Phase 9 (user-facing features): one "rate this purchase" row for a single
 * service inside a completed order's expanded review panel. Fetches the
 * user's existing review (if any) only once expanded — pre-fills the form
 * as an edit rather than showing an empty "write a review" form for a
 * service already reviewed.
 */
export default function ReviewFormRow({ serviceId, serviceName }: { serviceId: number; serviceName: string }) {
  const { data, isPending } = useServiceReviewsQuery(serviceId);
  const submitReview = useSubmitReviewMutation(serviceId);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (data?.my_review) {
      setRating(data.my_review.rating);
      setComment(data.my_review.comment || "");
    }
  }, [data?.my_review]);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage(null);
    try {
      const response = await submitReview.mutateAsync({ rating, comment: comment || undefined });
      setMessage(response.message || "Review saved.");
    } catch (error) {
      setMessage(extractErrorMessage(error, "Failed to submit review."));
    }
  };

  if (isPending) {
    return <p className="text-xs text-muted-foreground">Loading review form for {serviceName}...</p>;
  }

  return (
    <form onSubmit={onSubmit} className="space-y-2 rounded-lg border border-border bg-card p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium">{serviceName}</p>
        <StarRating rating={rating} onChange={setRating} />
      </div>
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Optional comment about this service..."
        rows={2}
        maxLength={2000}
        aria-label={`Review comment for ${serviceName}`}
        className="w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
      />
      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" disabled={rating < 1 || submitReview.isPending}>
          {submitReview.isPending ? "Saving..." : data?.my_review ? "Update review" : "Submit review"}
        </Button>
        {message ? <p className="text-xs text-muted-foreground">{message}</p> : null}
      </div>
    </form>
  );
}
