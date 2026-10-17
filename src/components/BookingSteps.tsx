import { Check } from 'lucide-react'
import { Link } from 'react-router-dom'

const steps = [
  { n: 1, label: 'Chọn chỗ', path: '/dat-cho' },
  { n: 2, label: 'Xác nhận', path: '/dat-cho/xac-nhan' },
  { n: 3, label: 'Thanh toán', path: '/thanh-toan' },
]

interface BookingStepsProps {
  current: number
}

export default function BookingSteps({ current }: BookingStepsProps) {
  return (
    <nav className="booking-steps" aria-label="Tiến trình đặt chỗ">
      {steps.map((s) => {
        const done = s.n < current
        const active = s.n === current
        const className = `booking-step${active ? ' active' : ''}${done ? ' done' : ''}`

        if (done) {
          return (
            <Link key={s.n} to={s.path} className={className}>
              <span className="step-num"><Check size={14} /></span>
              <span className="step-label">{s.label}</span>
            </Link>
          )
        }

        return (
          <span key={s.n} className={className} aria-current={active ? 'step' : undefined}>
            <span className="step-num">{s.n}</span>
            <span className="step-label">{s.label}</span>
          </span>
        )
      })}
    </nav>
  )
}
