/**
 * Utilities for formatting currency, numbers, dates and codes for Vietnamese POS
 */

export function formatVND(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || isNaN(amount)) return '0 đ';
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(value)) return '0';
  return new Intl.NumberFormat('vi-VN', {
    maximumFractionDigits: 2,
  }).format(value);
}

export function parseNumberFromInput(value: string | number): number {
  if (typeof value === 'number') return value;
  const cleaned = value.replace(/[^0-9.-]+/g, '');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}

export function formatDate(isoString: string | null | undefined, includeTime: boolean = true): string {
  if (!isoString) return '';
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return '';
  
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  
  if (!includeTime) {
    return `${day}/${month}/${year}`;
  }
  
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
}

export function formatDateShort(isoString: string | null | undefined): string {
  return formatDate(isoString, false);
}

export function generateCode(prefix: string, count: number): string {
  const padded = String(count + 1).padStart(6, '0');
  return `${prefix}${padded}`;
}

export function getVietnamNowISO(): string {
  return new Date().toISOString();
}
