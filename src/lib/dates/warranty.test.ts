import { describe, expect, it } from 'vitest';
import { calculateWarrantyExpiry, getCoverageProgress, getWarrantyStatus } from './warranty';

describe('warranty dates and status buckets', () => {
  it('adds calendar months and clamps month-end dates', () => {
    expect(calculateWarrantyExpiry('2024-02-29', 12)).toBe('2025-02-28');
    expect(calculateWarrantyExpiry('2025-05-31', 3)).toBe('2025-08-31');
    expect(calculateWarrantyExpiry('2025-01-31', 1)).toBe('2025-02-28');
  });

  it('keeps expired, expiring, and active buckets mutually exclusive', () => {
    expect(getWarrantyStatus('2025-05-31', '2025-06-01')).toEqual({
      bucket: 'expired',
      daysLeft: -1,
    });
    expect(getWarrantyStatus('2025-06-01', '2025-06-01')).toEqual({
      bucket: 'expiring',
      daysLeft: 0,
    });
    expect(getWarrantyStatus('2025-07-01', '2025-06-01')).toEqual({
      bucket: 'expiring',
      daysLeft: 30,
    });
    expect(getWarrantyStatus('2025-07-02', '2025-06-01')).toEqual({
      bucket: 'active',
      daysLeft: 31,
    });
    expect(getWarrantyStatus(null, '2025-06-01')).toEqual({
      bucket: 'active',
      daysLeft: null,
    });
  });

  it('computes a clamped coverage timeline marker', () => {
    expect(getCoverageProgress('2025-01-01', '2025-01-11', '2025-01-06')).toBe(50);
    expect(getCoverageProgress('2025-01-01', '2025-01-11', '2024-12-30')).toBe(0);
    expect(getCoverageProgress('2025-01-01', '2025-01-11', '2025-02-01')).toBe(100);
  });
});
