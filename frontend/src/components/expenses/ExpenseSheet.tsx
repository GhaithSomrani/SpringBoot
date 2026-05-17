import { useEffect, useState, useCallback } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useDropzone } from 'react-dropzone';
import { format } from 'date-fns';
import { CalendarIcon, Paperclip, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';

import type { CategoryDto } from '@/api/categories';
import type { ExpenseDto, CreateExpensePayload } from '@/api/expenses';
import { createExpense, updateExpense } from '@/api/expenses';
import { uploadFile } from '@/api/files';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';

// ─── Schema ───────────────────────────────────────────────────────────────────

const expenseSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  amount: z.coerce.number({ invalid_type_error: 'Must be a number' }).positive('Must be positive'),
  currency: z.string().length(3, 'Must be 3 letters (e.g. USD)').toUpperCase(),
  categoryId: z.string().min(1, 'Category is required'),
  subcategoryId: z.string().optional(),
  date: z.date({ required_error: 'Date is required' }),
  description: z.string().max(1000).optional(),
});

type ExpenseForm = z.infer<typeof expenseSchema>;

// ─── File upload state ─────────────────────────────────────────────────────────

interface AttachedFile {
  fileId: string;
  filename: string;
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface ExpenseSheetProps {
  groupId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  categories: CategoryDto[];
  editingExpense?: ExpenseDto | null;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ExpenseSheet({
  groupId,
  open,
  onOpenChange,
  categories,
  editingExpense,
}: ExpenseSheetProps) {
  const queryClient = useQueryClient();
  const isEditing = !!editingExpense;

  const [attachedFile, setAttachedFile] = useState<AttachedFile | null>(null);
  const [uploading, setUploading] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    watch,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<ExpenseForm>({
    resolver: zodResolver(expenseSchema),
    defaultValues: { currency: 'USD' },
  });

  const watchedCategoryId = watch('categoryId');
  const selectedCategory = categories.find((c) => c.id === watchedCategoryId);

  // Pre-fill when editing
  useEffect(() => {
    if (open && editingExpense) {
      reset({
        title: editingExpense.title,
        amount: editingExpense.amount,
        currency: editingExpense.currency,
        categoryId: editingExpense.categoryId,
        subcategoryId: editingExpense.subcategoryId ?? '',
        date: new Date(editingExpense.date),
        description: editingExpense.description ?? '',
      });
      if (editingExpense.fileId) {
        setAttachedFile({ fileId: editingExpense.fileId, filename: 'Attached file' });
      }
    } else if (open && !editingExpense) {
      reset({ currency: 'USD' });
      setAttachedFile(null);
    }
  }, [open, editingExpense, reset]);

  // Reset subcategory when category changes
  useEffect(() => {
    setValue('subcategoryId', '');
  }, [watchedCategoryId, setValue]);

  function handleClose(v: boolean) {
    if (!v) {
      reset({ currency: 'USD' });
      setAttachedFile(null);
    }
    onOpenChange(v);
  }

  // Dropzone
  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (!file) return;
      setUploading(true);
      try {
        const uploaded = await uploadFile(file, groupId);
        setAttachedFile({ fileId: uploaded.fileId, filename: uploaded.filename });
        toast.success(`${uploaded.filename} uploaded`);
      } catch {
        toast.error('File upload failed');
      } finally {
        setUploading(false);
      }
    },
    [groupId],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    maxFiles: 1,
    disabled: uploading,
  });

  // Mutations
  const saveMutation = useMutation({
    mutationFn: (payload: CreateExpensePayload) =>
      isEditing
        ? updateExpense(groupId, editingExpense!.id, payload)
        : createExpense(groupId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses', groupId] });
      queryClient.invalidateQueries({ queryKey: ['expenses', 'summary', groupId] });
      toast.success(isEditing ? 'Expense updated' : 'Expense added');
      handleClose(false);
    },
    onError: (err) => {
      const msg =
        axios.isAxiosError(err) && err.response
          ? (err.response.data?.message ?? 'Failed to save expense')
          : 'Something went wrong';
      toast.error(msg);
    },
  });

  function onSubmit(data: ExpenseForm) {
    const payload: CreateExpensePayload = {
      title: data.title,
      amount: data.amount,
      currency: data.currency,
      categoryId: data.categoryId,
      subcategoryId: data.subcategoryId || undefined,
      date: format(data.date, 'yyyy-MM-dd'),
      description: data.description || undefined,
      fileId: attachedFile?.fileId,
    };
    saveMutation.mutate(payload);
  }

  const isPending = isSubmitting || saveMutation.isPending;

  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetContent className="flex flex-col gap-0 p-0 sm:max-w-md">
        <SheetHeader className="border-b border-border px-6 py-4">
          <SheetTitle>{isEditing ? 'Edit expense' : 'Add expense'}</SheetTitle>
          <SheetDescription>
            {isEditing ? 'Update the details below.' : 'Fill in the details for the new expense.'}
          </SheetDescription>
        </SheetHeader>

        <form
          id="expense-form"
          onSubmit={handleSubmit(onSubmit)}
          noValidate
          className="flex-1 overflow-y-auto px-6 py-4 space-y-4"
        >
          {/* Title */}
          <div className="space-y-1.5">
            <Label htmlFor="expense-title">Title</Label>
            <Input
              id="expense-title"
              placeholder="Dinner, Hotel, Flight…"
              aria-invalid={!!errors.title}
              {...register('title')}
            />
            {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
          </div>

          {/* Amount + Currency */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="expense-amount">Amount</Label>
              <Input
                id="expense-amount"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                aria-invalid={!!errors.amount}
                {...register('amount')}
              />
              {errors.amount && <p className="text-xs text-destructive">{errors.amount.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="expense-currency">Currency</Label>
              <Input
                id="expense-currency"
                placeholder="USD"
                maxLength={3}
                aria-invalid={!!errors.currency}
                {...register('currency')}
              />
              {errors.currency && <p className="text-xs text-destructive">{errors.currency.message}</p>}
            </div>
          </div>

          {/* Category */}
          <div className="space-y-1.5">
            <Label htmlFor="expense-category">Category</Label>
            <select
              id="expense-category"
              className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              aria-invalid={!!errors.categoryId}
              {...register('categoryId')}
            >
              <option value="">Select a category</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
            {errors.categoryId && <p className="text-xs text-destructive">{errors.categoryId.message}</p>}
          </div>

          {/* Subcategory (only if category has subcategories) */}
          {selectedCategory && selectedCategory.subcategories.length > 0 && (
            <div className="space-y-1.5">
              <Label htmlFor="expense-subcategory">
                Subcategory{' '}
                <span className="text-muted-foreground font-normal">(optional)</span>
              </Label>
              <select
                id="expense-subcategory"
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-ring/50"
                {...register('subcategoryId')}
              >
                <option value="">None</option>
                {selectedCategory.subcategories.map((sub) => (
                  <option key={sub.id} value={sub.id}>
                    {sub.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Date picker */}
          <div className="space-y-1.5">
            <Label>Date</Label>
            <Controller
              control={control}
              name="date"
              render={({ field }) => (
                <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
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
                    <CalendarIcon className="mr-2 size-3.5" />
                    {field.value ? format(field.value, 'PPP') : 'Pick a date'}
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={field.value}
                      onSelect={(day) => {
                        field.onChange(day);
                        setCalendarOpen(false);
                      }}
                    />
                  </PopoverContent>
                </Popover>
              )}
            />
            {errors.date && <p className="text-xs text-destructive">{errors.date.message}</p>}
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="expense-desc">
              Description{' '}
              <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <textarea
              id="expense-desc"
              rows={3}
              placeholder="Any extra details…"
              className="w-full resize-none rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              {...register('description')}
            />
          </div>

          {/* File upload */}
          <div className="space-y-1.5">
            <Label>Attachment <span className="text-muted-foreground font-normal">(optional)</span></Label>
            {attachedFile ? (
              <div className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm">
                <Paperclip className="size-3.5 shrink-0 text-muted-foreground" />
                <span className="flex-1 truncate text-foreground">{attachedFile.filename}</span>
                <button
                  type="button"
                  onClick={() => setAttachedFile(null)}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            ) : (
              <div
                {...getRootProps()}
                className={cn(
                  'cursor-pointer rounded-lg border-2 border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground transition-colors hover:border-ring hover:text-foreground',
                  isDragActive && 'border-ring bg-muted/30 text-foreground',
                  uploading && 'pointer-events-none opacity-60',
                )}
              >
                <input {...getInputProps()} />
                {uploading ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="size-3.5 animate-spin" />
                    Uploading…
                  </span>
                ) : isDragActive ? (
                  'Drop the file here'
                ) : (
                  'Drag & drop a file, or click to select'
                )}
              </div>
            )}
          </div>
        </form>

        <SheetFooter className="border-t border-border px-6 py-4">
          <Button variant="outline" type="button" onClick={() => handleClose(false)}>
            Cancel
          </Button>
          <Button form="expense-form" type="submit" disabled={isPending || uploading}>
            {isPending ? 'Saving…' : isEditing ? 'Save changes' : 'Add expense'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
