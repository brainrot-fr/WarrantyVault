import { describe, expect, it } from 'vitest';
import { createHouseholdSchema, inviteMemberSchema } from './household-schemas';

describe('household form schemas', () => {
  it('trims household names and rejects blank or oversized values', () => {
    expect(createHouseholdSchema.parse({ name: '  Home  ' }).name).toBe('Home');
    expect(createHouseholdSchema.safeParse({ name: '   ' }).success).toBe(false);
    expect(createHouseholdSchema.safeParse({ name: 'x'.repeat(81) }).success).toBe(false);
  });

  it('normalizes invite email addresses before sending', () => {
    expect(inviteMemberSchema.parse({ email: '  PERSON@Example.com ' }).email)
      .toBe('person@example.com');
    expect(inviteMemberSchema.safeParse({ email: 'not-an-email' }).success).toBe(false);
  });
});
