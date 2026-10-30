import { useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { Archive, ArrowRight, Check, Globe2, ShieldCheck } from 'lucide-react';
import { GlassButton } from '../components/ui/GlassButton';
import { GlassCard } from '../components/ui/GlassCard';
import { GlassInput } from '../components/ui/GlassInput';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

export function Login() {
  const [mode, setMode] = useState('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [searchParams] = useSearchParams();
  const { user, signIn, signUp, signInWithGoogle, configured } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const nextPath = searchParams.get('next');
  const redirectPath = nextPath?.startsWith('/') && !nextPath.startsWith('//') ? nextPath : '/dashboard';

  if (user) return <Navigate to="/dashboard" replace />;

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (mode === 'signin') {
        await signIn(email.trim(), password);
        navigate(redirectPath);
      } else {
        await signUp(email.trim(), password);
        toast('Check your email to confirm your WarrantyVault account.');
        setMode('signin');
      }
    } catch (submissionError) {
      setError(submissionError.message || 'We could not complete that request.');
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogle() {
    setError('');
    setBusy(true);
    try {
      await signInWithGoogle(redirectPath);
    } catch (authError) {
      setError(authError.message || 'Google sign-in could not start.');
      setBusy(false);
    }
  }

  return (
    <main className="relative z-10 mx-auto grid min-h-[calc(100vh-4rem)] max-w-7xl items-center gap-10 px-4 py-10 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:px-8 lg:py-16">
      <section className="max-w-2xl">
        <p className="eyebrow"><span className="eyebrow-dot" /> A little more peace of mind</p>
        <h1 className="mt-5 max-w-2xl font-heading text-5xl font-semibold leading-[0.98] sm:text-6xl lg:text-7xl">
          Everything you own, <span className="text-accent">looked after.</span>
        </h1>
        <p className="mt-6 max-w-xl text-base leading-8 text-muted-foreground sm:text-lg">
          Keep every receipt, warranty date, and service detail close at hand. When it matters, your proof is already there.
        </p>
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {[
            ['One place', 'Receipts, organized'],
            ['On time', 'Quiet expiry reminders'],
            ['Ready to go', 'A claim pack in a tap'],
          ].map(([title, description]) => (
            <div key={title} className="flex items-start gap-2.5">
              <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-accent/tint text-accent">
                <Check className="h-3.5 w-3.5" aria-hidden="true" />
              </span>
              <div>
                <p className="text-sm font-semibold">{title}</p>
                <p className="text-xs leading-5 text-muted-foreground">{description}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <GlassCard className="mx-auto w-full max-w-md p-6 sm:p-8">
        <div className="mb-6">
          <div className="mb-5 grid h-12 w-12 place-items-center rounded-2xl bg-primary text-on-primary">
            <Archive className="h-5 w-5" aria-hidden="true" />
          </div>
          <p className="eyebrow">{mode === 'signin' ? 'Welcome back' : 'Start your vault'}</p>
          <h2 className="mt-1 font-heading text-4xl font-semibold">{mode === 'signin' ? 'Sign in' : 'Create account'}</h2>
          <p className="mt-2 text-sm text-muted-foreground">Your home for the things you want to keep.</p>
        </div>
        {!configured && (
          <div role="alert" className="warning-notice mb-4 rounded-xl p-3 text-sm">
            Add your Supabase URL and anon key to `frontend/.env` to enable sign-in.
          </div>
        )}
        <GlassButton
          variant="secondary"
          className="w-full"
          onClick={handleGoogle}
          disabled={!configured}
        >
          <Globe2 className="h-4 w-4 text-accent" aria-hidden="true" />
          Continue with Google
        </GlassButton>
        <div className="my-5 flex items-center gap-3 text-xs uppercase tracking-[0.16em] text-muted-foreground">
          <span className="h-px flex-1 bg-border" />
          <span>or use email</span>
          <span className="h-px flex-1 bg-border" />
        </div>
        <form className="grid gap-4" onSubmit={handleSubmit}>
          <GlassInput
            label="Email address"
            name="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
          <GlassInput
            label="Password"
            name="password"
            type="password"
            autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            minLength={8}
            required
          />
          {error && <p role="alert" className="text-sm font-medium text-destructive">{error}</p>}
          <GlassButton className="w-full" type="submit" loading={busy} disabled={!configured}>
            {mode === 'signin' ? 'Sign in' : 'Create your account'}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </GlassButton>
        </form>
        <p className="mt-5 text-center text-sm text-muted-foreground">
          {mode === 'signin' ? 'New to WarrantyVault?' : 'Already have an account?'}{' '}
          <button
            type="button"
            className="font-semibold text-accent underline-offset-4 hover:underline"
            onClick={() => {
              setError('');
              setMode((current) => (current === 'signin' ? 'signup' : 'signin'));
            }}
          >
            {mode === 'signin' ? 'Create an account' : 'Sign in'}
          </button>
        </p>
        <div className="mt-6 flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="h-4 w-4" aria-hidden="true" />
          Private by default, shared only with your household.
        </div>
      </GlassCard>
    </main>
  );
}
