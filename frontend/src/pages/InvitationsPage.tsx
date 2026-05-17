import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format, formatDistanceToNow, isPast } from 'date-fns';
import { Inbox, MailCheck, MailX } from 'lucide-react';
import { toast } from 'sonner';

import { acceptInvitation, declineInvitation, getMyInvitations } from '@/api/invitations';
import { usePageTitle } from '@/hooks/usePageTitle';
import type { Invitation } from '@/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

type InvitationTab = 'PENDING' | 'ACCEPTED' | 'DECLINED';

function extractToken(url?: string) {
  if (!url) return '';
  try {
    return new URL(url).searchParams.get('token') ?? '';
  } catch {
    return '';
  }
}

function permissionClass(permission: Invitation['permission']) {
  if (permission === 'EDIT') {
    return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';
  }
  if (permission === 'ADMIN') {
    return 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400';
  }
  return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
}

function expiryClass(expiresAt: string) {
  const remaining = new Date(expiresAt).getTime() - Date.now();
  if (remaining <= 60 * 60 * 1000) return 'text-destructive';
  if (remaining <= 6 * 60 * 60 * 1000) return 'text-amber-600 dark:text-amber-400';
  return 'text-muted-foreground';
}

export function InvitationsPage() {
  usePageTitle('My Invitations');
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<InvitationTab>('PENDING');
  const [declineTarget, setDeclineTarget] = useState<Invitation | null>(null);

  const invitationsQuery = useQuery({
    queryKey: ['my-invitations'],
    queryFn: getMyInvitations,
    staleTime: 30_000,
  });

  const acceptMutation = useMutation({
    mutationFn: acceptInvitation,
    onSuccess: (result) => {
      toast.success(`You joined ${result.groupName}!`, {
        action: {
          label: 'Go to group ->',
          onClick: () => navigate(`/groups/${result.groupId}`),
        },
      });
      void queryClient.invalidateQueries({ queryKey: ['my-invitations'] });
      void queryClient.invalidateQueries({ queryKey: ['my-groups'] });
    },
  });

  const declineMutation = useMutation({
    mutationFn: declineInvitation,
    onSuccess: (result) => {
      toast.success(`You declined ${result.groupName}`);
      setDeclineTarget(null);
      void queryClient.invalidateQueries({ queryKey: ['my-invitations'] });
    },
  });

  const filtered = useMemo(() => {
    const invitations = invitationsQuery.data ?? [];
    if (tab === 'PENDING') return invitations.filter((item) => item.status === 'PENDING');
    if (tab === 'ACCEPTED') return invitations.filter((item) => item.status === 'ACCEPTED');
    return invitations.filter((item) => item.status === 'DECLINED');
  }, [invitationsQuery.data, tab]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">My Invitations</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Groups you&apos;ve been invited to join
        </p>
      </div>

      <Tabs value={tab} onValueChange={(value) => setTab(value as InvitationTab)}>
        <TabsList variant="line">
          <TabsTrigger value="PENDING">Pending</TabsTrigger>
          <TabsTrigger value="ACCEPTED">Accepted</TabsTrigger>
          <TabsTrigger value="DECLINED">Declined</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="space-y-4">
        {invitationsQuery.isLoading && (
          <div className="rounded-xl border border-border bg-card px-5 py-6 text-sm text-muted-foreground">
            Loading invitations...
          </div>
        )}

        {invitationsQuery.isError && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-5 py-6 text-sm text-destructive">
            Failed to load invitations.
          </div>
        )}

        {!invitationsQuery.isLoading && !invitationsQuery.isError && filtered.length === 0 && (
          <EmptyState tab={tab} />
        )}

        {filtered.map((invitation) => {
          const acceptToken = extractToken(invitation.acceptUrl);
          const declineToken = extractToken(invitation.declineUrl);
          const expired = tab === 'PENDING' && isPast(new Date(invitation.expiresAt));

          return (
            <Card key={invitation.id} className="py-0">
              <CardContent className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="text-lg font-semibold text-foreground">{invitation.groupName}</h2>
                    <Badge className={cn('border-transparent', permissionClass(invitation.permission))}>
                      {invitation.permission}
                    </Badge>
                    {tab !== 'PENDING' && (
                      <Badge variant={tab === 'ACCEPTED' ? 'success' : 'outline'}>
                        {invitation.status}
                      </Badge>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Invited by {invitation.invitedByName}
                  </p>
                </div>

                <div className="min-w-[180px]">
                  {tab === 'PENDING' ? (
                    <p className={cn('text-sm font-medium', expired ? 'text-destructive' : expiryClass(invitation.expiresAt))}>
                      {expired
                        ? 'Expired'
                        : `Expires ${formatDistanceToNow(new Date(invitation.expiresAt), { addSuffix: true })}`}
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Responded {invitation.respondedAt
                        ? format(new Date(invitation.respondedAt), 'PPP')
                        : format(new Date(invitation.createdAt), 'PPP')}
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                  {tab === 'PENDING' ? (
                    <>
                      <Button
                        className="bg-emerald-600 text-white hover:bg-emerald-700"
                        disabled={acceptMutation.isPending || !acceptToken}
                        onClick={() => void acceptMutation.mutateAsync(acceptToken)}
                      >
                        Accept
                      </Button>
                      <Button
                        variant="outline"
                        className="border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
                        disabled={!declineToken}
                        onClick={() => setDeclineTarget(invitation)}
                      >
                        Decline
                      </Button>
                    </>
                  ) : tab === 'ACCEPTED' ? (
                    <Link to={`/groups/${invitation.groupId}`}>
                      <Button variant="link">Go to group -&gt;</Button>
                    </Link>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={!!declineTarget} onOpenChange={(open) => !open && setDeclineTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Decline invitation?</DialogTitle>
            <DialogDescription>
              {declineTarget
                ? `Decline invitation to ${declineTarget.groupName}? You can always be re-invited later.`
                : ''}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeclineTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={declineMutation.isPending || !extractToken(declineTarget?.declineUrl)}
              onClick={() => void declineMutation.mutateAsync(extractToken(declineTarget?.declineUrl))}
            >
              Decline
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EmptyState({ tab }: { tab: InvitationTab }) {
  const config = {
    PENDING: {
      Icon: Inbox,
      title: 'No pending invitations',
      body: 'Share your email with a group owner to get invited.',
    },
    ACCEPTED: {
      Icon: MailCheck,
      title: 'No accepted invitations yet',
      body: 'Accepted invitations will appear here after you join a group.',
    },
    DECLINED: {
      Icon: MailX,
      title: 'No declined invitations',
      body: 'Invitations you turn down will stay here for reference.',
    },
  }[tab];

  return (
    <div className="rounded-xl border border-dashed border-border bg-card/40 px-6 py-12 text-center">
      <config.Icon className="mx-auto size-10 text-muted-foreground" />
      <h2 className="mt-4 text-lg font-semibold text-foreground">{config.title}</h2>
      <p className="mt-2 text-sm text-muted-foreground">{config.body}</p>
    </div>
  );
}
