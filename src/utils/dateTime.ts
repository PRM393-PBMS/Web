export const VIETNAM_TIME_ZONE = 'Asia/Ho_Chi_Minh'
const VIETNAM_UTC_OFFSET = '+07:00'

export function toUtcIsoString(value: Date | string) {
  return parseBackendUtcDate(value).toISOString()
}

export function parseBackendUtcDate(value: string | Date) {
  if (value instanceof Date) return value

  const trimmed = value.trim()
  const hasTimeZone = /(?:z|[+-]\d{2}:?\d{2})$/i.test(trimmed)
  const normalized = hasTimeZone
    ? trimmed
    : /^\d{4}-\d{2}-\d{2}$/.test(trimmed)
      ? `${trimmed}T00:00:00Z`
      : `${trimmed.replace(' ', 'T')}Z`

  return new Date(normalized)
}

function vietnamParts(value: string | Date, includeTime: boolean) {
  const date = value instanceof Date ? value : parseBackendUtcDate(value)
  if (Number.isNaN(date.getTime())) return null

  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: VIETNAM_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    ...(includeTime ? { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' as const } : {}),
  }).formatToParts(date)
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? ''

  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour'),
    minute: get('minute'),
  }
}

/** Convert an instant returned by the UTC backend to a Vietnam datetime-local value. */
export function toVietnamDatetimeLocal(value?: string | Date | null) {
  if (!value) return ''
  const parts = vietnamParts(value, true)
  if (!parts) return ''
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`
}

/** Convert a datetime-local value entered as Vietnam time to the UTC ISO format used by the backend. */
export function vietnamDatetimeLocalToUtcIso(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return ''
  if (/(?:z|[+-]\d{2}:?\d{2})$/i.test(trimmed)) return new Date(trimmed).toISOString()

  const normalized = trimmed.replace(' ', 'T')
  return new Date(`${normalized.length === 16 ? `${normalized}:00` : normalized}${VIETNAM_UTC_OFFSET}`).toISOString()
}

export function toVietnamDateInput(value: string | Date = new Date()) {
  const parts = vietnamParts(value, false)
  return parts ? `${parts.year}-${parts.month}-${parts.day}` : ''
}

/** Convert the start/end of a Vietnam calendar date to a UTC backend timestamp. */
export function vietnamDateBoundaryToUtcIso(value: string, endOfDay = false) {
  const time = endOfDay ? '23:59:59.999' : '00:00:00.000'
  return new Date(`${value}T${time}${VIETNAM_UTC_OFFSET}`).toISOString()
}

export function formatUtcToVietnamDateTime(value?: string | null) {
  if (!value) return ''

  const date = parseBackendUtcDate(value)
  if (Number.isNaN(date.getTime())) return value

  const parts = new Intl.DateTimeFormat('vi-VN', {
    timeZone: VIETNAM_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? ''

  return `${get('hour')}:${get('minute')} ${get('day')}/${get('month')}/${get('year')}`
}

export function formatUtcToVietnamDate(value?: string | null) {
  if (!value) return ''

  const date = parseBackendUtcDate(value)
  if (Number.isNaN(date.getTime())) return value

  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: VIETNAM_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

export function formatNowInVietnamTime() {
  return formatUtcToVietnamDateTime(new Date().toISOString())
}
