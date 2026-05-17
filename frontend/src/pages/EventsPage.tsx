import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { Plus, Pencil, Trash2, CalendarIcon, Tag } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';

import {
  getEvents, createEvent, updateEvent, deleteEvent,
  type EventDto, type EventStatus,
} from '@/api/events';
import { getCategories } from '@/api/categories';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
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

// ─── Status badge ──────────────────────────────────────────────────────────────

const STATUS_META: Record<EventStatus, { label: string; variant: 'default' | 'success' | 'secondary' }> = {
  UPCOMING: { label: 'Upcoming', variant: 'default' },
  ACTIVE:   { label: 'Active',   variant: 'success' },
  CLOSED:   { label: 'Closed',   variant: 'secondary' },
};

// ─── Event form schema ─────────────────────────────────────────────────────────

const eventSchema = z
  .object({
    title:       z.string().min(1, 'Title is required').max(200),
    description: z.string().max(1000).optional(),
    startDate:   z.date({ required_error: 'Start date is required' }),
    endDate:     z.date({ required_error: 'End date is required' }),
    categories:  z.array(z.string()).optional(),
    status:      z.enum(['UPCOMING', 'ACTIVE', 'CLOSED']),
  })
  .refine((d) => d.endDate >= d.startDate, {
    message: 'End date must be on or after start date',
    path: ['endDate'],
  });

type EventForm = z.infer<typeof eventSchema>;

// ─── Event dialog ──────────────────────────────────────────────────────────────

function EventDialog({
  groupId,
  open,
  onOpenChange,
  editing,
}: {
  groupId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: EventDto | null;
}) {
  const queryClient = useQueryClient();
  const [startOpen, setStartOpen] = useState(false);
  const [endOpen, setEndOpen] = useState(false);

  const { data: categories = [] } = useQuery({
    queryKey: ['categories', groupId],
    queryFn: () => getCategories(groupId),
  });

  const {
    register,
    handleSubmit,
    control,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<EventForm>({
    resolver: zodResolver(eventSchema),
    defaultValues: { status: 'UPCOMING', categories: [] },
  });

  const watchedCategories = watch('categories') ?? [];

  useEffect(() => {
    if (open && editing) {
      reset({
        title:       editing.title,
        description: editing.description ?? '',
        startDate:   new Date(editing.startDate),
        endDate:     new Date(editing.endDate),
        categories:  editing.categories ?? [],
        status:      editing.status,
      });
    } else if (open) {
      reset({ status: 'UPCOMING', categories: [] });
    }
  }, [open, editing, reset]);

  function handleClose(v: boolean) {
    if (!v) reset({ status: 'UPCOMING', categories: [] });
    onOpenChange(v);
  }

  function toggleCategory(id: string, current: string[]) {
    return current.includes(id) ? current.filter((c) => c !== id) : [...current, id];
  }

  const mutation = useMutation({
    mutationFn: (data: EventForm) => {
      const payload = {
        title:       data.title,
        description: data.description || undefined,
        startDate:   format(data.startDate, 'yyyy-MM-dd'),
        endDate:     format(data.endDate, 'yyyy-MM-dd'),
        categories:  data.categories,
        status:      data.status,
      };
      return editing
        ? updateEvent(groupId, editing.id, payload)
        : createEvent(groupId, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events', groupId] });
      toast.success(editing ? 'Event updated' : 'Event created');
      handleClose(false);
    },
    onError: (err) => {
      const msg = axios.isAxiosError(err) && err.response
        ? (err.response.data?.message ?? 'Failed to save event')
        : 'Something went wrong';
      toast.error(msg);
    },
  });

  const isPending = isSubmitting || mutation.isPending;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit event' : 'New event'}</DialogTitle>
          <DialogDescription>
            {editing ? 'Update the event details below.' : 'Fill in the details for the new event.'}
          </DialogDescription>
        </DialogHeader>

        <form
          id="event-form"
          onSubmit={handleSubmit((d) => mutation.mutate(d))}
          noValidate
          className="space-y-4 py-2"
        >
          {/* Title */}
          <div className="space-y-1.5">
            <Label htmlFor="ev-title">Title</Label>
            <Input
              id="ev-title"
              placeholder="Team dinner, Sprint planning…"
              aria-invalid={!!errors.title}
              {...register('title')}
            />
            {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="ev-desc">
              Description <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            <textarea
              id="ev-desc"
              rows={2}
              placeholder="Any extra details…"
              className="w-full resize-none rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              {...register('description')}
            />
          </div>

          {/* Date range */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Start date</Label>
              <Controller
                control={control}
                name="startDate"
                render={({ field }) => (
                  <Popover open={startOpen} onOpenChange={setStartOpen}>
                    <PopoverTrigger
                      render={
                        <Button
                          type="button"
                          variant="outline"
                          className={cn('w-full justify-start text-left font-normal text-sm',
                            !field.value && 'text-muted-foreground')}
                        />
                      }
                    >
                      <CalendarIcon className="mr-1.5 size-3.5" />
                      {field.value ? format(field.value, 'MMM d, yyyy') : 'Pick'}
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={(d) => { field.onChange(d); setStartOpen(false); }}
                      />
                    </PopoverContent>
                  </Popover>
                )}
              />
              {errors.startDate && <p className="text-xs text-destructive">{errors.startDate.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label>End date</Label>
              <Controller
                control={control}
                name="endDate"
                render={({ field }) => (
                  <Popover open={endOpen} onOpenChange={setEndOpen}>
                    <PopoverTrigger
                      render={
                        <Button
                          type="button"
                          variant="outline"
                          className={cn('w-full justify-start text-left font-normal text-sm',
                            !field.value && 'text-muted-foreground')}
                        />
                      }
                    >
                      <CalendarIcon className="mr-1.5 size-3.5" />
                      {field.value ? format(field.value, 'MMM d, yyyy') : 'Pick'}
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={(d) => { field.onChange(d); setEndOpen(false); }}
                      />
                    </PopoverContent>
                  </Popover>
                )}
              />
              {errors.endDate && <p className="text-xs text-destructive">{errors.endDate.message}</p>}
            </div>
          </div>

          {/* Status */}
          <div className="space-y-1.5">
            <Label htmlFor="ev-status">Status</Label>
            <select
              id="ev-status"
              className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              {...register('status')}
            >
              <option value="UPCOMING">Upcoming</option>
              <option value="ACTIVE">Active</option>
              <option value="CLOSED">Closed</option>
            </select>
          </div>

          {/* Categories multi-select */}
          {categories.length > 0 && (
            <div className="space-y-1.5">
              <Label>
                Categories <span className="font-normal text-muted-foreground">(optional)</span>
              </Label>
              <Controller
                control={control}
                name="categories"
                render={({ field }) => (
                  <div className="flex flex-wrap gap-1.5 rounded-lg border border-input p-2">
                    {categories.map((cat) => {
                      const checked = (field.value ?? []).includes(cat.id);
                      return (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => field.onChange(toggleCategory(cat.id, field.value ?? []))}
                          className={cn(
                            'flex items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors border',
                            checked
                              ? 'border-ring bg-muted text-foreground'
                              : 'border-transparent bg-muted/40 text-muted-foreground hover:bg-muted',
                          )}
                        >
                          {cat.color && (
                            <span
                              className="size-2 rounded-full shrink-0"
                              style={{ background: cat.color }}
                            />
                          )}
                          {cat.name}
                        </button>
                      );
                    })}
                  </div>
                )}
              />
              {watchedCategories.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {watchedCategories.length} selected
                </p>
              )}
            </div>
          )}
        </form>

        <DialogFooter>
          <Button variant="outline" type="button" onClick={() => handleClose(false)}>
            Cancel
          </Button>
          <Button form="event-form" type="submit" disabled={isPending}>
            {isPending ? 'Saving…' : editing ? 'Save changes' : 'Create event'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Event card ────────────────────────────────────────────────────────────────

function EventCard({
  event,
  categoryNames,
  canManage,
  onEdit,
  onDelete,
}: {
  event: EventDto;
  categoryNames: string[];
  canManage: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const meta = STATUS_META[event.status];

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3 flex flex-col">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground leading-snug">{event.title}</h3>
        <Badge variant={meta.variant} className="shrink-0 text-xs">
          {meta.label}
        </Badge>
      </div>

      {event.description && (
        <p className="text-xs text-muted-foreground line-clamp-2">{event.description}</p>
      )}

      <div className="text-xs text-muted-foreground flex items-center gap-1">
        <CalendarIcon className="size-3 shrink-0" />
        {format(new Date(event.startDate), 'MMM d')} – {format(new Date(event.endDate), 'MMM d, yyyy')}
      </div>

      {categoryNames.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {categoryNames.map((name) => (
            <span
              key={name}
              className="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-xs text-muted-foreground"
            >
              <Tag className="size-2.5" />
              {name}
            </span>
          ))}
        </div>
      )}

      <div className="mt-auto flex items-center justify-between pt-2 border-t border-border">
        <span className="text-xs font-medium tabular-nums text-foreground">
          ${(event.expenseTotal ?? 0).toFixed(2)}
        </span>

        {canManage && (
          <div className="flex gap-1">
            <Button size="icon-sm" variant="ghost" onClick={onEdit} title="Edit">
              <Pencil className="size-3.5" />
            </Button>
            <Button
              size="icon-sm"
              variant="ghost"
              className="text-muted-foreground hover:text-destructive"
              onClick={onDelete}
              title="Delete"
            >
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export function EventsPage() {
  const { groupId } = useParams<{ groupId: string }>();
  const { isManager } = useAuth();
  const queryClient = useQueryClient();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<EventDto | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<EventDto | null>(null);

  const { data: events = [], isLoading } = useQuery({
    queryKey: ['events', groupId],
    queryFn: () => getEvents(groupId!),
    enabled: !!groupId,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['categories', groupId],
    queryFn: () => getCategories(groupId!),
    enabled: !!groupId,
  });

  function resolveCategoryNames(ids: string[]): string[] {
    return ids
      .map((id) => categories.find((c) => c.id === id)?.name)
      .filter(Boolean) as string[];
  }

  const deleteMutation = useMutation({
    mutationFn: (event: EventDto) => deleteEvent(groupId!, event.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events', groupId] });
      toast.success('Event deleted');
      setDeleteTarget(null);
    },
    onError: (err) => {
      const msg = axios.isAxiosError(err) && err.response
        ? (err.response.data?.message ?? 'Failed to delete')
        : 'Something went wrong';
      toast.error(msg);
    },
  });

  function openAdd() { setEditing(null); setDialogOpen(true); }
  function openEdit(ev: EventDto) { setEditing(ev); setDialogOpen(true); }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between gap-4">
        <h1 className="text-xl font-semibold text-foreground">Events</h1>
        {isManager && (
          <Button size="sm" onClick={openAdd}>
            <Plus className="size-3.5" />
            New event
          </Button>
        )}
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-border p-4 space-y-3">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          ))}
        </div>
      ) : events.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-20 text-center">
          <p className="text-sm font-medium text-foreground">No events yet</p>
          {isManager && (
            <>
              <p className="mt-1 text-sm text-muted-foreground">
                Create an event to group expenses together.
              </p>
              <Button size="sm" className="mt-4" onClick={openAdd}>
                <Plus className="size-3.5" />
                New event
              </Button>
            </>
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {events.map((ev) => (
            <EventCard
              key={ev.id}
              event={ev}
              categoryNames={resolveCategoryNames(ev.categories ?? [])}
              canManage={isManager}
              onEdit={() => openEdit(ev)}
              onDelete={() => setDeleteTarget(ev)}
            />
          ))}
        </div>
      )}

      {/* Add / edit dialog */}
      <EventDialog
        groupId={groupId!}
        open={dialogOpen}
        onOpenChange={(v) => { setDialogOpen(v); if (!v) setEditing(null); }}
        editing={editing}
      />

      {/* Delete confirm */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(v) => { if (!v) setDeleteTarget(null); }}
      >
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete event?</AlertDialogTitle>
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
