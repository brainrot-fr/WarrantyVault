import { z } from 'zod';
import { copy } from '@/lib/copy';

export const createHouseholdSchema = z.object({
  name: z.string().trim().min(1, copy.householdNameRequired).max(80, copy.householdNameTooLong),
});

export const inviteMemberSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email({ error: copy.emailInvalid })),
});

export type CreateHouseholdValues = z.infer<typeof createHouseholdSchema>;
export type InviteMemberValues = z.infer<typeof inviteMemberSchema>;
