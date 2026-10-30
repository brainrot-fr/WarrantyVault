import { copy } from '@/lib/copy';

export function formatMoney(amount: number | null, currency: string | null) {
  if (amount === null) return copy.amountNotRecorded;
  const formattedAmount = new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
  if (!currency) return formattedAmount;
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      currencyDisplay: 'symbol',
    }).format(amount);
  } catch {
    return `${currency} ${formattedAmount}`;
  }
}
