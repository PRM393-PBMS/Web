import { formatUtcToVietnamDateTime, parseBackendUtcDate } from './dateTime'

export const PRICE_PER_HOUR = 15_000

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount)
}

export function calcTotal(spotCount: number, hours: number): number {
  return spotCount * hours * PRICE_PER_HOUR
}

export function addHours(isoStart: string, hours: number): string {
  const d = parseBackendUtcDate(isoStart)
  d.setTime(d.getTime() + hours * 60 * 60 * 1000)
  return d.toISOString()
}

export function formatDateTime(iso: string): string {
  return formatUtcToVietnamDateTime(iso)
}
