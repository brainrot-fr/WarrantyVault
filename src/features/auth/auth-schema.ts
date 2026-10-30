import { z } from 'zod';
import { copy } from '@/lib/copy';

export const authSchema = z.object({
  displayName: z.string().trim().optional(),
  email: z.email({ error: copy.emailInvalid }),
  password: z.string().min(8, copy.passwordMinLength),
});

export const resetRequestSchema = z.object({
  email: z.email({ error: copy.emailInvalid }),
});

export const newPasswordSchema = z.object({
  password: z.string().min(8, copy.passwordMinLength),
  confirmPassword: z.string().min(8, copy.passwordMinLength),
}).refine((value) => value.password === value.confirmPassword, {
  path: ['confirmPassword'],
  error: copy.passwordsDoNotMatch,
});

export type AuthFormValues = z.infer<typeof authSchema>;
export type ResetRequestValues = z.infer<typeof resetRequestSchema>;
export type NewPasswordValues = z.infer<typeof newPasswordSchema>;
