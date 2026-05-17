import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { UserPlus, Copy, Check, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';

import {
  getGroup,
  updateMemberPermission,
  removeMember,
  sendInvitation,
  type GroupMemberDto,
} from '@/api/groups';
import { useAuth } from '@/hooks/useAuth';
import type { Permission } from '@/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { CategoriesTab } from '@/components/categories/CategoriesTab';

// ─── Invite dialog ─────────────────────────────────────────────────────────────

const inviteSchema = z.object({
  email: z.string().email('Please enter a valid email'),
  permission: z.enum(['VIEW', 'EDIT']),
});

type InviteForm = z.infer<typeof inviteSchema>;

function InviteDialog({
  groupId,
  open,
  onOpenChange,
}: {
  groupId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [acceptUrl, setAcceptUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<InviteForm>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { permission: 'VIEW' },
  });

  function handleClose(v: boolean) {
    if (!v) { reset(); setAcceptUrl(null); setCopied(false); }
    onOpenChange(v);
  }

  const inviteMutation = useMutation({
    mutationFn: (data: InviteForm) => sendInvitation(groupId, data),
    onSuccess: (result) => {
      setAcceptUrl(result.acceptUrl ?? null);
      toast.success('Invitation sent');
    },
    onError: (err) => {
      const msg =
        axios.isAxiosError(err) && err.response
          ? (err.response.data?.message ?? 'Failed to send invitation')
          : 'Something went wrong';
      toast.error(msg);
    },
  });

  async function copyLink() {
    if (!acceptUrl) return;
    await navigator.clipboard.writeText(acceptUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite member</DialogTitle>
          <DialogDescription>
            They will receive a link to join this group.
          </DialogDescription>
        </DialogHeader>

        {acceptUrl ? (
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              Invitation sent! Share this link with the invitee:
            </p>
            <div className="flex items-center gap-2">
              <Input value={acceptUrl} readOnly className="text-xs" />
              <Button size="icon" variant="outline" onClick={copyLink}>
                {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
              </Button>
            </div>
            <DialogFooter>
              <Button onClick={() => handleClose(false)}>Done</Button>
            </DialogFooter>
          </div>
        ) : (
          <form
            id="invite-form"
            onSubmit={handleSubmit((data) => inviteMutation.mutate(data))}
            noValidate
            className="space-y-4 py-2"
          >
            <div className="space-y-1.5">
              <Label htmlFor="invite-email">Email</Label>
              <Input
                id="invite-email"
                type="email"
                placeholder="colleague@example.com"
                aria-invalid={!!errors.email}
                {...register('email')}
              />
              {errors.email && (
                <p className="text-xs text-destructive">{errors.email.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="invite-permission">Permission</Label>
              <select
                id="invite-permission"
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                {...register('permission')}
              >
                <option value="VIEW">View — can see expenses</option>
                <option value="EDIT">Edit — can add and edit expenses</option>
              </select>
              {errors.permission && (
                <p className="text-xs text-destructive">{errors.permission.message}</p>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" type="button" onClick={() => handleClose(false)}>
                Cancel
              </Button>
              <Button
                form="invite-form"
                type="submit"
                disabled={isSubmitting || inviteMutation.isPending}
              >
                {inviteMutation.isPending ? 'Sending…' : 'Send invitation'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Member row ────────────────────────────────────────────────────────────────

function MemberRow({
  member,
  isOwner: memberIsOwner,
  canManage,
  groupId,
}: {
  member: GroupMemberDto & { isOwner?: boolean };
  isOwner: boolean;
  canManage: boolean;
  groupId: string;
}) {
  const queryClient = useQueryClient();

  const permissionMutation = useMutation({
    mutationFn: (permission: Permission) =>
      updateMemberPermission(groupId, member.userId, permission),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['group', groupId] });
      toast.success('Permission updated');
    },
    onError: () => toast.error('Failed to update permission'),
  });

  const removeMutation = useMutation({
    mutationFn: () => removeMember(groupId, member.userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['group', groupId] });
      toast.success('Member removed');
    },
    onError: () => toast.error('Failed to remove member'),
  });

  return (
    <div className="flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-muted/50">
      <Avatar size="sm">
        <AvatarFallback>
          {member.email.slice(0, 2).toUpperCase()}
        </AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0">
        <p className="truncate text-sm font-medium text-foreground">{member.email}</p>
      </div>

      {memberIsOwner ? (
        <Badge variant="secondary">Owner</Badge>
      ) : canManage ? (
        <select
          value={member.permission}
          disabled={permissionMutation.isPending}
          onChange={(e) => permissionMutation.mutate(e.target.value as Permission)}
          className="h-7 rounded-md border border-input bg-transparent px-2 text-xs outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
        >
          <option value="VIEW">View</option>
          <option value="EDIT">Edit</option>
          <option value="ADMIN">Admin</option>
        </select>
      ) : (
        <Badge variant="outline">{member.permission}</Badge>
      )}

      {canManage && !memberIsOwner && (
        <Button
          size="icon-sm"
          variant="ghost"
          className="text-muted-foreground hover:text-destructive"
          disabled={removeMutation.isPending}
          onClick={() => removeMutation.mutate()}
        >
          <Trash2 className="size-3.5" />
        </Button>
      )}
    </div>
  );
}

// ─── Page skeleton ─────────────────────────────────────────────────────────────

function GroupPageSkeleton() {
  return (
    <div className="p-6 space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full rounded-lg" />
        ))}
      </div>
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export function GroupPage() {
  const { groupId } = useParams<{ groupId: string }>();
  const { user } = useAuth();
  const [inviteOpen, setInviteOpen] = useState(false);

  const { data: group, isLoading } = useQuery({
    queryKey: ['group', groupId],
    queryFn: () => getGroup(groupId!),
    enabled: !!groupId,
  });

  if (isLoading || !group) return <GroupPageSkeleton />;

  const isGroupOwner = group.ownerId === user?.id;

  // canEdit covers owner + EDIT-permission members for categories
  const canEdit = isGroupOwner ||
    !!group.members.find((m) =>
      m.userId === user?.id && (m.permission === 'EDIT' || m.permission === 'ADMIN'));

  // Build owner row
  const ownerRow: GroupMemberDto & { isOwner?: boolean } = {
    userId: group.ownerId,
    email: user?.id === group.ownerId ? (user?.email ?? group.ownerId) : group.ownerId,
    permission: 'EDIT' as Permission,
    joinedAt: group.createdAt,
    isOwner: true,
  };
  const ownerMember = group.members.find((m) => m.userId === group.ownerId);
  if (ownerMember) ownerRow.email = ownerMember.email;
  else if (user?.id === group.ownerId) ownerRow.email = user.email;

  const nonOwnerMembers = group.members.filter((m) => m.userId !== group.ownerId);

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground">{group.name}</h1>
          {group.description && (
            <p className="mt-1 text-sm text-muted-foreground">{group.description}</p>
          )}
        </div>
        {isGroupOwner && (
          <Button size="sm" onClick={() => setInviteOpen(true)}>
            <UserPlus className="size-3.5" />
            Invite member
          </Button>
        )}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="members">
        <TabsList variant="line">
          <TabsTrigger value="members">
            Members ({group.members.length + 1})
          </TabsTrigger>
          <TabsTrigger value="categories">Categories</TabsTrigger>
        </TabsList>

        {/* Members tab */}
        <TabsContent value="members" className="mt-4">
          <div className="divide-y divide-border rounded-xl border border-border">
            <MemberRow
              member={ownerRow}
              isOwner={true}
              canManage={false}
              groupId={groupId!}
            />
            {nonOwnerMembers.map((member) => (
              <MemberRow
                key={member.userId}
                member={member}
                isOwner={false}
                canManage={isGroupOwner}
                groupId={groupId!}
              />
            ))}
            {nonOwnerMembers.length === 0 && (
              <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                No other members yet — invite someone to get started.
              </div>
            )}
          </div>
        </TabsContent>

        {/* Categories tab */}
        <TabsContent value="categories" className="mt-4">
          <CategoriesTab groupId={groupId!} canEdit={canEdit} />
        </TabsContent>
      </Tabs>

      {/* Invite dialog */}
      {groupId && (
        <InviteDialog
          groupId={groupId}
          open={inviteOpen}
          onOpenChange={setInviteOpen}
        />
      )}
    </div>
  );
}
