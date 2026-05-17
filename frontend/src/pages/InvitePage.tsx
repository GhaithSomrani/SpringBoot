import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { acceptInvitation } from '@/api/notifications';

export function InvitePage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const token = searchParams.get('token');
    if (!token) {
      setStatus('error');
      setErrorMsg('Missing invitation token.');
      return;
    }

    acceptInvitation(token)
      .then(() => {
        setStatus('success');
        setTimeout(() => navigate('/dashboard', { replace: true }), 2500);
      })
      .catch((err) => {
        setStatus('error');
        const msg =
          axios.isAxiosError(err) && err.response?.data?.message
            ? err.response.data.message
            : 'This invitation is invalid or has expired.';
        setErrorMsg(msg);
      });
  }, [searchParams, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-sm rounded-xl border border-border p-8 text-center shadow-sm">
        {status === 'loading' && (
          <>
            <p className="text-sm font-medium text-foreground">Accepting invitation…</p>
            <p className="mt-1 text-xs text-muted-foreground">Please wait.</p>
          </>
        )}
        {status === 'success' && (
          <>
            <p className="text-sm font-semibold text-foreground">You have joined the group!</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Redirecting to dashboard…
            </p>
          </>
        )}
        {status === 'error' && (
          <>
            <p className="text-sm font-semibold text-destructive">Invitation failed</p>
            <p className="mt-2 text-xs text-muted-foreground">{errorMsg}</p>
            <button
              onClick={() => navigate('/dashboard', { replace: true })}
              className="mt-4 text-xs text-primary underline-offset-4 hover:underline"
            >
              Go to dashboard
            </button>
          </>
        )}
      </div>
    </div>
  );
}
