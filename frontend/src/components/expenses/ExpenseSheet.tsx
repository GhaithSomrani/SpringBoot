import { useCallback, useEffect, useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useDropzone } from 'react-dropzone';
import { format } from 'date-fns';
import {
  CalendarIcon, File, FileText, Loader2, Upload, X,
} from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';

import type { CategoryDto } from '@/api/categories';
import { getCategories } from '@/api/categories';
import { getEvents } from '@/api/events';
import type { ExpenseDto, CreateExpensePayload } from '@/api/expenses';
import { createExpense, updateExpense } from '@/api/expenses';
import { uploadFileWithProgress, deleteFile } from '@/api/files';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
  SheetDescription, SheetFooter,
} from '@/components/ui/sheet';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';

// ─── Constants ────────────────────────────────────────────────────────────────

const CURRENCIES = ['USD', 'EUR', 'TND', 'GBP', 'MAD'] as const;
type Currency = (typeof CURRENCIES)[number];

const CURRENCY_SYMBOL: Record<Currency, string> = {
  USD: '$', EUR: '€', GBP: '£', TND: 'DT', MAD: 'MAD',
};

const MAX_FILES    = 5;
const MAX_SIZE     = 10 * 1024 * 1024; // 10 MB
const ACCEPT_TYPES = { 'image/*': [], 'application/pdf': ['.pdf'] };

// ─── Schema ───────────────────────────────────────────────────────────────────

const schema = z.object({
  title:         z.string().min(2, 'Minimum 2 characters').max(200, 'Too long'),
  amount:        z.coerce
                   .number({ invalid_type_error: 'Enter a number' })
                   .positive('Must be positive')
                   .multipleOf(0.01, 'Max 2 decimal places'),
  currency:      z.enum(CURRENCIES),
  categoryId:    z.string().min(1, 'Category is required'),
  subcategoryId: z.string().optional(),
  eventId:       z.string().optional(),
  date:          z.date({ required_error: 'Date is required' }),
  description:   z.string().max(500, 'Max 500 characters').optional(),
});

type FormValues = z.infer<typeof schema>;

// ─── File entry state ─────────────────────────────────────────────────────────

interface FileEntry {
  uid: string;
  fileId?: string;
  filename: string;
  contentType?: string;
  size?: number;
  progress: number;
  status: 'uploading' | 'done' | 'error';
  previewUrl?: string;
  errorMsg?: string;
}

function formatBytes(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

function fileIsImage(entry: FileEntry) {
  if (entry.contentType?.startsWith('image/')) return true;
  const ext = entry.filename.split('.').pop()?.toLowerCase();
  return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'avif'].includes(ext ?? '');
}

function fileIsPdf(entry: FileEntry) {
  return entry.contentType === 'application/pdf' || entry.filename.toLowerCase().endsWith('.pdf');
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function FilePreview({ entry }: { entry: FileEntry }) {
  if (fileIsImage(entry) && entry.previewUrl) {
    return (
      <img
        src={entry.previewUrl}
        alt={entry.filename}
        className="size-full object-cover"
      />
    );
  }
  if (fileIsPdf(entry)) {
    return <FileText className="size-5 text-red-400" />;
  }
  return <File className="size-5 text-muted-foreground" />;
}

function FileRow({
  entry,
  onRemove,
}: {
  entry: FileEntry;
  onRemove: (uid: string) => void;
}) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-border p-2.5">
      {/* Thumbnail */}
      <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted">
        <FilePreview entry={entry} />
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{entry.filename}</p>
        {entry.size != null && (
          <p className="text-[11px] text-muted-foreground">{formatBytes(entry.size)}</p>
        )}

        {entry.status === 'uploading' && (
          <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all duration-150"
              style={{ width: `${entry.progress}%` }}
            />
          </div>
        )}

        {entry.status === 'done' && (
          <p className="text-[11px] text-emerald-600 dark:text-emerald-400">Uploaded</p>
        )}

        {entry.status === 'error' && (
          <p className="text-[11px] text-destructive">{entry.errorMsg ?? 'Upload failed'}</p>
        )}
      </div>

      {/* Remove */}
      <button
        type="button"
        onClick={() => onRemove(entry.uid)}
        disabled={entry.status === 'uploading'}
        className="mt-0.5 shrink-0 text-muted-foreground transition-colors hover:text-destructive disabled:opacity-40"
        aria-label={`Remove ${entry.filename}`}
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface ExpenseSheetProps {
  groupId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Optional: passed as initialData to the categories query */
  categories?: CategoryDto[];
  editingExpense?: ExpenseDto | null;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ExpenseSheet({
  groupId,
  open,
  onOpenChange,
  categories: categoriesProp,
  editingExpense,
}: ExpenseSheetProps) {
  const qc       = useQueryClient();
  const isEditing = !!editingExpense;

  // ── File entries ────────────────────────────────────────────────────────────
  const [fileEntries, setFileEntries] = useState<FileEntry[]>([]);
  const fileEntriesRef = useRef<FileEntry[]>([]);
  fileEntriesRef.current = fileEntries;

  // ── Form ────────────────────────────────────────────────────────────────────
  const {
    register, handleSubmit, control, watch, reset, setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { currency: 'USD', date: new Date() },
  });

  const watchedCategoryId  = watch('categoryId');
  const watchedCurrency    = watch('currency') as Currency;
  const watchedDescription = watch('description') ?? '';

  // ── Data queries ────────────────────────────────────────────────────────────
  const { data: categories = [] } = useQuery({
    queryKey:    ['categories', groupId],
    queryFn:     () => getCategories(groupId),
    initialData: categoriesProp,
    enabled:     open,
  });

  const { data: events = [] } = useQuery({
    queryKey: ['events', groupId],
    queryFn:  () => getEvents(groupId),
    enabled:  open,
    select:   (evts) => evts.filter((e) => e.status === 'ACTIVE' || e.status === 'UPCOMING'),
  });

  const selectedCategory = categories.find((c) => c.id === watchedCategoryId);

  // ── Open / edit effects ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!open) {
      // Cleanup object URLs
      fileEntriesRef.current.forEach((e) => {
        if (e.previewUrl) URL.revokeObjectURL(e.previewUrl);
      });
      setFileEntries([]);
      reset({ currency: 'USD', date: new Date() });
      return;
    }

    if (editingExpense) {
      reset({
        title:         editingExpense.title,
        amount:        editingExpense.amount,
        currency:      (editingExpense.currency as Currency) ?? 'USD',
        categoryId:    editingExpense.categoryId,
        subcategoryId: editingExpense.subcategoryId ?? '',
        eventId:       editingExpense.eventId ?? '',
        date:          new Date(editingExpense.date),
        description:   editingExpense.description ?? '',
      });

      // Build file entries from existing attachments
      const ids = editingExpense.attachments?.length
        ? editingExpense.attachments
        : editingExpense.fileId
          ? [editingExpense.fileId]
          : [];

      setFileEntries(
        ids.map((fileId, i) => ({
          uid:      fileId,
          fileId,
          filename: `Attachment ${i + 1}`,
          progress: 100,
          status:   'done' as const,
        })),
      );
    } else {
      reset({ currency: 'USD', date: new Date() });
      setFileEntries([]);
    }
  }, [open, editingExpense, reset]);

  // Reset subcategory when category changes (only in create mode)
  const prevCategoryRef = useRef<string>();
  useEffect(() => {
    if (prevCategoryRef.current !== undefined && prevCategoryRef.current !== watchedCategoryId) {
      reset((vals) => ({ ...vals, subcategoryId: '' }));
    }
    prevCategoryRef.current = watchedCategoryId;
  }, [watchedCategoryId, reset]);

  // ── File drop handling ──────────────────────────────────────────────────────
  const handleDrop = useCallback(
    async (accepted: File[]) => {
      const current   = fileEntriesRef.current.filter((e) => e.status !== 'error');
      const remaining = MAX_FILES - current.length;
      if (remaining <= 0) return;
      const toProcess = accepted.slice(0, remaining);

      const newEntries: FileEntry[] = toProcess.map((f) => ({
        uid:         crypto.randomUUID(),
        filename:    f.name,
        contentType: f.type,
        size:        f.size,
        progress:    0,
        status:      'uploading' as const,
        previewUrl:  f.type.startsWith('image/') ? URL.createObjectURL(f) : undefined,
      }));

      setFileEntries((prev) => [...prev, ...newEntries]);

      await Promise.all(
        toProcess.map(async (f, i) => {
          const { uid } = newEntries[i];
          try {
            const uploaded = await uploadFileWithProgress(f, groupId, (pct) => {
              setFileEntries((prev) =>
                prev.map((e) => (e.uid === uid ? { ...e, progress: pct } : e)),
              );
            });
            setFileEntries((prev) =>
              prev.map((e) =>
                e.uid === uid
                  ? { ...e, status: 'done', fileId: uploaded.fileId, progress: 100 }
                  : e,
              ),
            );
          } catch {
            setFileEntries((prev) =>
              prev.map((e) =>
                e.uid === uid ? { ...e, status: 'error', errorMsg: 'Upload failed' } : e,
              ),
            );
          }
        }),
      );
    },
    [groupId],
  );

  const doneCount = fileEntries.filter((e) => e.status !== 'error').length;
  const anyUploading = fileEntries.some((e) => e.status === 'uploading');

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: handleDrop,
    accept: ACCEPT_TYPES,
    maxSize: MAX_SIZE,
    disabled: doneCount >= MAX_FILES,
    onDropRejected: (rejections) => {
      rejections.forEach((r) => {
        r.errors.forEach((err) => {
          if (err.code === 'file-too-large')
            toast.error(`${r.file.name}: exceeds 10 MB`);
          else if (err.code === 'too-many-files')
            toast.error('Max 5 files allowed');
          else
            toast.error(`${r.file.name}: ${err.message}`);
        });
      });
    },
  });

  async function removeFile(uid: string) {
    const entry = fileEntriesRef.current.find((e) => e.uid === uid);
    if (!entry) return;
    if (entry.previewUrl) URL.revokeObjectURL(entry.previewUrl);
    setFileEntries((prev) => prev.filter((e) => e.uid !== uid));
    if (entry.fileId) {
      try { await deleteFile(entry.fileId); } catch { /* best-effort */ }
    }
  }

  // ── Submit ──────────────────────────────────────────────────────────────────
  const saveMut = useMutation({
    mutationFn: (payload: CreateExpensePayload) =>
      isEditing
        ? updateExpense(groupId, editingExpense!.id, payload)
        : createExpense(groupId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenses', groupId] });
      qc.invalidateQueries({ queryKey: ['summary', groupId] });
      toast.success(isEditing ? 'Expense updated' : 'Expense added');
      onOpenChange(false);
    },
    onError: (err) => {
      if (axios.isAxiosError(err) && err.response?.status === 400) {
        const body = err.response.data as {
          message?: string;
          errors?: Record<string, string>;
        };
        const fieldErrors = body?.errors;
        if (fieldErrors && Object.keys(fieldErrors).length > 0) {
          Object.entries(fieldErrors).forEach(([field, msg]) => {
            setError(field as keyof FormValues, { message: msg });
          });
        } else {
          toast.error(body?.message ?? 'Validation failed');
        }
      } else {
        toast.error('Something went wrong');
      }
    },
  });

  function onSubmit(data: FormValues) {
    const attachments = fileEntries
      .filter((e) => e.status === 'done' && e.fileId)
      .map((e) => e.fileId!);

    saveMut.mutate({
      title:         data.title,
      amount:        data.amount,
      currency:      data.currency,
      categoryId:    data.categoryId,
      subcategoryId: data.subcategoryId || undefined,
      eventId:       data.eventId || undefined,
      date:          format(data.date, 'yyyy-MM-dd'),
      description:   data.description || undefined,
      attachments,
    });
  }

  const isPending = isSubmitting || saveMut.isPending;
  const currSymbol = CURRENCY_SYMBOL[watchedCurrency] ?? watchedCurrency;
  const prefixWide = currSymbol.length > 1;

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <Sheet open={open} onOpenChange={(v) => { if (!isPending) onOpenChange(v); }}>
      <SheetContent
        side="right"
        showCloseButton={false}
        className="flex flex-col gap-0 p-0 sm:max-w-[480px]"
      >
        {/* Header */}
        <SheetHeader className="flex-row items-start justify-between gap-2 border-b border-border px-6 py-4">
          <div>
            <SheetTitle>{isEditing ? 'Edit expense' : 'Add expense'}</SheetTitle>
            <SheetDescription>
              {isEditing
                ? 'Update the fields below and save.'
                : 'Fill in the details for the new expense.'}
            </SheetDescription>
          </div>
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            className="mt-0.5 shrink-0 text-muted-foreground"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
            aria-label="Close"
          >
            <X className="size-4" />
          </Button>
        </SheetHeader>

        {/* Scrollable form */}
        <form
          id="expense-form"
          onSubmit={handleSubmit(onSubmit)}
          noValidate
          className="flex-1 space-y-5 overflow-y-auto px-6 py-5"
        >
          {/* Title */}
          <div className="space-y-1.5">
            <Label htmlFor="ef-title">
              Title <span className="text-destructive">*</span>
            </Label>
            <Input
              id="ef-title"
              placeholder="Dinner, Hotel, Groceries…"
              aria-invalid={!!errors.title}
              {...register('title')}
            />
            {errors.title && (
              <p className="text-xs text-destructive">{errors.title.message}</p>
            )}
          </div>

          {/* Amount + Currency */}
          <div className="grid grid-cols-[1fr_auto] gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ef-amount">
                Amount <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <span
                  className={cn(
                    'pointer-events-none absolute inset-y-0 left-0 flex items-center text-sm text-muted-foreground',
                    prefixWide ? 'pl-2.5' : 'pl-3',
                  )}
                >
                  {currSymbol}
                </span>
                <Input
                  id="ef-amount"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  aria-invalid={!!errors.amount}
                  className={prefixWide ? 'pl-10' : 'pl-7'}
                  {...register('amount')}
                />
              </div>
              {errors.amount && (
                <p className="text-xs text-destructive">{errors.amount.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ef-currency">Currency</Label>
              <select
                id="ef-currency"
                className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                {...register('currency')}
              >
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Category */}
          <div className="space-y-1.5">
            <Label htmlFor="ef-category">
              Category <span className="text-destructive">*</span>
            </Label>
            <select
              id="ef-category"
              className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              aria-invalid={!!errors.categoryId}
              {...register('categoryId')}
            >
              <option value="">Select a category</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            {errors.categoryId && (
              <p className="text-xs text-destructive">{errors.categoryId.message}</p>
            )}
          </div>

          {/* Subcategory — only if selected category has subs */}
          {selectedCategory && selectedCategory.subcategories.length > 0 && (
            <div className="space-y-1.5">
              <Label htmlFor="ef-sub">
                Subcategory{' '}
                <span className="font-normal text-muted-foreground">(optional)</span>
              </Label>
              <select
                id="ef-sub"
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                {...register('subcategoryId')}
              >
                <option value="">None</option>
                {selectedCategory.subcategories.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Event */}
          <div className="space-y-1.5">
            <Label htmlFor="ef-event">
              Event{' '}
              <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            <select
              id="ef-event"
              className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              {...register('eventId')}
            >
              <option value="">No event</option>
              {events.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.title}
                  {e.status === 'UPCOMING' ? ' (upcoming)' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Date */}
          <div className="space-y-1.5">
            <Label>
              Date <span className="text-destructive">*</span>
            </Label>
            <Controller
              control={control}
              name="date"
              render={({ field }) => (
                <Popover>
                  <PopoverTrigger
                    render={
                      <Button
                        type="button"
                        variant="outline"
                        className={cn(
                          'w-full justify-start text-left font-normal',
                          !field.value && 'text-muted-foreground',
                        )}
                      />
                    }
                  >
                    <CalendarIcon className="mr-2 size-3.5 shrink-0" />
                    {field.value ? format(field.value, 'PPP') : 'Pick a date'}
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={field.value}
                      onSelect={(day) => day && field.onChange(day)}
                    />
                  </PopoverContent>
                </Popover>
              )}
            />
            {errors.date && (
              <p className="text-xs text-destructive">{errors.date.message}</p>
            )}
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="ef-desc">
                Description{' '}
                <span className="font-normal text-muted-foreground">(optional)</span>
              </Label>
              <span
                className={cn(
                  'text-[11px] tabular-nums',
                  watchedDescription.length > 450
                    ? 'text-destructive'
                    : 'text-muted-foreground',
                )}
              >
                {watchedDescription.length}/500
              </span>
            </div>
            <textarea
              id="ef-desc"
              rows={3}
              placeholder="Any extra details…"
              aria-invalid={!!errors.description}
              className="w-full resize-none rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive"
              {...register('description')}
            />
            {errors.description && (
              <p className="text-xs text-destructive">{errors.description.message}</p>
            )}
          </div>

          {/* Attachments */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>
                Attachments{' '}
                <span className="font-normal text-muted-foreground">(optional)</span>
              </Label>
              <span className="text-[11px] text-muted-foreground">
                {doneCount}/{MAX_FILES}
              </span>
            </div>

            {/* Existing / newly uploaded files */}
            {fileEntries.length > 0 && (
              <div className="space-y-2">
                {fileEntries.map((entry) => (
                  <FileRow key={entry.uid} entry={entry} onRemove={removeFile} />
                ))}
              </div>
            )}

            {/* Drop zone — hidden once limit reached */}
            {doneCount < MAX_FILES && (
              <div
                {...getRootProps()}
                className={cn(
                  'cursor-pointer rounded-lg border-2 border-dashed border-border p-4 text-center transition-colors hover:border-ring/60 hover:bg-muted/30',
                  isDragActive && 'border-primary bg-primary/5',
                )}
              >
                <input {...getInputProps()} />
                <Upload className="mx-auto mb-1.5 size-5 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  {isDragActive
                    ? 'Drop files here'
                    : 'Drag & drop files, or click to browse'}
                </p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  Images and PDFs · max {MAX_FILES} files · 10 MB each
                </p>
              </div>
            )}
          </div>
        </form>

        {/* Footer */}
        <SheetFooter className="flex-row justify-end gap-2 border-t border-border px-6 py-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            form="expense-form"
            type="submit"
            disabled={isPending || anyUploading}
          >
            {isPending ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                Saving…
              </>
            ) : anyUploading ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                Uploading…
              </>
            ) : isEditing ? (
              'Save changes'
            ) : (
              'Add expense'
            )}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
