export function formatDate(value, options = { year: 'numeric', month: 'short', day: 'numeric' }) {
  if (!value) return 'Not set';
  const date = new Date(`${value}`.length === 10 ? `${value}T00:00:00` : value);
  if (Number.isNaN(date.getTime())) return 'Not set';
  return new Intl.DateTimeFormat(undefined, options).format(date);
}

export function daysUntil(value) {
  if (!value) return null;
  const expiry = new Date(`${value}`.length === 10 ? `${value}T00:00:00` : value);
  if (Number.isNaN(expiry.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  expiry.setHours(0, 0, 0, 0);
  return Math.ceil((expiry.getTime() - today.getTime()) / 86400000);
}

export function getWarrantyStatus(item) {
  const days = daysUntil(item.expiryDate);
  if (days === null) return 'active';
  if (days < 0) return 'expired';
  if (days <= 30) return 'expiring';
  return 'active';
}

export function formatCurrency(value) {
  if (value === null || value === undefined || value === '') return '—';
  const amount = Number(value);
  if (!Number.isFinite(amount)) return '—';
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(amount);
}

export function calculateExpiryDate(purchaseDate, warrantyMonths) {
  const months = Number(warrantyMonths);
  if (!purchaseDate || !Number.isInteger(months) || months < 0) return '';
  const [year, month, day] = purchaseDate.split('-').map(Number);
  if (![year, month, day].every(Number.isFinite)) return '';
  const targetMonth = month - 1 + months;
  const targetYear = year + Math.floor(targetMonth / 12);
  const normalizedMonth = ((targetMonth % 12) + 12) % 12;
  const lastDay = new Date(targetYear, normalizedMonth + 1, 0).getDate();
  return `${targetYear}-${String(normalizedMonth + 1).padStart(2, '0')}-${String(Math.min(day, lastDay)).padStart(2, '0')}`;
}

export function normalizeItems(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.content)) return payload.content;
  return [];
}
