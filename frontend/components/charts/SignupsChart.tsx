"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { SignupDataPoint } from "@/types/api";

function formatShortDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** Phase 8 (analytics): day-bucketed new-user signups, styled to match the pre-existing OrdersOverTimeChart. */
export default function SignupsChart({ data }: { data: SignupDataPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
        <defs>
          <linearGradient id="signupsFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--color-secondary, var(--color-primary))" stopOpacity={0.35} />
            <stop offset="95%" stopColor="var(--color-secondary, var(--color-primary))" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
        <XAxis
          dataKey="date"
          tickFormatter={formatShortDate}
          tick={{ fontSize: 12, fill: "var(--color-muted-foreground)" }}
          axisLine={{ stroke: "var(--color-border)" }}
          tickLine={false}
          minTickGap={24}
        />
        <YAxis
          allowDecimals={false}
          tick={{ fontSize: 12, fill: "var(--color-muted-foreground)" }}
          axisLine={false}
          tickLine={false}
          width={32}
        />
        <Tooltip
          labelFormatter={(value) => formatShortDate(String(value))}
          formatter={(value) => [value, "New users"]}
          contentStyle={{
            background: "var(--color-popover)",
            border: "1px solid var(--color-border)",
            borderRadius: "0.625rem",
            color: "var(--color-popover-foreground)",
            fontSize: "0.8rem",
          }}
        />
        <Area
          type="monotone"
          dataKey="count"
          stroke="var(--color-secondary, var(--color-primary))"
          strokeWidth={2}
          fill="url(#signupsFill)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
