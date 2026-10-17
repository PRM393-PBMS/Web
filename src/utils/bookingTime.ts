import {
  toVietnamDateInput,
  toVietnamDatetimeLocal,
  vietnamDatetimeLocalToUtcIso,
} from './dateTime'

export const BOOKING_WINDOW_HOURS = 5
export const QUARTER_MINUTES = [0, 15, 30, 45] as const

export function toDatetimeLocalValue(date: Date): string {
  return toVietnamDatetimeLocal(date)
}

export function toDateInputValue(date: Date): string {
  return toVietnamDateInput(date)
}

export function parseDatetimeLocal(value: string): Date {
  return new Date(vietnamDatetimeLocalToUtcIso(value))
}

function ceilToQuarterHour(date: Date): Date {
  const quarter = 15 * 60_000
  return new Date(Math.ceil(date.getTime() / quarter) * quarter)
}

function floorToQuarterHour(date: Date): Date {
  const quarter = 15 * 60_000
  return new Date(Math.floor(date.getTime() / quarter) * quarter)
}

export function getBookingTimeBounds(now = new Date()) {
  const min = ceilToQuarterHour(now)
  const max = floorToQuarterHour(new Date(now.getTime() + BOOKING_WINDOW_HOURS * 60 * 60 * 1000))
  return { min, max }
}

export function defaultBookingDatetimeLocal(now = new Date()): string {
  const { min, max } = getBookingTimeBounds(now)
  const candidate = ceilToQuarterHour(new Date(now.getTime() + 60 * 60 * 1000))
  const value = candidate.getTime() < min.getTime() ? min : candidate
  const clamped = value.getTime() > max.getTime() ? max : value
  return toDatetimeLocalValue(clamped)
}

export function clampBookingDatetimeLocal(value: string, now = new Date()): string {
  if (!value) return defaultBookingDatetimeLocal(now)

  const { min, max } = getBookingTimeBounds(now)
  let date = ceilToQuarterHour(parseDatetimeLocal(value))

  if (date.getTime() < min.getTime()) date = min
  if (date.getTime() > max.getTime()) date = max

  return toDatetimeLocalValue(date)
}

export function isBookingDatetimeLocalValid(value: string, now = new Date()): boolean {
  if (!value) return false

  const { min, max } = getBookingTimeBounds(now)
  const date = parseDatetimeLocal(value)

  if (Number.isNaN(date.getTime())) return false
  if (!QUARTER_MINUTES.includes(date.getMinutes() as (typeof QUARTER_MINUTES)[number])) {
    return false
  }
  if (date.getSeconds() !== 0 || date.getMilliseconds() !== 0) return false
  if (date.getTime() < min.getTime() || date.getTime() > max.getTime()) return false

  return true
}

export function bookingTimeBoundsLocal(now = new Date()) {
  const { min, max } = getBookingTimeBounds(now)
  return {
    min: toDatetimeLocalValue(min),
    max: toDatetimeLocalValue(max),
    minDate: toDateInputValue(min),
    maxDate: toDateInputValue(max),
  }
}

function isSlotInBounds(date: string, hour: number, minute: number, now = new Date()) {
  const { min, max } = getBookingTimeBounds(now)
  const slot = parseDatetimeLocal(
    `${date}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
  )
  return slot.getTime() >= min.getTime() && slot.getTime() <= max.getTime()
}

export function getAvailableDates(now = new Date()): string[] {
  const { min, max } = getBookingTimeBounds(now)
  const dates: string[] = []
  let cursor = parseDatetimeLocal(`${toDateInputValue(min)}T00:00`)

  while (cursor.getTime() <= max.getTime()) {
    const date = toDateInputValue(cursor)
    const hasSlot = QUARTER_MINUTES.some((minute) =>
      Array.from({ length: 24 }, (_, hour) => hour).some((hour) =>
        isSlotInBounds(date, hour, minute, now),
      ),
    )
    if (hasSlot) dates.push(date)
    cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000)
  }

  return dates
}

export function getAvailableHours(date: string, now = new Date()): number[] {
  return Array.from({ length: 24 }, (_, hour) => hour).filter((hour) =>
    QUARTER_MINUTES.some((minute) => isSlotInBounds(date, hour, minute, now)),
  )
}

export function getAvailableMinutes(date: string, hour: number, now = new Date()): number[] {
  return QUARTER_MINUTES.filter((minute) => isSlotInBounds(date, hour, minute, now))
}

export function splitBookingDatetimeLocal(value: string) {
  const clamped = clampBookingDatetimeLocal(value)
  const [date, time] = clamped.split('T')
  const [hour, minute] = time.split(':')
  return {
    date,
    hour: Number(hour),
    minute: Number(minute),
    combined: clamped,
  }
}

export function combineBookingDatetimeLocal(date: string, hour: number, minute: number): string {
  return clampBookingDatetimeLocal(
    `${date}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
  )
}

export function formatBookingWindowHint(now = new Date()): string {
  const { min, max } = getBookingTimeBounds(now)
  const formatter = new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
  })

  return `Chọn từ ${formatter.format(min)} đến ${formatter.format(max)} (trong ${BOOKING_WINDOW_HOURS} giờ tới).`
}
