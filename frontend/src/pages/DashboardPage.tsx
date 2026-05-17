import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';

import { getMyGroups, createGroup } from '@/api/groups';
import { GroupCard } from '@/components/GroupCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';

const createGroupSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  description: z.string().max(500).optional(),
});

type CreateGroupForm = z.infer<typeof createGroupSchema>;

function GroupGridSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="rounded-xl p-4 ring-1 ring-foreground/10 space-y-3">
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-4/5" />
          <div className="flex justify-between pt-2">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-3 w-14" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function DashboardPage() {
  const [createOpen, setCreateOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: groups, isLoading } = useQuery({
    queryKey: ['groups'],
    queryFn: getMyGroups,
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateGroupForm>({
    resolver: zodResolver(createGroupSchema),
  });

  const createMutation = useMutation({
    mutationFn: createGroup,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      setCreateOpen(false);
      reset();
      toast.success('Group created');
    },
    onError: (err) => {
      const msg =
        axios.isAxiosError(err) && err.response
          ? (err.response.data?.message ?? 'Failed to create group')
          : 'Something went wrong';
      toast.error(msg);
    },
  });

  const onSubmit = (data: CreateGroupForm) => createMutation.mutate(data);

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">My Groups</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Manage your shared expense groups
          </p>
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="size-3.5" />
          Create Group
        </Button>
      </div>

      {/* Group grid */}
      {isLoading ? (
        <GroupGridSkeleton />
      ) : groups && groups.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {groups.map((group) => (
            <GroupCard key={group.id} group={group} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-20 text-center">
          <p className="text-sm font-medium text-foreground">No groups yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Create your first group to start tracking expenses together.
          </p>
          <Button size="sm" className="mt-4" onClick={() => setCreateOpen(true)}>
            <Plus className="size-3.5" />
            Create Group
          </Button>
        </div>
      )}

      {/* Create Group dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Group</DialogTitle>
            <DialogDescription>
              Give your group a name and an optional description.
            </DialogDescription>
          </DialogHeader>

          <form id="create-group-form" onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="group-name">Name</Label>
              <Input
                id="group-name"
                placeholder="Weekend trip, Apartment, …"
                aria-invalid={!!errors.name}
                {...register('name')}
              />
              {errors.name && (
                <p className="text-xs text-destructive">{errors.name.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="group-desc">
                Description{' '}
                <span className="text-muted-foreground font-normal">(optional)</span>
              </Label>
              <Input
                id="group-desc"
                placeholder="What's this group for?"
                aria-invalid={!!errors.description}
                {...register('description')}
              />
              {errors.description && (
                <p className="text-xs text-destructive">{errors.description.message}</p>
              )}
            </div>
          </form>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => { setCreateOpen(false); reset(); }}
            >
              Cancel
            </Button>
            <Button
              form="create-group-form"
              type="submit"
              disabled={isSubmitting || createMutation.isPending}
            >
              {createMutation.isPending ? 'Creating…' : 'Create Group'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
