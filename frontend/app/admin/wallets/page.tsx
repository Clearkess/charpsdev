"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyBlock, ErrorBlock, TableSkeleton } from "@/components/common/StateBlock";
import { useAdminWalletActionMutation, useAdminWalletsQuery } from "@/hooks/queries/useAdminQueries";
import { extractErrorMessage } from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/format";

export default function AdminWalletsPage() {
  const wallets = useAdminWalletsQuery();
  const walletAction = useAdminWalletActionMutation();
  const [amounts, setAmounts] = useState<Record<number, string>>({});
  const [message, setMessage] = useState<string | null>(null);

  if (wallets.isPending) return <TableSkeleton rows={5} cols={5} />;
  if (wallets.error) return <ErrorBlock message={extractErrorMessage(wallets.error, "Failed to load wallets.")} />;
  if (!wallets.data?.length) return <EmptyBlock title="No wallets" description="No user wallets were found." />;

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

  return (
    <section className="space-y-4">
      <h1 className="font-heading text-3xl font-bold">Admin · Wallets</h1>
      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
      <Card>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Owner</TableHead>
                <TableHead>Balance</TableHead>
                <TableHead>Updated</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {wallets.data.map((user) => {
                const isBusy = walletAction.isPending && walletAction.variables?.userId === user.id;
                return (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className="font-medium">{user.name}</div>
                      <div className="text-xs text-muted-foreground">{user.email}</div>
                    </TableCell>
                    <TableCell>{user.wallet ? formatCurrency(user.wallet.balance, user.wallet.currency) : "No wallet"}</TableCell>
                    <TableCell>{formatDate(user.wallet?.updated_at || user.updated_at)}</TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min="1"
                        step="1"
                        value={amounts[user.id] || ""}
                        onChange={(e) => setAmounts((prev) => ({ ...prev, [user.id]: e.target.value }))}
                        className="w-28"
                        aria-label={`Amount for ${user.name}`}
                      />
                    </TableCell>
                    <TableCell>
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
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </section>
  );
}
