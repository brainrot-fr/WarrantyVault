import { friendlyError } from './friendly-error';

export function errorMessage(error: unknown): string {
  return friendlyError(error);
}
