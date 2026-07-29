"use client";

import { useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { DataTable } from "@/components/ui/data-table";
import { EmptyBlock, ErrorBlock, TableSkeleton } from "@/components/common/StateBlock";
import { useAdminWalletActionMutation, useAdminWalletsQuery } from "@/hooks/queries/useAdminQueries";
import { extractErrorMessage } from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/format";
import type { WalletListItem } from "@/types/api";

export default function AdminWalletsPage() {
  const wallets = useAdminWalletsQuery();
  const walletAction = useAdminWalletActionMutation();
  const [amounts, setAmounts] = useState<Record<number, string>>({});
  const [message, setMessage] = useState<string | null>(null);

  const runAction = async (userId: number, action: "credit" | "debit") => {
    const amount = Number(amounts[userId] || 0);
    if (!amount) return;
    setMessage(null);
    try {
      const response = await walletAction.mutateAsync({ userId, action, amount });
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
        id: "actions",
        header: "Actions",
        enableSorting: false,
        cell: ({ row }) => {
          const user = row.original;
          const isBusy = walletAction.isPending && walletAction.variables?.userId === user.id;
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
            </div>
          );
        },
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [amounts, walletAction.isPending, walletAction.variables],
  );

  if (wallets.isPending) return <TableSkeleton rows={5} cols={5} />;
  if (wallets.error) return <ErrorBlock message={extractErrorMessage(wallets.error, "Failed to load wallets.")} />;
  if (!wallets.data?.length) return <EmptyBlock title="No wallets" description="No user wallets were found." />;

  return (
    <section className="space-y-4">
      <h1 className="font-heading text-3xl font-bold">Admin · Wallets</h1>
      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
      <Card>
        <CardContent>
          <DataTable columns={columns} data={wallets.data} />
        </CardContent>
      </Card>
    </section>
  );
}
