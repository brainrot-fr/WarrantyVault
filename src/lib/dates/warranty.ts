import { addMonths, differenceInCalendarDays, format, isValid, parseISO } from 'date-fns';

export type WarrantyBucket = 'active' | 'expiring' | 'expired';

export interface WarrantyStatus {
  bucket: WarrantyBucket;
  daysLeft: number | null;
}

function isDateOnly(value: string) {
  const date = parseISO(value);
  return isValid(date) && format(date, 'yyyy-MM-dd') === value;
}

export function calculateWarrantyExpiry(
  purchaseDate: string | null,
  warrantyMonths: number | null,
): string | null {
  if (
    !purchaseDate ||
    warrantyMonths === null ||
    !Number.isInteger(warrantyMonths) ||
    warrantyMonths < 0 ||
    !isDateOnly(purchaseDate)
  ) {
    return null;
  }
  return format(addMonths(parseISO(purchaseDate), warrantyMonths), 'yyyy-MM-dd');
}

export function getWarrantyStatus(
  expiryDate: string | null,
  today = format(new Date(), 'yyyy-MM-dd'),
): WarrantyStatus {
  if (!expiryDate || !isDateOnly(expiryDate) || !isDateOnly(today)) {
    return { bucket: 'active', daysLeft: null };
  }
  const daysLeft = differenceInCalendarDays(parseISO(expiryDate), parseISO(today));
  if (daysLeft < 0) return { bucket: 'expired', daysLeft };
  if (daysLeft <= 30) return { bucket: 'expiring', daysLeft };
  return { bucket: 'active', daysLeft };
}

export function formatDateOnly(value: string | null) {
  return value && isDateOnly(value) ? format(parseISO(value), 'MMM d, yyyy') : null;
}

export function getCoverageProgress(
  purchaseDate: string | null,
  expiryDate: string | null,
  today = format(new Date(), 'yyyy-MM-dd'),
) {
  if (
    !purchaseDate ||
    !expiryDate ||
    !isDateOnly(purchaseDate) ||
    !isDateOnly(expiryDate) ||
    !isDateOnly(today)
  ) {
    return null;
  }
  const totalDays = differenceInCalendarDays(parseISO(expiryDate), parseISO(purchaseDate));
  if (totalDays <= 0) return 100;
  const elapsedDays = differenceInCalendarDays(parseISO(today), parseISO(purchaseDate));
  return Math.round(Math.max(0, Math.min(1, elapsedDays / totalDays)) * 100);
}
