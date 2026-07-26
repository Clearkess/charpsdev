"use client";

import { useState } from "react";
import { useApiQuery } from "@/hooks/useApiQuery";
import { adminActivateUser, adminSuspendUser, selectors } from "@/lib/backend";
import { formatCurrency, formatDate } from "@/lib/format";
import { EmptyBlock, ErrorBlock, LoadingBlock } from "@/components/common/StateBlock";
import type { User } from "@/types/api";

export default function AdminUsersPage() {
  const users = useApiQuery<{ success: boolean; users: User[] }, User[]>("/admin/users", { select: selectors.adminUsers });
  const [busyId, setBusyId] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  if (users.loading) return <LoadingBlock label="Loading users..." />;
  if (users.error) return <ErrorBlock message={users.error} />;
  if (!users.data?.length) return <EmptyBlock title="No users" description="The admin users endpoint returned an empty `users` array." />;

  const runAction = async (userId: number, action: "activate" | "suspend") => {
    setBusyId(userId);
    setMessage(null);
    try {
      const response = action === "activate" ? await adminActivateUser(userId) : await adminSuspendUser(userId);
      setMessage(response.message);
      users.refetch();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : `Failed to ${action} user.`);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="space-y-4">
      <h1 className="text-3xl font-bold">Admin · Users</h1>
      {message ? <p className="text-sm text-neutral-600">{message}</p> : null}
      <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/5">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b text-neutral-500"><tr><th className="px-2 py-3">User</th><th className="px-2 py-3">Wallet</th><th className="px-2 py-3">Verified</th><th className="px-2 py-3">Admin</th><th className="px-2 py-3">Active</th><th className="px-2 py-3">Created</th><th className="px-2 py-3">Actions</th></tr></thead>
            <tbody>
              {users.data.map((user) => (
                <tr key={user.id} className="border-b last:border-b-0">
                  <td className="px-2 py-3"><div className="font-medium">{user.name}</div><div className="text-xs text-neutral-500">{user.email}</div></td>
                  <td className="px-2 py-3">{user.wallet ? formatCurrency(user.wallet.balance, user.wallet.currency) : "No wallet"}</td>
                  <td className="px-2 py-3">{user.email_verified_at ? "Verified" : "Pending"}</td>
                  <td className="px-2 py-3">{user.is_admin ? "Yes" : "No"}</td>
                  <td className="px-2 py-3">{user.active === false ? "Suspended" : "Active"}</td>
                  <td className="px-2 py-3">{formatDate(user.created_at)}</td>
                  <td className="px-2 py-3">
                    {user.active === false ? (
                      <button onClick={() => void runAction(user.id, "activate")} disabled={busyId === user.id} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs text-white">{busyId === user.id ? "Working..." : "Activate"}</button>
                    ) : (
                      <button onClick={() => void runAction(user.id, "suspend")} disabled={busyId === user.id} className="rounded-lg bg-red-600 px-3 py-2 text-xs text-white">{busyId === user.id ? "Working..." : "Suspend"}</button>
                    )}
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
