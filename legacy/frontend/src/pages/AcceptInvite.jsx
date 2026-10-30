import { useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Home, ShieldCheck } from 'lucide-react';
import { GlassButton } from '../components/ui/GlassButton';
import { GlassCard } from '../components/ui/GlassCard';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { api } from '../lib/api';

export function AcceptInvite() {
  const [params] = useSearchParams();
  const [error, setError] = useState('');
  const token = params.get('token');
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();

  const acceptMutation = useMutation({
    mutationFn: () => api.post('/households/invites/accept', { token }),
    onSuccess: (household) => {
      queryClient.invalidateQueries({ queryKey: ['households'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast(`You joined ${household.name || 'the household'}.`);
      navigate('/household');
    },
    onError: (acceptError) => setError(acceptError.message),
  });

  if (loading) {
    return <main className="page-shell"><GlassCard><p>Checking your sign-in…</p></GlassCard></main>;
  }
  if (!user) {
    return <Navigate to={token ? `/login?next=${encodeURIComponent(`/accept-invite?token=${token}`)}` : '/login'} replace />;
  }

  return (
    <main className="relative z-10 mx-auto grid min-h-[calc(100vh-4rem)] max-w-7xl place-items-center px-4 py-12">
      <GlassCard className="w-full max-w-xl p-7 text-center sm:p-10">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-accent/tint text-accent">
          <Home className="h-6 w-6" aria-hidden="true" />
        </span>
        <p className="eyebrow mt-5 justify-center">A little more together</p>
        <h1 className="mt-2 font-heading text-4xl font-semibold sm:text-5xl">Join your household.</h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-muted-foreground">
          This invite is for <strong className="text-foreground">{user.email}</strong>. Accept to see and manage the household’s warranty records.
        </p>
        {!token ? (
          <p role="alert" className="mt-5 text-sm font-medium text-destructive">This invite link is missing its secure token. Ask the household owner to send a fresh invitation.</p>
        ) : (
          <GlassButton className="mt-6" loading={acceptMutation.isPending} onClick={() => { setError(''); acceptMutation.mutate(); }}>
            Accept invitation <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </GlassButton>
        )}
        {error && <p role="alert" className="mt-4 text-sm font-medium text-destructive">{error}</p>}
        <p className="mt-6 flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="h-4 w-4" aria-hidden="true" /> Invites are private and expire after a short time.
        </p>
        <Link to="/dashboard" className="mt-5 inline-block text-sm font-semibold text-accent hover:underline">Back to your dashboard</Link>
      </GlassCard>
    </main>
  );
}
