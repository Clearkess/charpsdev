"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyBlock, ErrorBlock, TableSkeleton } from "@/components/common/StateBlock";
import { useAdminServicesQuery } from "@/hooks/queries/useAdminQueries";
import { extractErrorMessage } from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/format";

export default function AdminServicesPage() {
  const { data, isPending, error } = useAdminServicesQuery();

  if (isPending) return <TableSkeleton rows={5} cols={5} />;
  if (error) return <ErrorBlock message={extractErrorMessage(error, "Failed to load services.")} />;
  if (!data?.length) return <EmptyBlock title="No services" description="No services have been created yet." />;

  return (
    <section className="space-y-4">
      <h1 className="font-heading text-3xl font-bold">Admin · Services</h1>
      <Card>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((service) => (
                <TableRow key={service.id}>
                  <TableCell>
                    <div className="font-medium">{service.name}</div>
                    <div className="text-xs text-muted-foreground">{service.slug || "no-slug"}</div>
                  </TableCell>
                  <TableCell>{service.category || "—"}</TableCell>
                  <TableCell>{formatCurrency(service.price)}</TableCell>
                  <TableCell>
                    <Badge variant={service.active === false ? "destructive" : "success"}>
                      {service.active === false ? "Inactive" : "Active"}
                    </Badge>
                  </TableCell>
                  <TableCell>{formatDate(service.updated_at)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </section>
  );
}
