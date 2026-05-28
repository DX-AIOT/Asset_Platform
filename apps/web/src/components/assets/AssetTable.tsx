'use client';

import { useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type ColumnFiltersState,
  type RowSelectionState,
} from '@tanstack/react-table';
import { ChevronUp, ChevronDown, ChevronsUpDown, Search, ChevronLeft, ChevronRight, Package, Download } from 'lucide-react';
import { type Item, ItemCategory, CATEGORY_LABELS } from '@/types/items';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface AssetTableProps {
  items: Item[];
  loading?: boolean;
}

type ExportRow = {
  name: string;
  brand: string;
  model: string;
  category: string;
  purchasePrice: string;
  purchaseDate: string;
  location: string;
  warrantyExpiryDate: string;
  condition: string;
};

function formatCurrency(value: number | null): string {
  if (value === null) return '—';
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value);
}

function formatDate(value: string | null): string {
  if (!value) return '—';
  return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium' }).format(new Date(value));
}

function toExportRows(items: Item[]): ExportRow[] {
  return items.map((item) => ({
    name: item.name,
    brand: item.brand ?? '',
    model: item.model ?? '',
    category: CATEGORY_LABELS[item.category],
    purchasePrice: item.purchasePrice === null ? '' : String(item.purchasePrice),
    purchaseDate: item.purchaseDate ?? '',
    location: item.location ?? '',
    warrantyExpiryDate: item.warrantyExpiry ?? '',
    condition: item.condition,
  }));
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function exportAsCsv(rows: ExportRow[], filename: string): void {
  const headers = Object.keys(rows[0] ?? {}) as Array<keyof ExportRow>;
  const csv = [
    headers.join(','),
    ...rows.map((row) =>
      headers
        .map((header) => `"${String(row[header]).replace(/"/g, '""')}"`)
        .join(',')
    ),
  ].join('\n');
  downloadBlob(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' }), filename);
}

async function exportAsExcel(rows: ExportRow[], filename: string): Promise<void> {
  const XLSX = await import('xlsx');
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Assets');
  const bytes = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });
  downloadBlob(
    new Blob([bytes], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }),
    filename
  );
}

function ThumbnailCell({ photos, name }: { photos: string[]; name: string }) {
  const src = photos?.[0];
  if (src) {
    return (
      <div className="relative h-10 w-10 flex-shrink-0 overflow-hidden rounded-md border border-gray-200">
        <Image
          src={src}
          alt={name}
          fill
          className="object-cover"
          sizes="40px"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = 'none';
          }}
        />
      </div>
    );
  }
  return (
    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md border border-gray-200 bg-gray-50">
      <Package className="h-5 w-5 text-gray-400" />
    </div>
  );
}

function SortIcon({ sorted }: { sorted: false | 'asc' | 'desc' }) {
  if (sorted === 'asc') return <ChevronUp className="h-3.5 w-3.5" />;
  if (sorted === 'desc') return <ChevronDown className="h-3.5 w-3.5" />;
  return <ChevronsUpDown className="h-3.5 w-3.5 text-gray-400" />;
}

export function AssetTable({ items, loading = false }: AssetTableProps) {
  const router = useRouter();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [globalFilter, setGlobalFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [locationFilter, setLocationFilter] = useState('');

  // Unique locations for filter dropdown
  const locations = useMemo(() => {
    const locs = new Set(items.map((i) => i.location).filter(Boolean) as string[]);
    return Array.from(locs).sort();
  }, [items]);

  // Apply category + location + global search filtering client-side
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (categoryFilter !== 'all' && item.category !== categoryFilter) return false;
      if (locationFilter && (!item.location || !item.location.toLowerCase().includes(locationFilter.toLowerCase()))) return false;
      if (globalFilter) {
        const q = globalFilter.toLowerCase();
        return (
          item.name.toLowerCase().includes(q) ||
          (item.brand?.toLowerCase().includes(q) ?? false) ||
          (item.model?.toLowerCase().includes(q) ?? false) ||
          CATEGORY_LABELS[item.category].toLowerCase().includes(q) ||
          (item.location?.toLowerCase().includes(q) ?? false)
        );
      }
      return true;
    });
  }, [items, categoryFilter, locationFilter, globalFilter]);

  const columns = useMemo<ColumnDef<Item>[]>(
    () => [
      {
        id: 'select',
        header: ({ table }) => (
          <Checkbox
            checked={table.getIsAllPageRowsSelected()}
            onChange={table.getToggleAllPageRowsSelectedHandler()}
            aria-label="Select all"
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={row.getIsSelected()}
            onChange={row.getToggleSelectedHandler()}
            aria-label="Select row"
            onClick={(e) => e.stopPropagation()}
          />
        ),
        enableSorting: false,
        size: 40,
      },
      {
        id: 'thumbnail',
        header: '',
        cell: ({ row }) => (
          <ThumbnailCell photos={row.original.photos ?? []} name={row.original.name} />
        ),
        enableSorting: false,
        size: 56,
      },
      {
        accessorKey: 'name',
        header: ({ column }) => (
          <button
            className="inline-flex items-center gap-1 font-medium"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            Asset Name
            <SortIcon sorted={column.getIsSorted()} />
          </button>
        ),
        cell: ({ getValue }) => (
          <span className="font-medium text-gray-900">{getValue() as string}</span>
        ),
      },
      {
        accessorKey: 'brand',
        header: 'Brand',
        cell: ({ getValue }) => (getValue() as string | null) ?? <span className="text-gray-400">—</span>,
        enableSorting: false,
      },
      {
        accessorKey: 'category',
        header: 'Category',
        cell: ({ getValue }) => (
          <Badge variant="secondary">{CATEGORY_LABELS[getValue() as ItemCategory]}</Badge>
        ),
        enableSorting: false,
      },
      {
        accessorKey: 'purchasePrice',
        header: ({ column }) => (
          <button
            className="inline-flex items-center gap-1 font-medium"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            Purchase Price
            <SortIcon sorted={column.getIsSorted()} />
          </button>
        ),
        cell: ({ getValue }) => (
          <span className="tabular-nums">{formatCurrency(getValue() as number | null)}</span>
        ),
      },
      {
        accessorKey: 'purchaseDate',
        header: ({ column }) => (
          <button
            className="inline-flex items-center gap-1 font-medium"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            Purchase Date
            <SortIcon sorted={column.getIsSorted()} />
          </button>
        ),
        cell: ({ getValue }) => formatDate(getValue() as string | null),
        sortingFn: (a, b) => {
          const da = a.original.purchaseDate ? new Date(a.original.purchaseDate).getTime() : 0;
          const db = b.original.purchaseDate ? new Date(b.original.purchaseDate).getTime() : 0;
          return da - db;
        },
      },
      {
        accessorKey: 'location',
        header: 'Location',
        cell: ({ getValue }) => (getValue() as string | null) ?? <span className="text-gray-400">—</span>,
        enableSorting: false,
      },
    ],
    []
  );

  const table = useReactTable({
    data: filteredItems,
    columns,
    state: { sorting, columnFilters, rowSelection },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 10 } },
  });

  const selectedCount = Object.keys(rowSelection).length;
  const exportItems = table.getSelectedRowModel().rows.map((row) => row.original);
  const exportSource = exportItems.length > 0 ? exportItems : filteredItems;
  const exportRows = toExportRows(exportSource);

  const handleRowClick = useCallback(
    (itemId: string) => {
      router.push(`/dashboard/assets/${itemId}`);
    },
    [router]
  );

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  const handleExportCsv = (): void => {
    if (exportRows.length === 0) return;
    exportAsCsv(exportRows, `assets-${new Date().toISOString().slice(0, 10)}.csv`);
  };

  const handleExportExcel = async (): Promise<void> => {
    if (exportRows.length === 0) return;
    await exportAsExcel(exportRows, `assets-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 items-center gap-2">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search assets..."
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="w-40"
          >
            <option value="all">All Categories</option>
            {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </Select>
          {locations.length > 0 && (
            <Select
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
              className="w-36"
            >
              <option value="">All Locations</option>
              {locations.map((loc) => (
                <option key={loc} value={loc}>{loc}</option>
              ))}
            </Select>
          )}
        </div>
        {selectedCount > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">{selectedCount} selected</span>
            <Button variant="outline" size="sm" onClick={() => setRowSelection({})}>
              Clear selection
            </Button>
          </div>
        )}
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExportCsv} disabled={exportRows.length === 0}>
            <Download className="mr-1.5 h-4 w-4" />
            Export CSV
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportExcel} disabled={exportRows.length === 0}>
            <Download className="mr-1.5 h-4 w-4" />
            Export Excel
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      style={{ width: header.column.columnDef.size }}
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {table.getRowModel().rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={columns.length}
                    className="px-4 py-12 text-center text-sm text-gray-500"
                  >
                    No assets found
                  </td>
                </tr>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    className={cn(
                      'cursor-pointer transition-colors hover:bg-blue-50',
                      row.getIsSelected() && 'bg-blue-50/60'
                    )}
                    onClick={() => handleRowClick(row.original.id)}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between text-sm text-gray-600">
        <span>
          {filteredItems.length === 0
            ? 'No results'
            : `${table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1}–${Math.min(
                (table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize,
                filteredItems.length
              )} of ${filteredItems.length}`}
        </span>
        <div className="flex items-center gap-2">
          <Select
            value={String(table.getState().pagination.pageSize)}
            onChange={(e) => table.setPageSize(Number(e.target.value))}
            className="h-8 w-20 text-xs"
          >
            {[10, 20, 50].map((size) => (
              <option key={size} value={size}>{size} / page</option>
            ))}
          </Select>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-[4rem] text-center text-xs">
            Page {table.getState().pagination.pageIndex + 1} / {table.getPageCount() || 1}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
