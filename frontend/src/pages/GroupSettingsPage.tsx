import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import {
  Crown, Copy, Check, Trash2, Users, Tag, Receipt, CalendarDays,
  Pencil, Mail, UserMinus, X,
} from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';

import {
  getGroup,
  updateGroup,
  deleteGroup,
  updateMemberPermission,
  removeMember,
  sendInvitation,
  getGroupInvitations,
  cancelInvitation,
  type GroupMemberDto,
  type InvitationResult,
} from '@/api/groups';
import { getExpenses } from '@/api/expenses';
import { getCategories } from '@/api/categories';
import { useAuth } from '@/hooks/useAuth';
import { usePageTitle } from '@/hooks/usePageTitle';
import type { Permission } from '@/types';

import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { CategoriesTab } from '@/components/categories/CategoriesTab';
import { cn } from '@/lib/utils';

// ─── Constants ────────────────────────────────────────────────────────────────

const INVITE_STATUS: Record<string, { label: string; cls: string }> = {
  PENDING:  { label: 'Pending',  cls: 'bg-amber-100 text-amber-700 border-transparent' },
  ACCEPTED: { label: 'Accepted', cls: 'bg-emerald-100 text-emerald-700 border-transparent' },
  DECLINED: { label: 'Declined', cls: 'bg-rose-100 text-rose-700 border-transparent' },
  EXPIRED:  { label: 'Expired',  cls: 'bg-muted text-muted-foreground border-transparent' },
  CANCELLED:{ label: 'Cancelled', cls: 'bg-muted text-muted-foreground border-transparent' },
};

const PERM_BADGE_CLS: Record<Permission, string> = {
  ADMIN: 'bg-violet-50 text-violet-700 border-violet-200',
  EDIT: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  VIEW: 'bg-blue-50 text-blue-700 border-blue-200',
};

// ─── Overview Tab ─────────────────────────────────────────────────────────────

function OverviewTab({ groupId, isOwner }: { groupId: string; isOwner: boolean }) {
  const qc = useQueryClient();
  const navigate = useNavigate();

  const [nameEdit, setNameEdit]               = useState<string | null>(null);
  const [descEdit, setDescEdit]               = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen]           = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  const { data: group } = useQuery({
    queryKey: ['group', groupId],
    queryFn: () => getGroup(groupId),
    staleTime: 30_000,
  });

  const { data: expensePage } = useQuery({
    queryKey: ['expenses-count', groupId],
    queryFn: () => getExpenses(groupId, {}, 0, 1, 'date', 'desc'),
    staleTime: 60_000,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['categories', groupId],
    queryFn: () => getCategories(groupId),
    staleTime: 60_000,
  });

  const updateMutation = useMutation({
    mutationFn: (data: { name: string; description?: string }) =>
      updateGroup(groupId, data),
    onSuccess: (updated) => {
      qc.setQueryData(['group', groupId], updated);
      qc.invalidateQueries({ queryKey: ['my-groups'] });
      toast.success('Group updated');
    },
    onError: () => toast.error('Failed to update group'),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteGroup(groupId),
    onSuccess: () => {
      qc.removeQueries({ queryKey: ['group', groupId] });
      qc.invalidateQueries({ queryKey: ['my-groups'] });
      toast.success('Group deleted');
      navigate('/dashboard');
    },
    onError: () => toast.error('Failed to delete group'),
  });

  function commitName() {
    if (nameEdit === null) return;
    const trimmed = nameEdit.trim();
    if (trimmed && trimmed !== group?.name) {
      updateMutation.mutate({ name: trimmed, description: group?.description });
    }
    setNameEdit(null);
  }

  function commitDesc() {
    if (descEdit === null) return;
    const trimmed = descEdit.trim();
    if (trimmed !== (group?.description ?? '')) {
      updateMutation.mutate({ name: group?.name ?? '', description: trimmed || undefined });
    }
    setDescEdit(null);
  }

  if (!group) return null;

  const totalMembers  = group.members.length + 1;
  const totalExpenses = expensePage?.totalElements ?? '—';
  const totalCats     = categories.length;

  return (
    <div className="space-y-6">
      {/* Details card */}
      <div className="rounded-xl border p-4 space-y-4">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Group details
        </p>

        {/* Name */}
        <div className="space-y-1.5">
          <Label className="text-xs">Name</Label>
          {nameEdit !== null ? (
            <Input
              autoFocus
              value={nameEdit}
              onChange={(e) => setNameEdit(e.target.value)}
              onBlur={commitName}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); commitName(); }
                if (e.key === 'Escape') setNameEdit(null);
              }}
              disabled={updateMutation.isPending}
            />
          ) : (
            <button
              type="button"
              onClick={() => setNameEdit(group.name)}
              className="group flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm font-medium text-foreground hover:bg-muted transition-colors"
            >
              <span className="flex-1 truncate">{group.name}</span>
              <Pencil className="size-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
            </button>
          )}
        </div>

        {/* Description */}
        <div className="space-y-1.5">
          <Label className="text-xs">Description</Label>
          {descEdit !== null ? (
            <textarea
              autoFocus
              value={descEdit}
              onChange={(e) => setDescEdit(e.target.value)}
              onBlur={commitDesc}
              onKeyDown={(e) => {
                if (e.key === 'Escape') setDescEdit(null);
              }}
              rows={3}
              disabled={updateMutation.isPending}
              placeholder="Add a description…"
              className="w-full resize-none rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm text-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 placeholder:text-muted-foreground disabled:opacity-50"
            />
          ) : (
            <button
              type="button"
              onClick={() => setDescEdit(group.description ?? '')}
              className="group flex w-full items-start gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm hover:bg-muted transition-colors min-h-[3rem]"
            >
              {group.description ? (
                <span className="flex-1 text-foreground leading-relaxed">{group.description}</span>
              ) : (
                <span className="flex-1 italic text-muted-foreground">No description — click to add</span>
              )}
              <Pencil className="size-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-0.5" />
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { Icon: CalendarDays, label: 'Created',    value: format(new Date(group.createdAt), 'MMM d, yyyy') },
          { Icon: Users,        label: 'Members',    value: totalMembers },
          { Icon: Receipt,      label: 'Expenses',   value: totalExpenses },
          { Icon: Tag,          label: 'Categories', value: totalCats },
        ].map(({ Icon, label, value }) => (
          <div key={label} className="rounded-xl border p-3 space-y-1.5">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Icon className="size-3.5" />
              <span className="text-xs">{label}</span>
            </div>
            <p className="text-xl font-semibold tabular-nums text-foreground">{value}</p>
          </div>
        ))}
      </div>

      {/* Danger zone — owner only */}
      {isOwner && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/[0.02] p-4 space-y-3">
          <div>
            <p className="text-sm font-semibold text-destructive">Danger zone</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              These actions are irreversible. Please proceed with caution.
            </p>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-destructive/20 bg-background px-4 py-3 gap-4">
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">Delete this group</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Permanently removes the group, all expenses, categories, and memberships.
              </p>
            </div>
            <Button
              variant="destructive"
              size="sm"
              className="shrink-0"
              onClick={() => { setDeleteOpen(true); setDeleteConfirmText(''); }}
            >
              <Trash2 className="size-3.5 mr-1.5" />
              Delete group
            </Button>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">Delete group?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <strong className="text-foreground">{group.name}</strong> and
              all its data. This action cannot be undone.
              <br /><br />
              Type <strong className="text-foreground">{group.name}</strong> to confirm:
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            value={deleteConfirmText}
            onChange={(e) => setDeleteConfirmText(e.target.value)}
            placeholder={group.name}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && deleteConfirmText === group.name) deleteMutation.mutate();
            }}
          />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={deleteConfirmText !== group.name || deleteMutation.isPending}
              onClick={() => deleteMutation.mutate()}
            >
              {deleteMutation.isPending ? 'Deleting…' : 'Delete group'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── Members Tab ──────────────────────────────────────────────────────────────

function MembersTab({
  groupId,
  currentUserId,
  isOwner,
}: {
  groupId: string;
  currentUserId: string;
  isOwner: boolean;
}) {
  const qc = useQueryClient();
  const [removeTarget, setRemoveTarget] = useState<GroupMemberDto | null>(null);

  const { data: group } = useQuery({
    queryKey: ['group', groupId],
    queryFn: () => getGroup(groupId),
    staleTime: 30_000,
  });

  const permMutation = useMutation({
    mutationFn: ({ userId, permission }: { userId: string; permission: Permission }) =>
      updateMemberPermission(groupId, userId, permission),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['group', groupId] });
      toast.success('Permission updated');
    },
    onError: () => toast.error('Failed to update permission'),
  });

  const removeMutation = useMutation({
    mutationFn: (userId: string) => removeMember(groupId, userId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['group', groupId] });
      toast.success('Member removed');
      setRemoveTarget(null);
    },
    onError: () => toast.error('Failed to remove member'),
  });

  if (!group) return null;

  // Build unified member list: owner at top, then others
  const ownerMember: GroupMemberDto = group.members.find((m) => m.userId === group.ownerId) ?? {
    userId: group.ownerId,
    email: group.ownerId,
    permission: 'EDIT' as Permission,
    joinedAt: group.createdAt,
  };
  const nonOwnerMembers = group.members.filter((m) => m.userId !== group.ownerId);
  const allMembers = [ownerMember, ...nonOwnerMembers];

  return (
    <>
      <div className="rounded-xl border divide-y divide-border">
        {allMembers.map((member) => {
          const isMemberOwner = member.userId === group.ownerId;
          const isSelf        = member.userId === currentUserId;
          const canManage     = isOwner && !isMemberOwner && !isSelf;

          return (
            <div
              key={member.userId}
              className={cn(
                'flex items-center gap-3 px-4 py-3',
                isSelf && 'bg-primary/[0.03] border-l-2 border-primary',
              )}
            >
              {/* Avatar */}
              <Avatar size="sm">
                <AvatarFallback>{member.email.slice(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>

              {/* Email + labels */}
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  <p className="text-sm font-medium text-foreground truncate max-w-[200px]">
                    {member.email}
                  </p>
                  {isMemberOwner && (
                    <Crown className="size-3.5 text-amber-500 shrink-0" />
                  )}
                  {isSelf && (
                    <span className="rounded px-1 py-0.5 text-[10px] font-medium bg-primary/10 text-primary">
                      you
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Joined {format(new Date(member.joinedAt), 'MMM d, yyyy')}
                </p>
              </div>

              {/* Permission */}
              {isMemberOwner ? (
                <Badge variant="secondary" className="text-xs shrink-0">Owner</Badge>
              ) : canManage ? (
                <select
                  value={member.permission}
                  onChange={(e) =>
                    permMutation.mutate({ userId: member.userId, permission: e.target.value as Permission })
                  }
                  disabled={permMutation.isPending}
                  className="h-7 rounded-md border border-input bg-transparent px-2 text-xs outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
                >
                  <option value="VIEW">View</option>
                  <option value="EDIT">Edit</option>
                  <option value="ADMIN">Admin</option>
                </select>
              ) : (
                <Badge
                  variant="outline"
                  className={cn('text-xs shrink-0', PERM_BADGE_CLS[member.permission])}
                >
                  {member.permission === 'ADMIN'
                    ? 'Admin'
                    : member.permission === 'EDIT'
                      ? 'Edit'
                      : 'View'}
                </Badge>
              )}

              {/* Remove */}
              {canManage && (
                <Button
                  size="icon-sm"
                  variant="ghost"
                  className="shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={() => setRemoveTarget(member)}
                >
                  <UserMinus className="size-3.5" />
                </Button>
              )}
            </div>
          );
        })}

        {nonOwnerMembers.length === 0 && (
          <div className="px-4 py-10 text-center text-sm text-muted-foreground">
            No other members yet — invite someone to get started.
          </div>
        )}
      </div>

      {/* Remove confirm dialog */}
      <AlertDialog open={!!removeTarget} onOpenChange={(o) => !o && setRemoveTarget(null)}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Remove member?</AlertDialogTitle>
            <AlertDialogDescription>
              Remove <strong className="text-foreground">{removeTarget?.email}</strong> from this
              group? They will lose access to all group expenses immediately.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removeMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={removeMutation.isPending}
              onClick={() => removeTarget && removeMutation.mutate(removeTarget.userId)}
            >
              {removeMutation.isPending ? 'Removing…' : 'Remove'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ─── Invitations Tab ──────────────────────────────────────────────────────────

const inviteSchema = z.object({
  email: z.string().email('Enter a valid email address'),
  permission: z.enum(['VIEW', 'EDIT']),
});
type InviteForm = z.infer<typeof inviteSchema>;

function InvitationsTab({ groupId }: { groupId: string }) {
  const qc = useQueryClient();
  const [acceptUrl, setAcceptUrl]     = useState<string | null>(null);
  const [copied, setCopied]           = useState(false);
  const [cancelTarget, setCancelTarget] = useState<InvitationResult | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<InviteForm>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { permission: 'VIEW' },
  });

  const { data: invitations = [], isLoading } = useQuery({
    queryKey: ['invitations', groupId],
    queryFn: () => getGroupInvitations(groupId),
    staleTime: 30_000,
  });

  const inviteMutation = useMutation({
    mutationFn: (data: InviteForm) => sendInvitation(groupId, data),
    onSuccess: (result) => {
      setAcceptUrl(result.acceptUrl ?? null);
      qc.invalidateQueries({ queryKey: ['invitations', groupId] });
      toast.success('Invitation sent');
      reset();
    },
    onError: (err) => {
      const msg =
        axios.isAxiosError(err) && err.response
          ? (err.response.data?.message ?? 'Failed to send invitation')
          : 'Something went wrong';
      toast.error(msg);
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (invId: string) => cancelInvitation(groupId, invId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invitations', groupId] });
      toast.success('Invitation cancelled');
      setCancelTarget(null);
    },
    onError: () => toast.error('Failed to cancel invitation'),
  });

  async function copyLink() {
    if (!acceptUrl) return;
    try {
      await navigator.clipboard.writeText(acceptUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Could not copy to clipboard');
    }
  }

  const pendingCount = invitations.filter((i) => i.status === 'PENDING').length;

  return (
    <div className="space-y-6">
      {/* Invite form */}
      <div className="rounded-xl border p-4 space-y-4">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Send an invitation
        </p>

        <form
          onSubmit={handleSubmit((data) => inviteMutation.mutate(data))}
          noValidate
          className="flex flex-wrap items-end gap-2"
        >
          <div className="flex-1 min-w-[200px] space-y-1">
            <Label htmlFor="inv-email" className="text-xs">Email</Label>
            <Input
              id="inv-email"
              type="email"
              placeholder="colleague@example.com"
              aria-invalid={!!errors.email}
              {...register('email')}
            />
            {errors.email && (
              <p className="text-xs text-destructive">{errors.email.message}</p>
            )}
          </div>

          <div className="w-36 space-y-1">
            <Label htmlFor="inv-perm" className="text-xs">Permission</Label>
            <select
              id="inv-perm"
              className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              {...register('permission')}
            >
              <option value="VIEW">View</option>
              <option value="EDIT">Edit</option>
            </select>
          </div>

          <Button type="submit" size="sm" disabled={inviteMutation.isPending} className="shrink-0">
            {inviteMutation.isPending ? 'Sending…' : 'Send invite'}
          </Button>
        </form>

        {acceptUrl && (
          <div className="space-y-1.5 rounded-lg bg-emerald-50/60 border border-emerald-200 p-3">
            <p className="text-xs font-medium text-emerald-700">
              Invitation sent! Share this link:
            </p>
            <div className="flex items-center gap-2">
              <Input
                value={acceptUrl}
                readOnly
                className="text-xs font-mono bg-background"
              />
              <Button size="icon" variant="outline" onClick={copyLink} className="shrink-0">
                {copied ? <Check className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5" />}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Invitations list */}
      <div>
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Invitations
          {pendingCount > 0 && (
            <span className="ml-1.5 rounded-full bg-amber-100 text-amber-700 px-1.5 py-0.5 text-[10px] font-medium">
              {pendingCount} pending
            </span>
          )}
        </p>

        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}
          </div>
        ) : invitations.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-14 gap-2 text-center">
            <Mail className="size-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">No invitations sent yet</p>
            <p className="text-xs text-muted-foreground/70">Send an invite above to add members</p>
          </div>
        ) : (
          <div className="rounded-xl border divide-y divide-border">
            {invitations.map((inv) => {
              const statusCfg = INVITE_STATUS[inv.status] ?? INVITE_STATUS.EXPIRED;
              return (
                <div key={inv.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate text-foreground">
                      {inv.invitedEmail}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Sent {format(new Date(inv.createdAt), 'MMM d, yyyy')}
                      {' · '}
                      Expires {format(new Date(inv.expiresAt), 'MMM d, yyyy')}
                    </p>
                  </div>

                  <Badge
                    variant="outline"
                    className={cn('text-xs shrink-0', PERM_BADGE_CLS[inv.permission])}
                  >
                    {inv.permission === 'EDIT' ? 'Edit' : 'View'}
                  </Badge>

                  <Badge className={cn('text-xs shrink-0 border', statusCfg.cls)}>
                    {statusCfg.label}
                  </Badge>

                  {inv.status === 'PENDING' && (
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      className="shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={() => setCancelTarget(inv)}
                    >
                      <X className="size-3.5" />
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Cancel confirm */}
      <AlertDialog open={!!cancelTarget} onOpenChange={(o) => !o && setCancelTarget(null)}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel invitation?</AlertDialogTitle>
            <AlertDialogDescription>
              The invitation sent to{' '}
              <strong className="text-foreground">{cancelTarget?.invitedEmail}</strong> will
              be cancelled and the link will no longer work.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelMutation.isPending}>Keep it</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={cancelMutation.isPending}
              onClick={() => cancelTarget && cancelMutation.mutate(cancelTarget.id)}
            >
              {cancelMutation.isPending ? 'Cancelling…' : 'Cancel invite'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── Page skeleton ────────────────────────────────────────────────────────────

function GroupSettingsSkeleton() {
  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <div className="space-y-1">
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-4 w-48" />
      </div>
      <div className="flex gap-2">
        {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-7 w-24 rounded-md" />)}
      </div>
      <div className="space-y-3">
        <Skeleton className="h-32 w-full rounded-xl" />
        <div className="grid grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function GroupSettingsPage() {
  const { groupId } = useParams<{ groupId: string }>();
  const { user }    = useAuth();

  const { data: group, isLoading } = useQuery({
    queryKey: ['group', groupId],
    queryFn: () => getGroup(groupId!),
    enabled: !!groupId,
  });

  usePageTitle(group ? `${group.name} — Settings` : 'Settings');

  if (isLoading || !group || !groupId) return <GroupSettingsSkeleton />;

  const isOwner = group.ownerId === user?.id;
  const canEdit =
    isOwner || !!group.members.find((m) =>
      m.userId === user?.id && (m.permission === 'EDIT' || m.permission === 'ADMIN'));

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground mt-0.5">{group.name}</p>
      </div>

      <Tabs defaultValue="overview">
        <TabsList variant="line">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="members">
            Members ({group.members.length + 1})
          </TabsTrigger>
          <TabsTrigger value="categories">Categories</TabsTrigger>
          <TabsTrigger value="invitations">Invitations</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-5">
          <OverviewTab groupId={groupId} isOwner={isOwner} />
        </TabsContent>

        <TabsContent value="members" className="mt-5">
          <MembersTab
            groupId={groupId}
            currentUserId={user?.id ?? ''}
            isOwner={isOwner}
          />
        </TabsContent>

        <TabsContent value="categories" className="mt-5">
          <CategoriesTab groupId={groupId} canEdit={canEdit} />
        </TabsContent>

        <TabsContent value="invitations" className="mt-5">
          <InvitationsTab groupId={groupId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
