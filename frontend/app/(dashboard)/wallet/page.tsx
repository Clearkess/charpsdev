"use client";

import { useState } from "react";
import { useApiQuery } from "@/hooks/useApiQuery";
import { initializePayment, selectors } from "@/lib/backend";
import { formatCurrency, formatDate } from "@/lib/format";
import { EmptyBlock, ErrorBlock, LoadingBlock } from "@/components/common/StateBlock";
import type { PaginatedResponse, Transaction, Wallet } from "@/types/api";

export default function WalletPage() {
  const wallet = useApiQuery<{ success: boolean; data: Wallet }, Wallet>("/wallet", { select: selectors.wallet });
  const transactions = useApiQuery<{ success: boolean; data: PaginatedResponse<Transaction> }, PaginatedResponse<Transaction>>("/wallet/transactions", { select: selectors.walletTransactions });
  const [amount, setAmount] = useState("100");
  const [fundingMessage, setFundingMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (wallet.loading || transactions.loading) return <LoadingBlock label="Loading wallet..." />;
  if (wallet.error || transactions.error) return <ErrorBlock message={wallet.error || transactions.error || "Wallet request failed"} />;
  if (!wallet.data) return <EmptyBlock title="No wallet data" description="The backend did not return a wallet object under the expected `data` key." />;

  const onInitializePayment = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setFundingMessage(null);
    try {
      const response = await initializePayment(Number(amount));
      const authUrl = response.data?.authorization_url;
      setFundingMessage(authUrl ? `Authorization URL received: ${authUrl}` : response.message || "Payment initialized.");
    } catch (error) {
      setFundingMessage(error instanceof Error ? error.message : "Failed to initialize payment.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Wallet</h1>
        <p className="mt-2 text-neutral-600">Uses <code>/wallet</code>, <code>/wallet/transactions</code>, and the actual funding endpoint <code>/payment/initialize</code>.</p>
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/5">
          <p className="text-sm text-neutral-500">Current balance</p>
          <p className="mt-2 text-3xl font-bold">{formatCurrency(wallet.data.balance, wallet.data.currency)}</p>
        </div>
        <form onSubmit={onInitializePayment} className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/5">
          <h2 className="text-xl font-semibold">Fund wallet</h2>
          <p className="mt-2 text-sm text-neutral-600">The backend stub at <code>/wallet/deposit</code> is not useful, so this form calls <code>/payment/initialize</code> directly.</p>
          <input value={amount} onChange={(e) => setAmount(e.target.value)} className="mt-4 w-full rounded-lg border px-3 py-2" type="number" min="100" step="1" />
          <button disabled={submitting} className="mt-3 rounded-lg bg-neutral-900 px-4 py-2 text-white">{submitting ? "Initializing..." : "Initialize payment"}</button>
          {fundingMessage ? <p className="mt-3 text-sm text-neutral-600 break-all">{fundingMessage}</p> : null}
        </form>
      </div>
      <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/5">
        <h2 className="text-xl font-semibold">Recent transactions</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b text-neutral-500"><tr><th className="px-2 py-3">Reference</th><th className="px-2 py-3">Type</th><th className="px-2 py-3">Amount</th><th className="px-2 py-3">Status</th><th className="px-2 py-3">Created</th></tr></thead>
            <tbody>
              {(transactions.data?.data || []).map((transaction) => (
                <tr key={transaction.id} className="border-b last:border-b-0">
                  <td className="px-2 py-3">{transaction.reference || `#${transaction.id}`}</td>
                  <td className="px-2 py-3 capitalize">{transaction.type}</td>
                  <td className="px-2 py-3">{formatCurrency(transaction.amount)}</td>
                  <td className="px-2 py-3 capitalize">{transaction.status}</td>
                  <td className="px-2 py-3">{formatDate(transaction.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
