import { CalendarDays, Car, MapPin, RefreshCw, Search } from 'lucide-react'
import { useEffect, useMemo, useState, type MouseEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ToastContainer, useToast } from './Toast'
import {
  clampBookingDatetimeLocal,
  defaultBookingDatetimeLocal,
  isBookingDatetimeLocalValid,
} from '../utils/bookingTime'
import { API_CONFIG } from '../config/api'
import type { ApiResponse, ParkingAvailabilityDto } from '../utils/apiServices'

const isCarAvailability = (item: ParkingAvailabilityDto) => {
  const name = (item.vehicleTypeName ?? '').toLocaleLowerCase('vi')
  return name.includes('car') || name.includes('oto') || name.includes('o to') || name.includes('ô tô')
}

export default function HeroSection() {
  const navigate = useNavigate()
  const [startTime, setStartTime] = useState(defaultBookingDatetimeLocal)
  const [availability, setAvailability] = useState<ParkingAvailabilityDto[]>([])
  const [availabilityLoading, setAvailabilityLoading] = useState(true)
  const toast = useToast()

  useEffect(() => {
    let ignore = false

    const loadAvailability = async () => {
      try {
        // Trang chủ là nội dung công khai. Không dùng apiClient ở đây vì cơ chế
        // làm mới phiên của nó sẽ chuyển guest sang đăng nhập khi API trả 401.
        const floorKeyword = encodeURIComponent('Vãng Lai')
        const request = await fetch(`${API_CONFIG.BASE_URL}/ParkingOperation/availability?floorKeyword=${floorKeyword}`, {
          headers: { Accept: 'application/json' },
        })
        if (!request.ok) return

        const response = await request.json() as ApiResponse<ParkingAvailabilityDto[]>
        if (!ignore && response.isSuccess && Array.isArray(response.result)) {
          setAvailability(response.result)
        }
      } catch (error) {
        console.error('Không thể tải tình trạng chỗ trống:', error)
      } finally {
        if (!ignore) setAvailabilityLoading(false)
      }
    }

    void loadAvailability()
    const timer = window.setInterval(loadAvailability, 60_000)
    return () => {
      ignore = true
      window.clearInterval(timer)
    }
  }, [])

  const carAvailability = useMemo(() => {
    const carFloors = availability.filter(isCarAvailability)
    const total = carFloors.reduce((sum, item) => sum + item.totalSlots, 0)
    const directCapacity = Math.floor(total * 0.8)

    return {
      total,
      directCapacity,
      reservationCapacity: total - directCapacity,
    }
  }, [availability])

  const handleSearch = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault()
    const normalized = startTime
      ? clampBookingDatetimeLocal(startTime)
      : defaultBookingDatetimeLocal()

    if (!isBookingDatetimeLocalValid(normalized)) {
      toast.warning('Thời gian dự kiến đến phải nằm trong vòng 5 giờ tính từ thời điểm hiện tại.')
      return
    }

    navigate('/dat-cho', { state: { vehicle: 'car', startTime: normalized } })
  }

  return (
    <section className="home-hero">
      <ToastContainer toasts={toast.toasts} onClose={toast.close} />
      <div className="home-hero-media" aria-hidden>
        <img src="/image/banner.jpg" alt="" className="home-hero-img" />
        <div className="home-hero-overlay" />
      </div>

      <div className="home-hero-inner">
        <div className="home-hero-copy">
          <div className="location-pill">
            <MapPin size={18} strokeWidth={2.2} aria-hidden />
            01 Lưu Hữu Phước, Đông Hòa, Bình Dương
          </div>

          <h1>
            Giải pháp đỗ xe
            <span>hiện đại & tiện lợi</span>
          </h1>

          <p className="home-hero-lead">
            Cập nhật chỗ trống theo thời gian thực, đăng ký thẻ tháng nhanh chóng
            và ra vào không tiếp xúc bằng hệ thống nhận diện biển số.
          </p>

          <div className="availability-card">
            <div className="availability-head">
              <div className="availability-allocation" aria-live="polite">
                {availabilityLoading ? (
                  <div className="availability-count">
                    <RefreshCw className="availability-loading-icon" size={20} aria-hidden />
                    <strong className="availability-pending">Đang cập nhật</strong>
                  </div>
                ) : carAvailability.total > 0 ? (
                  <>
                    <div className="availability-allocation-item availability-allocation-item--direct">
                      <span className="live-dot" aria-hidden />
                      <div>
                        <strong>{carAvailability.directCapacity}</strong>
                        <span>chỗ vào trực tiếp · 80%</span>
                      </div>
                    </div>
                    <div className="availability-allocation-item availability-allocation-item--reservation">
                      <CalendarDays size={22} aria-hidden />
                      <div>
                        <strong>{carAvailability.reservationCapacity}</strong>
                        <span>chỗ đặt trước · 20%</span>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="availability-count">
                    <span className="live-dot live-dot--unknown" />
                    <strong className="availability-pending">Chưa có dữ liệu</strong>
                  </div>
                )}
              </div>
            </div>

            <div className="search-grid">
              <label className="hero-field">
                <span>Loại xe</span>
                <div>
                  <Car size={18} strokeWidth={2.2} aria-hidden />
                  <span className="hero-field-static">Ô tô</span>
                </div>
              </label>

              <label className="hero-field">
                <span>Thời gian đến</span>
                <div className="datetime-input-wrapper">
                  <CalendarDays size={18} className="calendar-icon" aria-hidden />
                  <input
                    id="home-booking-time"
                    type="datetime-local"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                  />
                </div>
              </label>
            </div>

            <Link to="/dat-cho" onClick={handleSearch} className="hero-search-btn">
              Tìm chỗ ngay
              <Search size={20} strokeWidth={2.3} aria-hidden />
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
