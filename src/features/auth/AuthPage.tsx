import { useState, type ReactNode } from 'react';
import { Browser } from '@capacitor/browser';
import { Capacitor } from '@capacitor/core';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, type UseFormRegisterReturn } from 'react-hook-form';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/app/auth-context';
import { copy } from '@/lib/copy';
import { nativeAuthRedirect } from '@/lib/native-config';
import { supabase } from '@/lib/supabase/client';
import { authSchema, type AuthFormValues } from './auth-schema';
import { errorMessage } from '@/lib/errors';

type AuthMode = 'sign-in' | 'sign-up';

interface RedirectState {
  from?: {
    pathname?: string;
  };
}

export function AuthPage() {
  const [mode, setMode] = useState<AuthMode>('sign-in');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [checkEmail, setCheckEmail] = useState(false);
  const { user, isLoading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const redirectState = location.state as RedirectState | null;
  const returnTo = redirectState?.from?.pathname ?? '/';
  const form = useForm<AuthFormValues>({
    resolver: zodResolver(authSchema),
    defaultValues: { displayName: '', email: '', password: '' },
  });

  if (isLoading) {
    return <main className="auth-loading">{copy.loadingAccount}</main>;
  }

  if (user) {
    return <Navigate to={returnTo} replace />;
  }

  const onSubmit = form.handleSubmit(async (values) => {
    const displayName = values.displayName?.trim();
    if (mode === 'sign-up' && !displayName) {
      form.setError('displayName', { type: 'required', message: copy.displayNameRequired });
      return;
    }

    setIsSubmitting(true);
    try {
      if (mode === 'sign-up') {
        const { data, error } = await supabase.auth.signUp({
          email: values.email.trim(),
          password: values.password,
          options: {
            data: { display_name: displayName ?? '' },
            emailRedirectTo: Capacitor.isNativePlatform()
              ? nativeAuthRedirect('/callback')
              : new URL('/', window.location.origin).toString(),
          },
        });

        if (error) {
          throw error;
        }

        if (!data.session) {
          setCheckEmail(true);
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: values.email.trim(),
          password: values.password,
        });

        if (error) {
          throw error;
        }

        navigate(returnTo, { replace: true });
      }
    } catch (error) {
      toast.error(mode === 'sign-in' ? copy.signInError : copy.signUpError, {
        description: errorMessage(error),
      });
    } finally {
      setIsSubmitting(false);
    }
  });

  async function signInWithGoogle() {
    setIsSubmitting(true);
    try {
      const native = Capacitor.isNativePlatform();
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: native
            ? nativeAuthRedirect('/callback', returnTo)
            : new URL(returnTo, window.location.origin).toString(),
          ...(native ? { skipBrowserRedirect: true } : {}),
        },
      });

      if (error) {
        throw error;
      }

      if (native) {
        if (!data.url) throw new Error(copy.nativeAuthUrlMissing);
        await Browser.open({ url: data.url });
      }
    } catch (error) {
      toast.error(copy.googleSignInError, {
        description: errorMessage(error),
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function signInWithApple() {
    setIsSubmitting(true);
    try {
      const native = Capacitor.isNativePlatform();
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'apple',
        options: {
          redirectTo: native
            ? nativeAuthRedirect('/callback', returnTo)
            : new URL(returnTo, window.location.origin).toString(),
          ...(native ? { skipBrowserRedirect: true } : {}),
        },
      });
      if (error) throw error;
      if (native) {
        if (!data.url) throw new Error(copy.nativeAuthUrlMissing);
        await Browser.open({ url: data.url });
      }
    } catch (error) {
      toast.error(copy.appleSignInError, { description: errorMessage(error) });
    } finally {
      setIsSubmitting(false);
    }
  }

  function changeMode(nextMode: AuthMode) {
    setMode(nextMode);
    form.clearErrors();
  }

  if (checkEmail) {
    return (
      <main className="auth-page">
        <section className="auth-card" aria-labelledby="auth-title">
          <h1 id="auth-title">{copy.checkYourEmail}</h1>
          <p>{copy.signUpCheckEmail}</p>
          <Button type="button" variant="outline" onClick={() => setCheckEmail(false)}>{copy.backToSignIn}</Button>
        </section>
      </main>
    );
  }

  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="auth-title">
        <Link className="auth-brand" to="/">{copy.appName}</Link>
        <h1 id="auth-title">{mode === 'sign-in' ? copy.signInTitle : copy.signUpTitle}</h1>
        <p>{mode === 'sign-in' ? copy.signInDescription : copy.signUpDescription}</p>

        <div className="auth-mode-switch" aria-label={copy.authModeLabel}>
          <Button
            type="button"
            variant={mode === 'sign-in' ? 'secondary' : 'ghost'}
            aria-pressed={mode === 'sign-in'}
            onClick={() => changeMode('sign-in')}
          >
            {copy.signIn}
          </Button>
          <Button
            type="button"
            variant={mode === 'sign-up' ? 'secondary' : 'ghost'}
            aria-pressed={mode === 'sign-up'}
            onClick={() => changeMode('sign-up')}
          >
            {copy.signUp}
          </Button>
        </div>

        <div className="auth-providers">
          <Button
            className="auth-provider"
            type="button"
            variant="outline"
            disabled={isSubmitting}
            onClick={() => void signInWithGoogle()}
          >
            <GoogleMark />
            {copy.continueWithGoogle}
          </Button>
          <Button
            className="auth-provider"
            type="button"
            variant="outline"
            disabled={isSubmitting}
            onClick={() => void signInWithApple()}
          >
            {copy.continueWithApple}
          </Button>
        </div>

        <div className="auth-divider"><span>{copy.orContinueWith}</span></div>

        <form className="auth-form" onSubmit={onSubmit} noValidate>
          {mode === 'sign-up' && (
            <AuthField
              id="displayName"
              label={copy.displayName}
              error={form.formState.errors.displayName?.message}
              registration={form.register('displayName')}
              autoComplete="name"
            />
          )}
          <AuthField
            id="email"
            label={copy.emailAddress}
            error={form.formState.errors.email?.message}
            registration={form.register('email')}
            type="email"
            autoComplete="email"
          />
          <AuthField
            id="password"
            label={copy.password}
            error={form.formState.errors.password?.message}
            registration={form.register('password')}
            type={showPassword ? 'text' : 'password'}
            autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'}
            action={
              <Button
                className="auth-password-toggle"
                type="button"
                variant="ghost"
                size="sm"
                aria-label={showPassword ? copy.hidePassword : copy.showPassword}
                onClick={() => setShowPassword((visible) => !visible)}
              >
                {showPassword ? copy.hidePassword : copy.showPassword}
              </Button>
            }
          />
          {mode === 'sign-in' && (
            <Link className="auth-inline-link auth-forgot-link" to="/auth/reset">{copy.forgotPassword}</Link>
          )}
          <Button className="auth-submit" type="submit" disabled={isSubmitting}>
            {isSubmitting ? copy.working : mode === 'sign-in' ? copy.signIn : copy.createAccount}
          </Button>
        </form>

      </section>
    </main>
  );
}

interface AuthFieldProps {
  id: keyof AuthFormValues;
  label: string;
  error?: string;
  registration: UseFormRegisterReturn;
  type?: string;
  autoComplete: string;
  action?: ReactNode;
}

function AuthField({ id, label, error, registration, type = 'text', autoComplete, action }: AuthFieldProps) {
  const errorId = `${id}-error`;

  return (
    <div className="auth-field">
      <Label htmlFor={id}>{label}</Label>
      <div className={action ? 'auth-input-with-action' : undefined}>
        <Input
          id={id}
          type={type}
          autoComplete={autoComplete}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          {...registration}
        />
        {action}
      </div>
      {error && <p className="auth-field-error" id={errorId}>{error}</p>}
    </div>
  );
}

function GoogleMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="google-mark">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.91 3.27-4.73 3.27-8.1Z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.65l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.15v2.84A11 11 0 0 0 12 23Z" />
      <path fill="#FBBC05" d="M5.84 14.11a6.6 6.6 0 0 1 0-4.22V7.05H2.15a11 11 0 0 0 0 9.9l3.69-2.84Z" />
      <path fill="#EA4335" d="M12 4.36c1.62 0 3.07.56 4.21 1.64l3.15-3.15A10.54 10.54 0 0 0 12 0 11 11 0 0 0 2.15 7.05l3.69 2.84C6.71 7.29 9.14 4.36 12 4.36Z" />
    </svg>
  );
}
