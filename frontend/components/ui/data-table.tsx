"use client";

import {
  type ColumnDef,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { ArrowDownIcon, ArrowUpIcon, ArrowUpDownIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

export type DataTablePagination = {
  page: number;
  lastPage: number;
  total: number;
  onPageChange: (page: number) => void;
};

interface DataTableProps<TData> {
  columns: ColumnDef<TData, unknown>[];
  data: TData[];
  /** Enables client-side column sorting (default true). */
  enableSorting?: boolean;
  /** When provided, renders server-side pagination controls below the table. */
  pagination?: DataTablePagination;
  isFetching?: boolean;
}

/**
 * Thin, sortable wrapper around @tanstack/react-table built on top of the
 * existing components/ui/table.tsx primitives, so all admin list pages share
 * one consistent look/behavior instead of hand-rolled <table> markup.
 * Pagination (when passed) is server-side — the caller owns the page state
 * and refetches; this component only renders the prev/next controls.
 */
export function DataTable<TData>({
  columns,
  data,
  enableSorting = true,
  pagination,
  isFetching = false,
}: DataTableProps<TData>) {
  const [sorting, setSorting] = useState<SortingState>([]);

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: enableSorting ? getSortedRowModel() : undefined,
    enableSorting,
  });

  return (
    <div className={cn("space-y-3", isFetching && "opacity-60 transition-opacity")}>
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => {
                const canSort = header.column.getCanSort();
                const sortDirection = header.column.getIsSorted();
                return (
                  <TableHead key={header.id}>
                    {header.isPlaceholder ? null : canSort ? (
                      <button
                        type="button"
                        className="flex items-center gap-1 font-medium hover:text-primary"
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {sortDirection === "asc" ? (
                          <ArrowUpIcon className="size-3.5" aria-hidden="true" />
                        ) : sortDirection === "desc" ? (
                          <ArrowDownIcon className="size-3.5" aria-hidden="true" />
                        ) : (
                          <ArrowUpDownIcon className="size-3.5 text-muted-foreground/50" aria-hidden="true" />
                        )}
                      </button>
                    ) : (
                      flexRender(header.column.columnDef.header, header.getContext())
                    )}
                  </TableHead>
                );
              })}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.map((row) => (
            <TableRow key={row.id}>
              {row.getVisibleCells().map((cell) => (
                <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {pagination ? (
        <div className="flex items-center justify-between gap-3 pt-1">
          <p className="text-xs text-muted-foreground">
            Page {pagination.page} of {pagination.lastPage} · {pagination.total} total
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page <= 1}
              onClick={() => pagination.onPageChange(pagination.page - 1)}
            >
              <ChevronLeftIcon data-icon="inline-start" aria-hidden="true" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page >= pagination.lastPage}
              onClick={() => pagination.onPageChange(pagination.page + 1)}
            >
              Next
              <ChevronRightIcon data-icon="inline-end" aria-hidden="true" />
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
