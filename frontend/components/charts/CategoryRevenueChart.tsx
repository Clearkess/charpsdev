"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatCurrency } from "@/lib/format";
import type { CategoryRevenueStat } from "@/types/api";

/**
 * Phase 8 (analytics): horizontal bar chart of revenue by service category
 * for the selected date range. Uses a fixed height per row (rather than the
 * other charts' fixed 260px) so it stays readable whether there are 2 or 10
 * categories.
 */
export default function CategoryRevenueChart({ data }: { data: CategoryRevenueStat[] }) {
  const height = Math.max(160, data.length * 44);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 8, right: 24, bottom: 0, left: 8 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
        <XAxis
          type="number"
          tickFormatter={(value) => formatCurrency(value).replace(/\.00$/, "")}
          tick={{ fontSize: 12, fill: "var(--color-muted-foreground)" }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          type="category"
          dataKey="category"
          tick={{ fontSize: 12, fill: "var(--color-muted-foreground)" }}
          axisLine={false}
          tickLine={false}
          width={140}
        />
        <Tooltip
          formatter={(value) => [formatCurrency(Number(value)), "Revenue"]}
          contentStyle={{
            background: "var(--color-popover)",
            border: "1px solid var(--color-border)",
            borderRadius: "0.625rem",
            color: "var(--color-popover-foreground)",
            fontSize: "0.8rem",
          }}
        />
        <Bar dataKey="revenue" fill="var(--color-primary)" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
