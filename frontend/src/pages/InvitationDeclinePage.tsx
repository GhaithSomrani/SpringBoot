import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import axios from 'axios';

import { declineInvitation } from '@/api/invitations';
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

export function InvitationDeclinePage() {
  usePageTitle('Decline Invitation');
  const [searchParams] = useSearchParams();
  const [groupName, setGroupName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = searchParams.get('token');
    if (!token) {
      setError('Missing invitation token.');
      return;
    }

    void declineInvitation(token)
      .then((result) => setGroupName(result.groupName))
      .catch((err) => {
        const message =
          axios.isAxiosError(err) && err.response?.data?.message
            ? err.response.data.message
            : 'This invitation could not be declined.';
        setError(message);
      });
  }, [searchParams]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{error ? 'Invitation unavailable' : 'Invitation declined'}</CardTitle>
          <CardDescription>
            {error
              ? error
              : `You've declined the invitation to ${groupName ?? 'this group'}.`}
          </CardDescription>
        </CardHeader>
        <CardContent />
        <CardFooter>
          <Link to="/" className="w-full sm:w-auto">
            <Button variant="outline" className="w-full">Go Home</Button>
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}
