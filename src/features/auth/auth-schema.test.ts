import { describe, expect, it } from 'vitest';
import { authSchema, newPasswordSchema, resetRequestSchema } from './auth-schema';

describe('auth form schemas', () => {
  it('accepts a valid email and password', () => {
    expect(authSchema.safeParse({
      displayName: '  Sam  ',
      email: 'sam@example.com',
      password: 'a-secure-password',
    }).success).toBe(true);
  });

  it('rejects invalid emails and short passwords', () => {
    expect(resetRequestSchema.safeParse({ email: 'not-an-email' }).success).toBe(false);
    expect(authSchema.safeParse({
      displayName: '',
      email: 'sam@example.com',
      password: 'short',
    }).success).toBe(false);
  });

  it('requires matching new passwords', () => {
    expect(newPasswordSchema.safeParse({
      password: 'a-secure-password',
      confirmPassword: 'a-different-password',
    }).success).toBe(false);
    expect(newPasswordSchema.safeParse({
      password: 'a-secure-password',
      confirmPassword: 'a-secure-password',
    }).success).toBe(true);
  });
});
