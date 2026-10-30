export type FieldConfidence = 'high' | 'medium' | 'low' | 'none';

export interface ParsedReceipt {
  productName: string | null;
  brand: string | null;
  category: string | null;
  merchant: string | null;
  purchaseDate: string | null;
  purchasePrice: number | null;
  warrantyMonths: number | null;
  ambiguousDate: boolean;
  confidence: {
    productName: FieldConfidence;
    brand: FieldConfidence;
    category: FieldConfidence;
    merchant: FieldConfidence;
    purchaseDate: FieldConfidence;
    purchasePrice: FieldConfidence;
    warrantyMonths: FieldConfidence;
  };
}

const datePattern = /\b(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}-\d{2}-\d{2})\b/;
const pricePattern =
  /\b(?:grand\s+total|total(?:\s+paid|\s+amount)?|amount\s+paid|purchase\s+price|price)\b\s*[:#=-]?\s*(?:(?:USD|CAD|AUD|EUR|GBP|INR)\s*)?(?:[$€£₹]\s*)?([0-9][0-9.,]*)(?:\s*(?:USD|CAD|AUD|EUR|GBP|INR))?/i;

interface ParsedDate {
  value: string;
  ambiguous: boolean;
}

function isValidDate(year: number, month: number, day: number) {
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  date.setUTCHours(0, 0, 0, 0);
  return date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day;
}

function parseDate(candidate: string): ParsedDate | null {
  if (/^\d{4}-\d{2}-\d{2}$/.test(candidate)) {
    const [year, month, day] = candidate.split('-').map(Number);
    return isValidDate(year, month, day) ? { value: candidate, ambiguous: false } : null;
  }

  const parts = candidate.split(/[/-]/).map(Number);
  if (parts.length !== 3) return null;
  const [first, second, rawYear] = parts;
  const year = rawYear < 100 ? rawYear + 2000 : rawYear;
  let month: number;
  let day: number;
  let ambiguous = false;
  if (first > 12) {
    day = first;
    month = second;
  } else if (second > 12) {
    month = first;
    day = second;
  } else {
    month = first;
    day = second;
    ambiguous = true;
  }
  if (!isValidDate(year, month, day)) return null;
  return {
    value: `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${
      String(day).padStart(2, '0')
    }`,
    ambiguous,
  };
}

function parseWarrantyMonths(text: string): number | null {
  const duration = /(\d{1,2})\s*[- ]?(year|yr|month|mo)s?\s+(?:limited\s+)?warrant(?:y|ee)/i
    .exec(text);
  if (duration) {
    const value = Number(duration[1]);
    return /^(year|yr)/i.test(duration[2]) ? value * 12 : value;
  }

  const label = /warrant(?:y|ee)\s*[:-]?\s*(\d{1,2})\s*(yr|year|mo|month)s?\b/i
    .exec(text);
  if (!label) return null;
  const value = Number(label[1]);
  return /^(yr|year)$/i.test(label[2]) ? value * 12 : value;
}

function firstMatchingLine(lines: string[], expression: RegExp): string | null {
  for (const line of lines) {
    const match = expression.exec(line.trim());
    if (match) return match[1].trim();
  }
  return null;
}

function productFromDescription(lines: string[]): string | null {
  const heading = /description\s*of\s*(?:goods?|gty|products?)/i;
  const start = lines.findIndex((line) => heading.test(line));
  if (start < 0) return null;

  const description: string[] = [];
  for (let index = start + 1; index < lines.length && index < start + 15; index += 1) {
    let line = lines[index].trim();
    if (!line) {
      if (description.length > 0) break;
      continue;
    }
    if (/^\(?\d+\)?\s*(?:of\s+\d+)?$/i.test(line)) break;
    if (/^(?:total|amount|details of goods|gst|cgst|sgst|igst)\b/i.test(line)) break;
    if (/(?:gross weight|value of goods|goods? consignment|description of|particulars|hsn|sac)/i.test(line)) {
      continue;
    }

    if (description.length === 0) {
      line = line.replace(/\s+\d{1,5}\s+\d{3,8}\s*(?:grams?|g|kg)\b.*$/i, '')
        .replace(/\s+\d+(?:[.,]\d+)?\s*$/, '');
    }
    line = line.replace(/\s*\(\d+\)\s*$/, '');
    if (!line.trim()) continue;
    description.push(line.trim());
    if (/[.!?]$/.test(line)) break;
  }
  const result = description.join(' ').replace(/\s+/g, ' ').trim();
  return result ? result.slice(0, 240).trim() : null;
}

function firstLineAfter(lines: string[], headingExpression: RegExp): string | null {
  for (let index = 0; index < lines.length - 1; index += 1) {
    if (!headingExpression.test(lines[index].trim())) continue;
    for (let next = index + 1; next < lines.length; next += 1) {
      const candidate = lines[next].trim();
      if (!candidate) continue;
      if (/^(?:gstin|pan|state|place of supply)\s*:.*$/i.test(candidate)) break;
      return candidate;
    }
  }
  return null;
}

function parsePrice(lines: string[]): number | null {
  for (const line of lines) {
    const match = pricePattern.exec(line.trim());
    if (!match) continue;
    let value = match[1];
    const comma = value.lastIndexOf(',');
    const dot = value.lastIndexOf('.');
    if (comma >= 0 && dot >= 0) {
      const decimalSeparator = comma > dot ? ',' : '.';
      value = value.replace(decimalSeparator === ',' ? /\./g : /,/g, '');
      if (decimalSeparator === ',') value = value.replace(',', '.');
    } else if (comma >= 0) {
      const decimals = value.length - comma - 1;
      value = decimals === 1 || decimals === 2 ? value.replace(',', '.') : value.replace(/,/g, '');
    } else if (dot >= 0 && value.length - dot - 1 > 2) {
      value = value.replace(/\./g, '');
    }
    const price = Number(value);
    return Number.isFinite(price) ? price : null;
  }
  return null;
}

export function parseReceiptText(text: string | null | undefined): ParsedReceipt {
  const clean = text ?? '';
  const lines = clean.split(/\r\n|[\n\r\u2028\u2029]/);
  const productLine = firstMatchingLine(
    lines,
    /(?:item|product|model)\s*[:#-]\s*(.+)/i,
  );
  const productName = productLine ?? productFromDescription(lines);
  const brandLabel = firstMatchingLine(lines, /brand\s*[:#-]\s*(.+)/i);
  const inferredBrand = productName
    ? /^([\p{L}][\p{L}'&-]{2,})\b/u.exec(productName)?.[1] ?? null
    : null;
  const category = firstMatchingLine(lines, /category\s*[:#-]\s*(.+)/i);
  const merchantLabel = firstMatchingLine(
    lines,
    /(?:merchant|store|sold by)\s*[:#-]\s*(.+)/i,
  );
  const billedFromMerchant = firstLineAfter(lines, /^billed\s+from$/i);
  let parsedDate: ParsedDate | null = null;
  let dateLine = '';
  for (const line of lines) {
    const candidate = datePattern.exec(line);
    if (!candidate) continue;
    parsedDate = parseDate(candidate[1]);
    if (parsedDate) {
      dateLine = line;
      break;
    }
  }
  const price = parsePrice(lines);
  const warrantyMonths = parseWarrantyMonths(clean);

  return {
    productName,
    brand: brandLabel ?? inferredBrand,
    category,
    merchant: merchantLabel ?? billedFromMerchant,
    purchaseDate: parsedDate?.value ?? null,
    purchasePrice: price,
    warrantyMonths,
    ambiguousDate: parsedDate?.ambiguous ?? false,
    confidence: {
      productName: productLine ? 'high' : productName ? 'medium' : 'none',
      brand: brandLabel ? 'high' : inferredBrand ? 'medium' : 'none',
      category: category ? 'high' : 'none',
      merchant: merchantLabel ? 'high' : billedFromMerchant ? 'medium' : 'none',
      purchaseDate: parsedDate
        ? parsedDate.ambiguous
          ? 'low'
          : /purchase|invoice|bill.{0,8}date/i.test(dateLine)
          ? 'high'
          : 'medium'
        : 'none',
      purchasePrice: price === null ? 'none' : 'high',
      warrantyMonths: warrantyMonths === null ? 'none' : 'high',
    },
  };
}
