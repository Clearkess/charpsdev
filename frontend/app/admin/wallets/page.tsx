"use client";

import { useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { ChevronDownIcon, ChevronUpIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyBlock, ErrorBlock, TableSkeleton } from "@/components/common/StateBlock";
import {
  useAdminWalletActionMutation,
  useAdminWalletTransactionsQuery,
  useAdminWalletsQuery,
} from "@/hooks/queries/useAdminQueries";
import { extractErrorMessage } from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/format";
import type { WalletListItem } from "@/types/api";

function statusVariant(status: string) {
  const normalized = status?.toLowerCase();
  if (normalized === "success" || normalized === "completed") return "success" as const;
  if (normalized === "failed" || normalized === "cancelled") return "destructive" as const;
  return "muted" as const;
}

/**
 * Phase 2 (Wallet Refinements): expandable per-user transaction history,
 * fed by GET /admin/wallets/{user}/transactions. Shown inline below the
 * wallets table rather than in a modal, matching this codebase's existing
 * pattern of plain Card-based admin pages (no Dialog primitive exists yet).
 */
function WalletTransactionsPanel({ userId }: { userId: number }) {
  const [page, setPage] = useState(1);
  const transactions = useAdminWalletTransactionsQuery(userId, page);

  if (transactions.isPending) return <TableSkeleton rows={3} cols={4} />;
  if (transactions.error) {
    return <ErrorBlock message={extractErrorMessage(transactions.error, "Failed to load transaction history.")} />;
  }

  const rows = transactions.data?.data || [];

  if (!rows.length) {
    return <p className="py-2 text-sm text-muted-foreground">No transactions yet for this user.</p>;
  }

  return (
    <div className="space-y-3">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Reference</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Description</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Created</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((transaction) => (
            <TableRow key={transaction.id}>
              <TableCell>{transaction.reference || `#${transaction.id}`}</TableCell>
              <TableCell className="capitalize">{transaction.type}</TableCell>
              <TableCell className="max-w-xs truncate text-muted-foreground">
                {transaction.description || "—"}
              </TableCell>
              <TableCell>{formatCurrency(transaction.amount)}</TableCell>
              <TableCell>
                <Badge variant={statusVariant(transaction.status)} className="capitalize">
                  {transaction.status}
                </Badge>
              </TableCell>
              <TableCell>{formatDate(transaction.created_at)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {transactions.data && transactions.data.last_page > 1 ? (
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            Page {transactions.data.current_page} of {transactions.data.last_page} · {transactions.data.total} total
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= (transactions.data?.last_page ?? 1)}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function AdminWalletsPage() {
  const wallets = useAdminWalletsQuery();
  const walletAction = useAdminWalletActionMutation();
  const [amounts, setAmounts] = useState<Record<number, string>>({});
  const [reasons, setReasons] = useState<Record<number, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [expandedUserId, setExpandedUserId] = useState<number | null>(null);

  const runAction = async (userId: number, action: "credit" | "debit") => {
    const amount = Number(amounts[userId] || 0);
    if (!amount) return;
    setMessage(null);
    try {
      const response = await walletAction.mutateAsync({ userId, action, amount, reason: reasons[userId] || undefined });
      setMessage(`User #${userId} ${action} succeeded. Balance: ${response.balance}`);
    } catch (error) {
      setMessage(extractErrorMessage(error, `Failed to ${action} wallet.`));
    }
  };

  const columns = useMemo<ColumnDef<WalletListItem, unknown>[]>(
    () => [
      {
        id: "owner",
        header: "Owner",
        accessorFn: (row) => row.name,
        cell: ({ row }) => (
          <div>
            <div className="font-medium">{row.original.name}</div>
            <div className="text-xs text-muted-foreground">{row.original.email}</div>
          </div>
        ),
      },
      {
        id: "balance",
        header: "Balance",
        accessorFn: (row) => Number(row.wallet?.balance ?? 0),
        cell: ({ row }) =>
          row.original.wallet
            ? formatCurrency(row.original.wallet.balance, row.original.wallet.currency)
            : "No wallet",
      },
      {
        id: "updated",
        header: "Updated",
        accessorFn: (row) => row.wallet?.updated_at || row.updated_at || "",
        cell: ({ row }) => formatDate(row.original.wallet?.updated_at || row.original.updated_at),
      },
      {
        id: "amount",
        header: "Amount",
        enableSorting: false,
        cell: ({ row }) => {
          const user = row.original;
          return (
            <Input
              type="number"
              min="1"
              step="1"
              value={amounts[user.id] || ""}
              onChange={(e) => setAmounts((prev) => ({ ...prev, [user.id]: e.target.value }))}
              className="w-28"
              aria-label={`Amount for ${user.name}`}
            />
          );
        },
      },
      {
        id: "reason",
        header: "Reason (optional)",
        enableSorting: false,
        cell: ({ row }) => {
          const user = row.original;
          return (
            <Input
              type="text"
              value={reasons[user.id] || ""}
              onChange={(e) => setReasons((prev) => ({ ...prev, [user.id]: e.target.value }))}
              placeholder="e.g. Goodwill bonus"
              className="w-40"
              aria-label={`Reason for ${user.name}`}
            />
          );
        },
      },
      {
        id: "actions",
        header: "Actions",
        enableSorting: false,
        cell: ({ row }) => {
          const user = row.original;
          const isBusy = walletAction.isPending && walletAction.variables?.userId === user.id;
          const isExpanded = expandedUserId === user.id;
          return (
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={isBusy || !user.wallet}
                onClick={() => void runAction(user.id, "credit")}
                className="text-success hover:bg-success/10"
              >
                {isBusy ? "Working..." : "Credit"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={isBusy || !user.wallet}
                onClick={() => void runAction(user.id, "debit")}
                className="text-destructive hover:bg-destructive/10"
              >
                {isBusy ? "Working..." : "Debit"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setExpandedUserId(isExpanded ? null : user.id)}
                aria-expanded={isExpanded}
                aria-label={`${isExpanded ? "Hide" : "Show"} transaction history for ${user.name}`}
              >
                History
                {isExpanded ? (
                  <ChevronUpIcon data-icon="inline-end" aria-hidden="true" />
                ) : (
                  <ChevronDownIcon data-icon="inline-end" aria-hidden="true" />
                )}
              </Button>
            </div>
          );
        },
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [amounts, reasons, walletAction.isPending, walletAction.variables, expandedUserId],
  );

  if (wallets.isPending) return <TableSkeleton rows={5} cols={6} />;
  if (wallets.error) return <ErrorBlock message={extractErrorMessage(wallets.error, "Failed to load wallets.")} />;
  if (!wallets.data?.length) return <EmptyBlock title="No wallets" description="No user wallets were found." />;

  const expandedUser = wallets.data.find((user) => user.id === expandedUserId);

  return (
    <section className="space-y-4">
      <h1 className="font-heading text-3xl font-bold">Admin · Wallets</h1>
      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
      <Card>
        <CardContent>
          <DataTable columns={columns} data={wallets.data} />
        </CardContent>
      </Card>
      {expandedUser ? (
        <Card>
          <CardContent>
            <h2 className="mb-3 font-heading text-lg font-semibold">
              Transaction history — {expandedUser.name}
              <span className="ml-2 text-sm font-normal text-muted-foreground">{expandedUser.email}</span>
            </h2>
            <WalletTransactionsPanel userId={expandedUser.id} />
          </CardContent>
        </Card>
      ) : null}
    </section>
  );
}
