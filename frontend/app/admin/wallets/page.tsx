"use client";

import { useState } from "react";
import { useApiQuery } from "@/hooks/useApiQuery";
import { adminCreditWallet, adminDebitWallet, selectors } from "@/lib/backend";
import { formatCurrency, formatDate } from "@/lib/format";
import { EmptyBlock, ErrorBlock, LoadingBlock } from "@/components/common/StateBlock";
import type { WalletListItem } from "@/types/api";

export default function AdminWalletsPage() {
  const wallets = useApiQuery<{ success: boolean; wallets: WalletListItem[] }, WalletListItem[]>("/admin/wallets", { select: selectors.adminWallets });
  const [amounts, setAmounts] = useState<Record<number, string>>({});
  const [busyId, setBusyId] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  if (wallets.loading) return <LoadingBlock label="Loading admin wallets..." />;
  if (wallets.error) return <ErrorBlock message={wallets.error} />;
  if (!wallets.data?.length) return <EmptyBlock title="No wallets" description="The endpoint returns users under the `wallets` key, each with an embedded `wallet` relation." />;

  const runAction = async (userId: number, action: "credit" | "debit") => {
    const amount = Number(amounts[userId] || 0);
    if (!amount) return;
    setBusyId(userId);
    setMessage(null);
    try {
      const response = action === "credit" ? await adminCreditWallet(userId, amount) : await adminDebitWallet(userId, amount);
      setMessage(`User #${userId} ${action} succeeded. Balance: ${response.balance}`);
      wallets.refetch();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : `Failed to ${action} wallet.`);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="space-y-4">
      <h1 className="text-3xl font-bold">Admin · Wallets</h1>
      {message ? <p className="text-sm text-neutral-600">{message}</p> : null}
      <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/5">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b text-neutral-500"><tr><th className="px-2 py-3">Owner</th><th className="px-2 py-3">Balance</th><th className="px-2 py-3">Updated</th><th className="px-2 py-3">Amount</th><th className="px-2 py-3">Actions</th></tr></thead>
            <tbody>
              {wallets.data.map((user) => (
                <tr key={user.id} className="border-b last:border-b-0">
                  <td className="px-2 py-3"><div className="font-medium">{user.name}</div><div className="text-xs text-neutral-500">{user.email}</div></td>
                  <td className="px-2 py-3">{user.wallet ? formatCurrency(user.wallet.balance, user.wallet.currency) : "No wallet"}</td>
                  <td className="px-2 py-3">{formatDate(user.wallet?.updated_at || user.updated_at)}</td>
                  <td className="px-2 py-3"><input type="number" min="1" step="1" value={amounts[user.id] || ""} onChange={(e) => setAmounts((prev) => ({ ...prev, [user.id]: e.target.value }))} className="w-28 rounded-lg border px-3 py-2" /></td>
                  <td className="px-2 py-3">
                    <div className="flex gap-2">
                      <button onClick={() => void runAction(user.id, "credit")} disabled={busyId === user.id || !user.wallet} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs text-white">{busyId === user.id ? "Working..." : "Credit"}</button>
                      <button onClick={() => void runAction(user.id, "debit")} disabled={busyId === user.id || !user.wallet} className="rounded-lg bg-red-600 px-3 py-2 text-xs text-white">{busyId === user.id ? "Working..." : "Debit"}</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
