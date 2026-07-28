"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyBlock, ErrorBlock, TableSkeleton } from "@/components/common/StateBlock";
import { useAdminUserActionMutation, useAdminUsersQuery } from "@/hooks/queries/useAdminQueries";
import { extractErrorMessage } from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/format";

export default function AdminUsersPage() {
  const users = useAdminUsersQuery();
  const userAction = useAdminUserActionMutation();
  const [message, setMessage] = useState<string | null>(null);

  if (users.isPending) return <TableSkeleton rows={5} cols={6} />;
  if (users.error) return <ErrorBlock message={extractErrorMessage(users.error, "Failed to load users.")} />;
  if (!users.data?.length) return <EmptyBlock title="No users" description="No users have registered yet." />;

  const runAction = async (userId: number, action: "activate" | "suspend") => {
    setMessage(null);
    try {
      const response = await userAction.mutateAsync({ userId, action });
      setMessage(response.message);
    } catch (error) {
      setMessage(extractErrorMessage(error, `Failed to ${action} user.`));
    }
  };

  return (
    <section className="space-y-4">
      <h1 className="font-heading text-3xl font-bold">Admin · Users</h1>
      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
      <Card>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Wallet</TableHead>
                <TableHead>Verified</TableHead>
                <TableHead>Admin</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.data.map((user) => {
                const isBusy = userAction.isPending && userAction.variables?.userId === user.id;
                return (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className="font-medium">{user.name}</div>
                      <div className="text-xs text-muted-foreground">{user.email}</div>
                    </TableCell>
                    <TableCell>{user.wallet ? formatCurrency(user.wallet.balance, user.wallet.currency) : "No wallet"}</TableCell>
                    <TableCell>
                      <Badge variant={user.email_verified_at ? "success" : "warning"}>
                        {user.email_verified_at ? "Verified" : "Pending"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={user.is_admin ? "secondary" : "muted"}>{user.is_admin ? "Yes" : "No"}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={user.active === false ? "destructive" : "success"}>
                        {user.active === false ? "Suspended" : "Active"}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatDate(user.created_at)}</TableCell>
                    <TableCell>
                      {user.active === false ? (
                        <Button size="sm" variant="outline" disabled={isBusy} onClick={() => void runAction(user.id, "activate")} className="text-success hover:bg-success/10">
                          {isBusy ? "Working..." : "Activate"}
                        </Button>
                      ) : (
                        <Button size="sm" variant="outline" disabled={isBusy} onClick={() => void runAction(user.id, "suspend")} className="text-destructive hover:bg-destructive/10">
                          {isBusy ? "Working..." : "Suspend"}
                        </Button>
                      )}
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
