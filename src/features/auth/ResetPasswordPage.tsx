import { useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, type UseFormRegisterReturn } from 'react-hook-form';
import { Link, Navigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/app/auth-context';
import { copy } from '@/lib/copy';
import { nativeAuthRedirect } from '@/lib/native-config';
import { errorMessage } from '@/lib/errors';
import { supabase } from '@/lib/supabase/client';
import { newPasswordSchema, resetRequestSchema, type NewPasswordValues, type ResetRequestValues } from './auth-schema';

export function ResetPasswordPage() {
  const { user, isLoading, isRecovery, setRecoveryMode } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [requestSent, setRequestSent] = useState(false);
  const resetForm = useForm<ResetRequestValues>({
    resolver: zodResolver(resetRequestSchema),
    defaultValues: { email: '' },
  });
  const passwordForm = useForm<NewPasswordValues>({
    resolver: zodResolver(newPasswordSchema),
    defaultValues: { password: '', confirmPassword: '' },
  });

  if (isLoading) {
    return <main className="auth-page"><p>{copy.loading}</p></main>;
  }

  if (!isRecovery && user) {
    return <Navigate to="/" replace />;
  }

  const requestReset = resetForm.handleSubmit(async ({ email }) => {
    setIsSubmitting(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: Capacitor.isNativePlatform()
          ? nativeAuthRedirect('/reset')
          : new URL('/auth/reset', window.location.origin).toString(),
      });
      if (error) {
        throw error;
      }

      setRequestSent(true);
      toast.success(copy.resetEmailSent);
    } catch (error) {
      toast.error(copy.resetEmailError, {
        description: errorMessage(error),
      });
    } finally {
      setIsSubmitting(false);
    }
  });

  const updatePassword = passwordForm.handleSubmit(async ({ password }) => {
    setIsSubmitting(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        throw error;
      }

      setRecoveryMode(false);
      toast.success(copy.passwordUpdated);
    } catch (error) {
      toast.error(copy.passwordUpdateError, {
        description: errorMessage(error),
      });
    } finally {
      setIsSubmitting(false);
    }
  });

  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="reset-title">
        <Link className="auth-brand" to="/">{copy.appName}</Link>
        <h1 id="reset-title">{isRecovery ? copy.choosePasswordTitle : copy.resetPasswordTitle}</h1>
        <p>{isRecovery ? copy.choosePasswordDescription : copy.resetPasswordDescription}</p>

        {isRecovery ? (
          <form className="auth-form" onSubmit={updatePassword} noValidate>
            <ResetField
              id="new-password"
              label={copy.newPassword}
              type="password"
              autoComplete="new-password"
              error={passwordForm.formState.errors.password?.message}
              registration={passwordForm.register('password')}
            />
            <ResetField
              id="confirm-password"
              label={copy.confirmPassword}
              type="password"
              autoComplete="new-password"
              error={passwordForm.formState.errors.confirmPassword?.message}
              registration={passwordForm.register('confirmPassword')}
            />
            <Button className="auth-submit" type="submit" disabled={isSubmitting}>
              {isSubmitting ? copy.working : copy.updatePassword}
            </Button>
          </form>
        ) : (
          <form className="auth-form" onSubmit={requestReset} noValidate>
            <ResetField
              id="reset-email"
              label={copy.emailAddress}
              type="email"
              autoComplete="email"
              error={resetForm.formState.errors.email?.message}
              registration={resetForm.register('email')}
            />
            <Button className="auth-submit" type="submit" disabled={isSubmitting || requestSent}>
              {requestSent ? copy.resetEmailSent : isSubmitting ? copy.working : copy.sendResetLink}
            </Button>
          </form>
        )}

        <Link className="auth-inline-link auth-back-link" to="/login">{copy.backToSignIn}</Link>
      </section>
    </main>
  );
}

interface ResetFieldProps {
  id: string;
  label: string;
  type: string;
  autoComplete: string;
  error?: string;
  registration: UseFormRegisterReturn;
}

function ResetField({ id, label, type, autoComplete, error, registration }: ResetFieldProps) {
  const errorId = `${id}-error`;

  return (
    <div className="auth-field">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type={type}
        autoComplete={autoComplete}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
        {...registration}
      />
      {error && <p className="auth-field-error" id={errorId}>{error}</p>}
    </div>
  );
}
