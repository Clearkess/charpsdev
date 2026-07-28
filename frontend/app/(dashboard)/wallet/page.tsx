"use client";

import { useState } from "react";
import { ExternalLinkIcon, WalletIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { EmptyBlock, ErrorBlock, TableSkeleton } from "@/components/common/StateBlock";
import { useInitializePaymentMutation, useWalletQuery, useWalletTransactionsQuery } from "@/hooks/queries/useWalletQueries";
import { extractErrorMessage } from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/format";

function statusVariant(status: string) {
  const normalized = status?.toLowerCase();
  if (normalized === "success" || normalized === "completed") return "success" as const;
  if (normalized === "failed" || normalized === "cancelled") return "destructive" as const;
  return "muted" as const;
}

export default function WalletPage() {
  const wallet = useWalletQuery();
  const transactions = useWalletTransactionsQuery();
  const initializePayment = useInitializePaymentMutation();
  const [amount, setAmount] = useState("100");
  const [fundingMessage, setFundingMessage] = useState<string | null>(null);

  if (wallet.isPending || transactions.isPending) return <TableSkeleton rows={4} cols={5} />;
  if (wallet.error || transactions.error) {
    return <ErrorBlock message={extractErrorMessage(wallet.error || transactions.error, "Wallet request failed.")} />;
  }
  if (!wallet.data) {
    return <EmptyBlock title="No wallet data" description="We could not find a wallet for your account." />;
  }

  const onInitializePayment = async (event: React.FormEvent) => {
    event.preventDefault();
    setFundingMessage(null);
    try {
      const response = await initializePayment.mutateAsync(Number(amount));
      const authUrl = response.data?.authorization_url;
      setFundingMessage(authUrl ? `Authorization URL received: ${authUrl}` : response.message || "Payment initialized.");
    } catch (error) {
      setFundingMessage(extractErrorMessage(error, "Failed to initialize payment."));
    }
  };

  const rows = transactions.data?.data || [];

  return (
    <section className="space-y-6">
      <div>
        <h1 className="font-heading text-3xl font-bold">Wallet</h1>
        <p className="mt-2 text-muted-foreground">Manage your balance and fund your wallet.</p>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardContent className="flex items-center gap-4">
            <div className="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <WalletIcon className="size-6" aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Current balance</p>
              <p className="mt-1 text-3xl font-bold">{formatCurrency(wallet.data.balance, wallet.data.currency)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Fund wallet</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={onInitializePayment} className="space-y-3">
              <Input
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                type="number"
                min="100"
                step="1"
                aria-label="Amount to fund"
              />
              <Button type="submit" disabled={initializePayment.isPending} className="w-full">
                {initializePayment.isPending ? "Initializing..." : "Initialize payment"}
              </Button>
              {fundingMessage ? (
                <p className="flex items-start gap-1.5 break-all text-sm text-muted-foreground">
                  <ExternalLinkIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                  {fundingMessage}
                </p>
              ) : null}
            </form>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Recent transactions</CardTitle>
        </CardHeader>
        <CardContent>
          {!rows.length ? (
            <EmptyBlock title="No transactions" description="Your wallet transaction history will appear here." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Reference</TableHead>
                  <TableHead>Type</TableHead>
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
          )}
        </CardContent>
      </Card>
    </section>
  );
}
