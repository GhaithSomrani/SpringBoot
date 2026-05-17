import { useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import axios from 'axios';

import { acceptInvitation } from '@/api/invitations';
import { usePageTitle } from '@/hooks/usePageTitle';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export function InvitationAcceptPage() {
  usePageTitle('Accept Invitation');
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') ?? '';
  const redirect = `/invite/accept?token=${encodeURIComponent(token)}`;

  const acceptMutation = useMutation({
    mutationFn: () => acceptInvitation(token),
  });

  useEffect(() => {
    if (!token || acceptMutation.isPending || acceptMutation.isSuccess) {
      return;
    }

    void acceptMutation.mutateAsync().then((result) => {
      if (!result.requiresAuth) {
        navigate(`/groups/${result.groupId}`, { replace: true });
      }
    }).catch(() => {});
  }, [acceptMutation, navigate, token]);

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Invitation not found</CardTitle>
            <CardDescription>Missing invitation token.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (acceptMutation.isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Checking invitation</CardTitle>
            <CardDescription>Please wait while we verify your invite.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (acceptMutation.isError) {
    const message =
      axios.isAxiosError(acceptMutation.error) && acceptMutation.error.response?.data?.message
        ? acceptMutation.error.response.data.message
        : 'This invitation is invalid or has expired.';

    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Invitation unavailable</CardTitle>
            <CardDescription>{message}</CardDescription>
          </CardHeader>
          <CardFooter>
            <Link to="/" className="w-full sm:w-auto">
              <Button variant="outline" className="w-full">Go Home</Button>
            </Link>
          </CardFooter>
        </Card>
      </div>
    );
  }

  const invite = acceptMutation.data;
  if (!invite?.requiresAuth) {
    return null;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>You&apos;ve been invited</CardTitle>
          <CardDescription>
            You&apos;ve been invited to join {invite.groupName} with {invite.permission} access. Login or register to accept.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Continue as {invite.invitedEmail} so the invitation can be matched to your account.
          </p>
        </CardContent>
        <CardFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Link to={`/login?redirect=${encodeURIComponent(redirect)}`} className="w-full sm:w-auto">
            <Button variant="outline" className="w-full">Login</Button>
          </Link>
          <Link to={`/register?redirect=${encodeURIComponent(redirect)}`} className="w-full sm:w-auto">
            <Button className="w-full">Register</Button>
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}
