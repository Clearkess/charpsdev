"use client";

import { StarIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Phase 9 (user-facing features): shared 1-5 star control. Read-only mode
 * (`onChange` omitted) renders a display rating — used on Service cards and
 * the reviews list. Interactive mode (`onChange` provided) renders clickable
 * buttons — used by the "rate this purchase" review form on the Orders page.
 * `rating` may be fractional in read-only mode (e.g. an average of 4.33) —
 * each star fills proportionally via a clipped overlay rather than only
 * supporting whole-star rounding.
 */
export default function StarRating({
  rating,
  count,
  onChange,
  size = "default",
}: {
  rating: number;
  /** Optional review count, rendered as "(N)" next to the stars in read-only mode. */
  count?: number;
  onChange?: (rating: number) => void;
  size?: "sm" | "default";
}) {
  const starSize = size === "sm" ? "size-3.5" : "size-4";
  const interactive = Boolean(onChange);

  return (
    <span className="inline-flex items-center gap-1">
      <span className="inline-flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((value) => {
          const fillPercent = Math.max(0, Math.min(1, rating - (value - 1))) * 100;
          if (interactive) {
            return (
              <button
                key={value}
                type="button"
                aria-label={`Rate ${value} star${value === 1 ? "" : "s"}`}
                onClick={() => onChange?.(value)}
                className="text-muted-foreground transition-colors hover:text-warning"
              >
                <StarIcon
                  className={cn(starSize, value <= rating ? "fill-warning text-warning" : "fill-none")}
                  aria-hidden="true"
                />
              </button>
            );
          }
          return (
            <span key={value} className={cn("relative inline-block", starSize)}>
              <StarIcon className={cn(starSize, "absolute inset-0 fill-none text-muted-foreground/40")} aria-hidden="true" />
              <span className="absolute inset-0 overflow-hidden" style={{ width: `${fillPercent}%` }}>
                <StarIcon className={cn(starSize, "fill-warning text-warning")} aria-hidden="true" />
              </span>
            </span>
          );
        })}
      </span>
      {count != null ? <span className="text-xs text-muted-foreground">({count})</span> : null}
    </span>
  );
}
