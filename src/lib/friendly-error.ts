import { copy } from './copy';

export function friendlyError(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = String((error as { code?: unknown }).code);
    if (code === '42501') return copy.errorPermission;
    if (code === '23505') return copy.errorDuplicate;
    if (code === 'PGRST301' || code === '401') return copy.errorSessionExpired;
  }
  const message = error instanceof Error ? error.message : '';
  if (/network|fetch failed|failed to fetch/i.test(message)) return copy.errorNetwork;
  if (/jwt|session.*expired|token.*expired/i.test(message)) return copy.errorSessionExpired;
  return copy.errorUnexpected;
}
