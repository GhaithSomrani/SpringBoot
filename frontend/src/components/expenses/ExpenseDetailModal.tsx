import { useEffect, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { formatDistanceToNow } from 'date-fns';
import {
  FileText, ChevronLeft, ChevronRight, X, Pencil, Trash2, Calendar, Tag,
  User, AlertTriangle,
} from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';

import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

import { getExpense, deleteExpense, type ExpenseDto } from '@/api/expenses';
import { getCategories, type CategoryDto } from '@/api/categories';
import { getEvents } from '@/api/events';
import { getGroup } from '@/api/groups';
import { getAuditLogs, type AuditLogDto, type AuditAction } from '@/api/audit';
import api from '@/api/axios';

// ─── types ────────────────────────────────────────────────────────────────────

interface BlobEntry {
  fileId: string;
  objectUrl: string;
  contentType: string;
  filename: string;
}

interface Props {
  expenseId: string | null;
  groupId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canEdit?: boolean;
  initialExpense?: ExpenseDto;
  onEditClick?: (expense: ExpenseDto) => void;
}

// ─── constants ────────────────────────────────────────────────────────────────

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$', EUR: '€', GBP: '£', TND: 'DT', MAD: 'MAD',
};

const ACTION_BADGE: Record<AuditAction, { label: string; variant: 'success' | 'outline' | 'destructive' | 'secondary' }> = {
  CREATED:          { label: 'Created',          variant: 'success' },
  UPDATED:          { label: 'Updated',          variant: 'outline' },
  DELETED:          { label: 'Deleted',          variant: 'destructive' },
  JOINED:           { label: 'Joined',           variant: 'success' },
  LEFT:             { label: 'Left',             variant: 'secondary' },
  PERMISSION_CHANGED: { label: 'Permission changed', variant: 'outline' },
};

// ─── helpers ──────────────────────────────────────────────────────────────────

function formatAmount(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${CURRENCY_SYMBOLS[currency] ?? currency} ${amount.toFixed(2)}`;
  }
}

function findCategory(categories: CategoryDto[], id: string) {
  return categories.find((c) => c.id === id);
}

function findSubcategory(categories: CategoryDto[], catId: string, subId: string) {
  return categories.find((c) => c.id === catId)?.subcategories.find((s) => s.id === subId);
}

// ─── sub-components ───────────────────────────────────────────────────────────

function SkeletonBody() {
  return (
    <div className="space-y-4 p-1">
      <div className="flex items-start gap-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-8 w-24 ml-auto" />
      </div>
      <div className="grid grid-cols-2 gap-6">
        <div className="space-y-3">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-16 w-full" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-20" />
          <div className="grid grid-cols-3 gap-2">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="aspect-square rounded-lg" />)}
          </div>
        </div>
      </div>
      <div className="space-y-2 pt-2 border-t">
        <Skeleton className="h-4 w-24" />
        {[1, 2].map((i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="h-7 w-16 rounded-full" />
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-20 ml-auto" />
          </div>
        ))}
      </div>
    </div>
  );
}

function AuditBadge({ action }: { action: AuditAction }) {
  const cfg = ACTION_BADGE[action] ?? { label: action, variant: 'outline' as const };
  return (
    <Badge variant={cfg.variant} className="text-[10px] px-1.5 py-0">
      {cfg.label}
    </Badge>
  );
}

// ─── Lightbox ────────────────────────────────────────────────────────────────

function Lightbox({
  blobs,
  index,
  onClose,
  onPrev,
  onNext,
}: {
  blobs: BlobEntry[];
  index: number;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  const entry = blobs[index];

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') onPrev();
      if (e.key === 'ArrowRight') onNext();
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose, onPrev, onNext]);

  if (!entry) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85"
      onClick={onClose}
    >
      {/* prev */}
      {blobs.length > 1 && (
        <button
          onClick={(e) => { e.stopPropagation(); onPrev(); }}
          className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white hover:bg-white/25 transition-colors"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
      )}

      <img
        src={entry.objectUrl}
        alt={entry.filename}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[85vh] max-w-[85vw] rounded-lg object-contain shadow-2xl"
      />

      {/* next */}
      {blobs.length > 1 && (
        <button
          onClick={(e) => { e.stopPropagation(); onNext(); }}
          className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white hover:bg-white/25 transition-colors"
        >
          <ChevronRight className="h-6 w-6" />
        </button>
      )}

      {/* close */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/25 transition-colors"
      >
        <X className="h-5 w-5" />
      </button>

      {/* counter */}
      {blobs.length > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/50 px-3 py-1 text-xs text-white">
          {index + 1} / {blobs.length}
        </div>
      )}
    </div>
  );
}

// ─── main component ──────────────────────────────────────────────────────────

export function ExpenseDetailModal({
  expenseId,
  groupId,
  open,
  onOpenChange,
  canEdit = false,
  initialExpense,
  onEditClick,
}: Props) {
  const qc = useQueryClient();
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [blobs, setBlobs] = useState<BlobEntry[]>([]);
  const blobsRevokeRef = useRef<string[]>([]);

  // ── queries ────────────────────────────────────────────────────────────────

  const { data: expense, isLoading: loadingExpense, error: expenseError } = useQuery({
    queryKey: ['expense', groupId, expenseId],
    queryFn: () => getExpense(groupId, expenseId!),
    enabled: open && !!expenseId,
    initialData: initialExpense,
    staleTime: 30_000,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['categories', groupId],
    queryFn: () => getCategories(groupId),
    enabled: open && !!groupId,
    staleTime: 60_000,
  });

  const { data: events = [] } = useQuery({
    queryKey: ['events', groupId],
    queryFn: () => getEvents(groupId),
    enabled: open && !!groupId,
    staleTime: 60_000,
  });

  const { data: group } = useQuery({
    queryKey: ['group', groupId],
    queryFn: () => getGroup(groupId),
    enabled: open && !!groupId,
    staleTime: 60_000,
  });

  const { data: auditPage, isLoading: loadingAudit } = useQuery({
    queryKey: ['audit', groupId, 'EXPENSE', expenseId],
    queryFn: () =>
      getAuditLogs(groupId, { entityType: 'EXPENSE', entityId: expenseId! }, 0, 20),
    enabled: open && !!expenseId,
    staleTime: 30_000,
  });

  const auditLogs: AuditLogDto[] = auditPage?.content ?? [];

  // ── file blobs ─────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!open || !expense) {
      // revoke stale URLs
      blobsRevokeRef.current.forEach((u) => URL.revokeObjectURL(u));
      blobsRevokeRef.current = [];
      setBlobs([]);
      return;
    }

    const fileIds: string[] = [];
    if (expense.attachments && expense.attachments.length > 0) {
      fileIds.push(...expense.attachments);
    } else if (expense.fileId) {
      fileIds.push(expense.fileId);
    }

    if (fileIds.length === 0) {
      setBlobs([]);
      return;
    }

    let cancelled = false;

    async function fetchBlobs() {
      const results: BlobEntry[] = [];
      for (const fid of fileIds) {
        try {
          const res = await api.get<Blob>(`/api/files/${fid}`, { responseType: 'blob' });
          const blob = res.data;
          const objectUrl = URL.createObjectURL(blob);
          blobsRevokeRef.current.push(objectUrl);
          results.push({
            fileId: fid,
            objectUrl,
            contentType: blob.type,
            filename: fid,
          });
        } catch {
          // skip unavailable files
        }
      }
      if (!cancelled) setBlobs(results);
    }

    fetchBlobs();
    return () => { cancelled = true; };
  }, [open, expense]);

  // cleanup on unmount
  useEffect(() => {
    return () => {
      blobsRevokeRef.current.forEach((u) => URL.revokeObjectURL(u));
    };
  }, []);

  // ── delete mutation ────────────────────────────────────────────────────────

  const deleteMutation = useMutation({
    mutationFn: () => deleteExpense(groupId, expenseId!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenses', groupId] });
      qc.invalidateQueries({ queryKey: ['expense-summary', groupId] });
      toast.success('Expense deleted');
      setDeleteOpen(false);
      onOpenChange(false);
    },
    onError: () => toast.error('Failed to delete expense'),
  });

  // ── derived data ───────────────────────────────────────────────────────────

  const is404 = axios.isAxiosError(expenseError) && expenseError.response?.status === 404;
  const isLoading = loadingExpense && !initialExpense;

  const category = expense ? findCategory(categories, expense.categoryId) : undefined;
  const subcategory =
    expense?.subcategoryId
      ? findSubcategory(categories, expense.categoryId, expense.subcategoryId)
      : undefined;
  const event = expense?.eventId ? events.find((e) => e.id === expense.eventId) : undefined;
  const addedByMember = group?.members.find((m) => m.userId === expense?.addedBy);

  const imageBlobs = blobs.filter((b) => b.contentType.startsWith('image/'));

  const lightboxImages = imageBlobs;

  function prevImage() {
    setLightboxIdx((i) => (i === null || i === 0 ? lightboxImages.length - 1 : i - 1));
  }
  function nextImage() {
    setLightboxIdx((i) => (i === null ? 0 : (i + 1) % lightboxImages.length));
  }

  // ── render ─────────────────────────────────────────────────────────────────

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          showCloseButton
          className="sm:max-w-[680px] max-h-[90vh] flex flex-col overflow-hidden p-0"
        >
          {/* ── header ── */}
          <DialogHeader className="px-6 pt-6 pb-0 flex-shrink-0">
            {isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-6 w-56" />
                <Skeleton className="h-8 w-32" />
              </div>
            ) : is404 ? (
              <DialogTitle>Expense not found</DialogTitle>
            ) : expense ? (
              <div className="flex items-start justify-between gap-4 pr-8">
                <div>
                  <DialogTitle className="text-lg font-semibold leading-tight">
                    {expense.title}
                  </DialogTitle>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="text-2xl font-bold text-primary">
                      {formatAmount(expense.amount, expense.currency)}
                    </span>
                    <Badge variant="outline" className="text-xs">
                      {expense.currency}
                    </Badge>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground shrink-0">
                  <Calendar className="h-3.5 w-3.5" />
                  {format(new Date(expense.date), 'MMM d, yyyy')}
                </div>
              </div>
            ) : null}
          </DialogHeader>

          {/* ── scrollable body ── */}
          <div className="flex-1 overflow-y-auto px-6 py-4">
            {isLoading ? (
              <SkeletonBody />
            ) : is404 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
                <AlertTriangle className="h-10 w-10 text-muted-foreground/50" />
                <p className="text-muted-foreground">This expense no longer exists.</p>
              </div>
            ) : expense ? (
              <div className="space-y-6">
                {/* ── two-column body ── */}
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                  {/* left column */}
                  <div className="space-y-4">
                    {/* category */}
                    {category && (
                      <div className="flex items-center gap-2">
                        <Tag className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span
                          className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
                          style={
                            category.color
                              ? {
                                  backgroundColor: `${category.color}22`,
                                  color: category.color,
                                }
                              : undefined
                          }
                        >
                          {category.name}
                        </span>
                        {subcategory && (
                          <>
                            <span className="text-muted-foreground/50">›</span>
                            <span className="text-xs text-muted-foreground">
                              {subcategory.name}
                            </span>
                          </>
                        )}
                      </div>
                    )}

                    {/* event */}
                    {event && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="h-3.5 w-3.5 shrink-0" />
                        <span>{event.title}</span>
                      </div>
                    )}

                    {/* description */}
                    {expense.description && (
                      <p className="text-sm text-muted-foreground leading-relaxed rounded-md bg-muted/50 p-3">
                        {expense.description}
                      </p>
                    )}

                    {/* added by */}
                    <div className="flex items-center gap-2">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium uppercase">
                        {addedByMember
                          ? addedByMember.email.slice(0, 2)
                          : <User className="h-3.5 w-3.5" />}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-xs font-medium">
                          {addedByMember?.email ?? expense.addedBy}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          Added {formatDistanceToNow(new Date(expense.createdAt), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* right column — attachments */}
                  <div>
                    {blobs.length > 0 ? (
                      <div className="space-y-2">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                          Attachments
                        </p>
                        <div className="grid grid-cols-3 gap-2">
                          {blobs.map((blob, i) => {
                            const isImage = blob.contentType.startsWith('image/');
                            const imgIdx = imageBlobs.indexOf(blob);
                            return (
                              <button
                                key={blob.fileId}
                                onClick={() => isImage ? setLightboxIdx(imgIdx) : window.open(blob.objectUrl, '_blank')}
                                className="group relative aspect-square rounded-lg border bg-muted/40 overflow-hidden hover:border-primary/50 transition-colors"
                              >
                                {isImage ? (
                                  <img
                                    src={blob.objectUrl}
                                    alt={blob.filename}
                                    className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-200"
                                  />
                                ) : (
                                  <div className="flex h-full flex-col items-center justify-center gap-1 p-2">
                                    <FileText className="h-6 w-6 text-muted-foreground" />
                                    <span className="text-[9px] text-muted-foreground text-center leading-tight line-clamp-2">
                                      {blob.filename}
                                    </span>
                                  </div>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <div className="flex h-full items-center justify-center rounded-lg border border-dashed p-6 text-center">
                        <p className="text-xs text-muted-foreground">No attachments</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* ── audit trail ── */}
                <div className="border-t pt-4">
                  <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Activity
                  </p>

                  {loadingAudit ? (
                    <div className="space-y-3">
                      {[1, 2].map((i) => (
                        <div key={i} className="flex items-center gap-3">
                          <Skeleton className="h-6 w-16 rounded-full" />
                          <Skeleton className="h-3.5 w-44" />
                          <Skeleton className="h-3 w-20 ml-auto" />
                        </div>
                      ))}
                    </div>
                  ) : auditLogs.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No activity recorded.</p>
                  ) : (
                    <div className="space-y-2">
                      {auditLogs.map((log) => (
                        <div key={log.id} className="flex items-center gap-3 text-xs">
                          <AuditBadge action={log.action} />
                          <span className="text-muted-foreground truncate">
                            by{' '}
                            <span className="font-medium text-foreground">
                              {log.performedBy.email}
                            </span>
                          </span>
                          <span className="ml-auto shrink-0 text-muted-foreground/70">
                            {formatDistanceToNow(new Date(log.performedAt), { addSuffix: true })}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </div>

          {/* ── footer ── */}
          {!is404 && (
            <DialogFooter className="flex-shrink-0">
              {canEdit && expense && (
                <>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setDeleteOpen(true)}
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                    Delete
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      onOpenChange(false);
                      onEditClick?.(expense);
                    }}
                  >
                    <Pencil className="mr-1.5 h-3.5 w-3.5" />
                    Edit
                  </Button>
                </>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => onOpenChange(false)}
              >
                Close
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      {/* ── delete confirm ── */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete expense?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{expense?.title}". This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? 'Deleting…' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── lightbox ── */}
      {lightboxIdx !== null && (
        <Lightbox
          blobs={lightboxImages}
          index={lightboxIdx}
          onClose={() => setLightboxIdx(null)}
          onPrev={prevImage}
          onNext={nextImage}
        />
      )}
    </>
  );
}
