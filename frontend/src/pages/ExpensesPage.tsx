import { useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  createColumnHelper,
  type SortingState,
} from '@tanstack/react-table';
import { format } from 'date-fns';
import type { DateRange } from 'react-day-picker';
import {
  Plus, Pencil, Trash2, Filter,
  ChevronUp, ChevronDown, ChevronsUpDown, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';

import { getGroup } from '@/api/groups';
import { getCategories } from '@/api/categories';
import {
  getExpenses, getExpenseSummary, deleteExpense,
  type ExpenseDto, type ExpenseFilters,
} from '@/api/expenses';
import { useAuth } from '@/hooks/useAuth';
import { SummaryChart } from '@/components/expenses/SummaryChart';
import { ExpenseSheet } from '@/components/expenses/ExpenseSheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';

// ─── Column helper ─────────────────────────────────────────────────────────────

const col = createColumnHelper<ExpenseDto>();

// ─── Page ──────────────────────────────────────────────────────────────────────

export function ExpensesPage() {
  const { groupId } = useParams<{ groupId: string }>();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // ── Filters state ──────────────────────────────────────────────────────────
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [filterCategoryId, setFilterCategoryId] = useState('');
  const [filterSubcategoryId, setFilterSubcategoryId] = useState('');
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');
  const [datePickerOpen, setDatePickerOpen] = useState(false);

  // ── Pagination & sorting ───────────────────────────────────────────────────
  const [page, setPage] = useState(0);
  const [sorting, setSorting] = useState<SortingState>([{ id: 'date', desc: true }]);

  // ── Sheet & delete dialog ──────────────────────────────────────────────────
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<ExpenseDto | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ExpenseDto | null>(null);

  // ── Derived filter object ──────────────────────────────────────────────────
  const filters: ExpenseFilters = useMemo(() => ({
    dateFrom: dateRange?.from ? format(dateRange.from, 'yyyy-MM-dd') : undefined,
    dateTo: dateRange?.to ? format(dateRange.to, 'yyyy-MM-dd') : undefined,
    categoryId: filterCategoryId || undefined,
    subcategoryId: filterSubcategoryId || undefined,
    minAmount: minAmount ? parseFloat(minAmount) : undefined,
    maxAmount: maxAmount ? parseFloat(maxAmount) : undefined,
  }), [dateRange, filterCategoryId, filterSubcategoryId, minAmount, maxAmount]);

  const sortBy = sorting[0]?.id ?? 'date';
  const sortDir: 'asc' | 'desc' = sorting[0]?.desc === false ? 'asc' : 'desc';

  // ── Queries ────────────────────────────────────────────────────────────────
  const { data: group } = useQuery({
    queryKey: ['group', groupId],
    queryFn: () => getGroup(groupId!),
    enabled: !!groupId,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['categories', groupId],
    queryFn: () => getCategories(groupId!),
    enabled: !!groupId,
  });

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ['expenses', 'summary', groupId, filters],
    queryFn: () => getExpenseSummary(groupId!, filters),
    enabled: !!groupId,
  });

  const { data: paged, isLoading: expensesLoading } = useQuery({
    queryKey: ['expenses', groupId, filters, page, sortBy, sortDir],
    queryFn: () => getExpenses(groupId!, filters, page, 20, sortBy, sortDir),
    enabled: !!groupId,
    placeholderData: (prev) => prev,
  });

  // ── Permission check ───────────────────────────────────────────────────────
  const canEdit = useMemo(() => {
    if (!group || !user) return false;
    if (group.ownerId === user.id) return true;
    const member = group.members.find((m) => m.userId === user.id);
    return member?.permission === 'EDIT' || member?.permission === 'ADMIN';
  }, [group, user]);

  // ── Resolve helpers ────────────────────────────────────────────────────────
  function resolveEmail(userId: string): string {
    if (!group) return userId.slice(0, 8) + '…';
    if (group.ownerId === userId && user?.id === userId) return user.email;
    const member = group.members.find((m) => m.userId === userId);
    return member?.email ?? userId.slice(0, 8) + '…';
  }

  function resolveCategory(categoryId: string): string {
    return categories.find((c) => c.id === categoryId)?.name ?? categoryId;
  }

  function resolveSubcategory(categoryId: string, subcategoryId?: string): string {
    if (!subcategoryId) return '—';
    const cat = categories.find((c) => c.id === categoryId);
    return cat?.subcategories.find((s) => s.id === subcategoryId)?.name ?? subcategoryId;
  }

  // ── Delete mutation ────────────────────────────────────────────────────────
  const deleteMutation = useMutation({
    mutationFn: (expense: ExpenseDto) => deleteExpense(groupId!, expense.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses', groupId] });
      queryClient.invalidateQueries({ queryKey: ['expenses', 'summary', groupId] });
      toast.success('Expense deleted');
      setDeleteTarget(null);
    },
    onError: (err) => {
      const msg =
        axios.isAxiosError(err) && err.response
          ? (err.response.data?.message ?? 'Failed to delete')
          : 'Something went wrong';
      toast.error(msg);
    },
  });

  // ── Table columns ──────────────────────────────────────────────────────────
  const selectedCategory = categories.find((c) => c.id === filterCategoryId);

  const columns = useMemo(
    () => [
      col.accessor('date', {
        header: 'Date',
        cell: (info) => format(new Date(info.getValue()), 'MMM d, yyyy'),
      }),
      col.accessor('title', {
        header: 'Title',
        cell: (info) => (
          <span className="font-medium text-foreground">{info.getValue()}</span>
        ),
      }),
      col.accessor('categoryId', {
        header: 'Category',
        enableSorting: false,
        cell: (info) => resolveCategory(info.getValue()),
      }),
      col.accessor('subcategoryId', {
        header: 'Subcategory',
        enableSorting: false,
        cell: (info) => resolveSubcategory(info.row.original.categoryId, info.getValue()),
      }),
      col.accessor('amount', {
        header: 'Amount',
        cell: (info) => (
          <span className="tabular-nums font-medium">
            {info.row.original.currency} {info.getValue().toFixed(2)}
          </span>
        ),
      }),
      col.accessor('addedBy', {
        header: 'Added by',
        enableSorting: false,
        cell: (info) => (
          <span className="text-muted-foreground text-xs">{resolveEmail(info.getValue())}</span>
        ),
      }),
      col.display({
        id: 'actions',
        header: '',
        cell: ({ row }) => (
          <div className="flex items-center justify-end gap-1">
            <Button
              size="icon-sm"
              variant="ghost"
              disabled={!canEdit}
              onClick={() => {
                setEditingExpense(row.original);
                setSheetOpen(true);
              }}
              title="Edit"
            >
              <Pencil className="size-3.5" />
            </Button>
            <Button
              size="icon-sm"
              variant="ghost"
              className="text-muted-foreground hover:text-destructive"
              disabled={!canEdit}
              onClick={() => setDeleteTarget(row.original)}
              title="Delete"
            >
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        ),
      }),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [categories, group, user, canEdit],
  );

  const table = useReactTable({
    data: paged?.content ?? [],
    columns,
    pageCount: paged?.totalPages ?? -1,
    state: { sorting, pagination: { pageIndex: page, pageSize: 20 } },
    onSortingChange: (updater) => {
      setSorting(updater);
      setPage(0);
    },
    onPaginationChange: (updater) => {
      const next =
        typeof updater === 'function' ? updater({ pageIndex: page, pageSize: 20 }) : updater;
      setPage(next.pageIndex);
    },
    manualPagination: true,
    manualSorting: true,
    getCoreRowModel: getCoreRowModel(),
  });

  function resetFilters() {
    setDateRange(undefined);
    setFilterCategoryId('');
    setFilterSubcategoryId('');
    setMinAmount('');
    setMaxAmount('');
    setPage(0);
  }

  const hasFilters = !!(dateRange || filterCategoryId || minAmount || maxAmount);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Expenses</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">{group?.name ?? '…'}</p>
        </div>
        <Button
          size="sm"
          disabled={!canEdit}
          onClick={() => {
            setEditingExpense(null);
            setSheetOpen(true);
          }}
        >
          <Plus className="size-3.5" />
          Add expense
        </Button>
      </div>

      {/* Summary chart */}
      <SummaryChart summary={summary} categories={categories} isLoading={summaryLoading} />

      {/* Filter bar */}
      <div className="mb-4 flex flex-wrap items-end gap-2">
        {/* Date range */}
        <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
          <PopoverTrigger
            render={
              <Button
                variant="outline"
                size="sm"
                className={cn(dateRange && 'border-ring text-foreground')}
              />
            }
          >
            <Filter className="size-3.5" />
            {dateRange?.from
              ? dateRange.to
                ? `${format(dateRange.from, 'MMM d')} – ${format(dateRange.to, 'MMM d')}`
                : format(dateRange.from, 'MMM d')
              : 'Date range'}
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="range"
              selected={dateRange}
              onSelect={(range) => {
                setDateRange(range ?? undefined);
                if (range?.to) setDatePickerOpen(false);
                setPage(0);
              }}
            />
          </PopoverContent>
        </Popover>

        {/* Category */}
        <select
          value={filterCategoryId}
          onChange={(e) => {
            setFilterCategoryId(e.target.value);
            setFilterSubcategoryId('');
            setPage(0);
          }}
          className="h-7 rounded-md border border-input bg-transparent px-2 text-xs outline-none focus-visible:border-ring"
        >
          <option value="">All categories</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name}
            </option>
          ))}
        </select>

        {/* Subcategory */}
        {selectedCategory && selectedCategory.subcategories.length > 0 && (
          <select
            value={filterSubcategoryId}
            onChange={(e) => { setFilterSubcategoryId(e.target.value); setPage(0); }}
            className="h-7 rounded-md border border-input bg-transparent px-2 text-xs outline-none focus-visible:border-ring"
          >
            <option value="">All subcategories</option>
            {selectedCategory.subcategories.map((sub) => (
              <option key={sub.id} value={sub.id}>
                {sub.name}
              </option>
            ))}
          </select>
        )}

        {/* Amount range */}
        <Input
          type="number"
          placeholder="Min $"
          value={minAmount}
          onChange={(e) => { setMinAmount(e.target.value); setPage(0); }}
          className="h-7 w-24 text-xs"
        />
        <Input
          type="number"
          placeholder="Max $"
          value={maxAmount}
          onChange={(e) => { setMaxAmount(e.target.value); setPage(0); }}
          className="h-7 w-24 text-xs"
        />

        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={resetFilters} className="text-muted-foreground">
            Reset
          </Button>
        )}

        {!canEdit && (
          <Badge variant="secondary" className="ml-auto">
            View only
          </Badge>
        )}
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((header) => {
                  const canSort = header.column.getCanSort();
                  const sorted = header.column.getIsSorted();
                  return (
                    <th
                      key={header.id}
                      className={cn(
                        'px-4 py-2.5 text-left text-xs font-medium text-muted-foreground',
                        canSort && 'cursor-pointer select-none hover:text-foreground',
                      )}
                      onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
                    >
                      <span className="flex items-center gap-1">
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {canSort &&
                          (sorted === 'asc' ? (
                            <ChevronUp className="size-3" />
                          ) : sorted === 'desc' ? (
                            <ChevronDown className="size-3" />
                          ) : (
                            <ChevronsUpDown className="size-3 opacity-40" />
                          ))}
                      </span>
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-border">
            {expensesLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  {columns.map((_, j) => (
                    <td key={j} className="px-4 py-3">
                      <Skeleton className="h-4 w-full" />
                    </td>
                  ))}
                </tr>
              ))
            ) : table.getRowModel().rows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-12 text-center text-sm text-muted-foreground"
                >
                  No expenses found.{hasFilters ? ' Try adjusting your filters.' : ''}
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr key={row.id} className="hover:bg-muted/30 transition-colors">
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-4 py-3 text-foreground">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {paged && paged.totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Page {paged.number + 1} of {paged.totalPages} &middot; {paged.totalElements} expenses
          </span>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft className="size-3.5" />
              Previous
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={page >= paged.totalPages - 1}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
              <ChevronRight className="size-3.5" />
            </Button>
          </div>
        </div>
      )}

      {/* Add / edit sheet */}
      <ExpenseSheet
        groupId={groupId!}
        open={sheetOpen}
        onOpenChange={(v) => {
          setSheetOpen(v);
          if (!v) setEditingExpense(null);
        }}
        categories={categories}
        editingExpense={editingExpense}
      />

      {/* Delete confirm */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(v) => { if (!v) setDeleteTarget(null); }}
      >
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete expense?</AlertDialogTitle>
            <AlertDialogDescription>
              "{deleteTarget?.title}" will be permanently removed. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteTarget(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget)}
            >
              {deleteMutation.isPending ? 'Deleting…' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
