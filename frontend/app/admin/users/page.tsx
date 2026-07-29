"use client";

import { useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { EmptyBlock, ErrorBlock, TableSkeleton } from "@/components/common/StateBlock";
import { useAdminUserActionMutation, useAdminUsersQuery } from "@/hooks/queries/useAdminQueries";
import { extractErrorMessage } from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/format";
import type { User } from "@/types/api";

export default function AdminUsersPage() {
  const users = useAdminUsersQuery();
  const userAction = useAdminUserActionMutation();
  const [message, setMessage] = useState<string | null>(null);

  const runAction = async (userId: number, action: "activate" | "suspend") => {
    setMessage(null);
    try {
      const response = await userAction.mutateAsync({ userId, action });
      setMessage(response.message);
    } catch (error) {
      setMessage(extractErrorMessage(error, `Failed to ${action} user.`));
    }
  };

  const columns = useMemo<ColumnDef<User, unknown>[]>(
    () => [
      {
        id: "user",
        header: "User",
        accessorFn: (row) => row.name,
        cell: ({ row }) => (
          <div>
            <div className="font-medium">{row.original.name}</div>
            <div className="text-xs text-muted-foreground">{row.original.email}</div>
          </div>
        ),
      },
      {
        id: "wallet",
        header: "Wallet",
        accessorFn: (row) => Number(row.wallet?.balance ?? 0),
        cell: ({ row }) =>
          row.original.wallet
            ? formatCurrency(row.original.wallet.balance, row.original.wallet.currency)
            : "No wallet",
      },
      {
        id: "verified",
        header: "Verified",
        accessorFn: (row) => Boolean(row.email_verified_at),
        cell: ({ row }) => (
          <Badge variant={row.original.email_verified_at ? "success" : "warning"}>
            {row.original.email_verified_at ? "Verified" : "Pending"}
          </Badge>
        ),
      },
      {
        id: "admin",
        header: "Admin",
        accessorFn: (row) => Boolean(row.is_admin),
        cell: ({ row }) => (
          <Badge variant={row.original.is_admin ? "secondary" : "muted"}>
            {row.original.is_admin ? "Yes" : "No"}
          </Badge>
        ),
      },
      {
        id: "status",
        header: "Status",
        accessorFn: (row) => row.active !== false,
        cell: ({ row }) => (
          <Badge variant={row.original.active === false ? "destructive" : "success"}>
            {row.original.active === false ? "Suspended" : "Active"}
          </Badge>
        ),
      },
      {
        id: "created",
        header: "Created",
        accessorFn: (row) => row.created_at ?? "",
        cell: ({ row }) => formatDate(row.original.created_at),
      },
      {
        id: "actions",
        header: "Actions",
        enableSorting: false,
        cell: ({ row }) => {
          const user = row.original;
          const isBusy = userAction.isPending && userAction.variables?.userId === user.id;
          return user.active === false ? (
            <Button
              size="sm"
              variant="outline"
              disabled={isBusy}
              onClick={() => void runAction(user.id, "activate")}
              className="text-success hover:bg-success/10"
            >
              {isBusy ? "Working..." : "Activate"}
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              disabled={isBusy}
              onClick={() => void runAction(user.id, "suspend")}
              className="text-destructive hover:bg-destructive/10"
            >
              {isBusy ? "Working..." : "Suspend"}
            </Button>
          );
        },
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [userAction.isPending, userAction.variables],
  );

  if (users.isPending) return <TableSkeleton rows={5} cols={6} />;
  if (users.error) return <ErrorBlock message={extractErrorMessage(users.error, "Failed to load users.")} />;
  if (!users.data?.length) return <EmptyBlock title="No users" description="No users have registered yet." />;

  return (
    <section className="space-y-4">
      <h1 className="font-heading text-3xl font-bold">Admin · Users</h1>
      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
      <Card>
        <CardContent>
          <DataTable columns={columns} data={users.data} />
        </CardContent>
      </Card>
    </section>
  );
}
