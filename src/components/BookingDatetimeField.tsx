import { CalendarDays, Clock3 } from 'lucide-react'
import { useMemo } from 'react'
import {
  combineBookingDatetimeLocal,
  defaultBookingDatetimeLocal,
  formatBookingWindowHint,
  getAvailableDates,
  getAvailableHours,
  getAvailableMinutes,
  splitBookingDatetimeLocal,
} from '../utils/bookingTime'

interface BookingDatetimeFieldProps {
  id?: string
  label?: string
  value: string
  onChange: (value: string) => void
  className?: string
}

export default function BookingDatetimeField({
  id = 'booking-time',
  label = 'Thời gian vào bãi',
  value,
  onChange,
  className = 'hero-field',
}: BookingDatetimeFieldProps) {
  const normalizedValue = value || defaultBookingDatetimeLocal()
  const { date, hour, minute } = splitBookingDatetimeLocal(normalizedValue)

  const dates = useMemo(() => getAvailableDates(), [normalizedValue])
  const hours = useMemo(() => getAvailableHours(date), [date, normalizedValue])
  const minutes = useMemo(() => getAvailableMinutes(date, hour), [date, hour, normalizedValue])

  const update = (nextDate: string, nextHour: number, nextMinute: number) => {
    onChange(combineBookingDatetimeLocal(nextDate, nextHour, nextMinute))
  }

  return (
    <div className={`${className} booking-datetime-field`}>
      <span id={`${id}-label`}>{label}</span>

      <div className="booking-datetime-picker" role="group" aria-labelledby={`${id}-label`}>
        <label className="booking-datetime-part" htmlFor={`${id}-date`}>
          <CalendarDays size={16} strokeWidth={2.2} aria-hidden />
          <select
            id={`${id}-date`}
            value={date}
            onChange={(event) => {
              const nextDate = event.target.value
              const nextHours = getAvailableHours(nextDate)
              const nextHour = nextHours.includes(hour) ? hour : nextHours[0]
              const nextMinutes = getAvailableMinutes(nextDate, nextHour)
              const nextMinute = nextMinutes.includes(minute) ? minute : nextMinutes[0]
              update(nextDate, nextHour, nextMinute)
            }}
          >
            {dates.map((option) => {
              const [year, month, day] = option.split('-').map(Number)
              const label = new Date(Date.UTC(year, month - 1, day, 12)).toLocaleDateString('vi-VN', {
                timeZone: 'Asia/Ho_Chi_Minh',
                weekday: 'short',
                day: '2-digit',
                month: '2-digit',
              })
              return (
                <option key={option} value={option}>
                  {label}
                </option>
              )
            })}
          </select>
        </label>

        <label className="booking-datetime-part" htmlFor={`${id}-hour`}>
          <Clock3 size={16} strokeWidth={2.2} aria-hidden />
          <select
            id={`${id}-hour`}
            value={hour}
            onChange={(event) => {
              const nextHour = Number(event.target.value)
              const nextMinutes = getAvailableMinutes(date, nextHour)
              const nextMinute = nextMinutes.includes(minute) ? minute : nextMinutes[0]
              update(date, nextHour, nextMinute)
            }}
          >
            {hours.map((option) => (
              <option key={option} value={option}>
                {String(option).padStart(2, '0')}h
              </option>
            ))}
          </select>
        </label>

        <label className="booking-datetime-part" htmlFor={`${id}-minute`}>
          <span className="booking-datetime-part-icon" aria-hidden>
            :
          </span>
          <select id={`${id}-minute`} value={minute} onChange={(event) => update(date, hour, Number(event.target.value))}>
            {minutes.map((option) => (
              <option key={option} value={option}>
                {String(option).padStart(2, '0')}
              </option>
            ))}
          </select>
        </label>
      </div>

      <small className="booking-time-hint">{formatBookingWindowHint()}</small>
    </div>
  )
}
