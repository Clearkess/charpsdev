"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyBlock, ErrorBlock, TableSkeleton } from "@/components/common/StateBlock";
import { useProfileQuery } from "@/hooks/queries/useProfileQuery";
import { extractErrorMessage } from "@/lib/api";

export default function ProfilePage() {
  const { data, isPending, error } = useProfileQuery();

  if (isPending) return <TableSkeleton rows={2} cols={2} />;
  if (error) return <ErrorBlock message={extractErrorMessage(error, "Failed to load profile.")} />;
  if (!data) return <EmptyBlock title="Profile unavailable" description="We could not find profile information for your account." />;

  return (
    <section className="space-y-4">
      <h1 className="font-heading text-3xl font-bold">Profile</h1>
      <Card>
        <CardContent>
          <dl className="grid gap-6 md:grid-cols-2">
            <div>
              <dt className="text-sm text-muted-foreground">Name</dt>
              <dd className="mt-1 font-medium">{data.name}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Email</dt>
              <dd className="mt-1 font-medium">{data.email}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Email verified</dt>
              <dd className="mt-1">
                <Badge variant={data.email_verified_at ? "success" : "warning"}>
                  {data.email_verified_at ? "Verified" : "Pending"}
                </Badge>
              </dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Role</dt>
              <dd className="mt-1">
                <Badge variant={data.is_admin ? "secondary" : "muted"}>{data.is_admin ? "Admin" : "User"}</Badge>
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>
    </section>
  );
}
