import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle, XCircle } from 'lucide-react'
import { subscriptionApi, type SubscriptionPackageDto } from '../utils/apiServices'
import { formatCurrency } from '../utils/pricing'

type VehicleFilter = 'car' | 'bike'
type DurationKey = 'm1' | 'm3' | 'm12'
type PackageGroup = Record<DurationKey, SubscriptionPackageDto | null>

const EMPTY_GROUP: PackageGroup = { m1: null, m3: null, m12: null }

const getVehicleFilter = (pkg: SubscriptionPackageDto): VehicleFilter | 'all' => {
  const name = (pkg.vehicleTypeName ?? '').toLocaleLowerCase('vi')
  if (name.includes('car') || name.includes('oto') || name.includes('o to') || name.includes('ô tô')) return 'car'
  if (name.includes('bike') || name.includes('motor') || name.includes('xe may') || name.includes('xe máy')) return 'bike'
  return 'all'
}

const choosePackage = (
  packages: SubscriptionPackageDto[],
  vehicle: VehicleFilter,
  durationMonths: number,
) => packages
  .filter((pkg) => getVehicleFilter(pkg) === vehicle && pkg.durationMonths === durationMonths)
  .sort((a, b) => {
    const score = (pkg: SubscriptionPackageDto) => {
      const name = pkg.packageName.toLocaleLowerCase('vi')
      return (name.includes('gói') ? 2 : 0) - (name.includes('test') ? 10 : 0)
    }
    return score(b) - score(a) || Number(b.price) - Number(a.price)
  })[0] ?? null

export default function SubscriptionPlans() {
  const [isMotorbike, setIsMotorbike] = useState(false)
  const [packages, setPackages] = useState<SubscriptionPackageDto[]>([])

  useEffect(() => {
    let ignore = false

    const loadPackages = async () => {
      try {
        const response = await subscriptionApi.getPackages()
        if (!ignore && response.isSuccess && Array.isArray(response.result)) {
          setPackages(response.result.filter((pkg) => pkg.status.toLowerCase() === 'active'))
        }
      } catch (error) {
        console.error('Không thể tải gói đăng ký:', error)
      }
    }

    void loadPackages()
    return () => {
      ignore = true
    }
  }, [])

  const packageGroups = useMemo(() => {
    const createGroup = (vehicle: VehicleFilter): PackageGroup => ({
      m1: choosePackage(packages, vehicle, 1),
      m3: choosePackage(packages, vehicle, 3),
      m12: choosePackage(packages, vehicle, 12),
    })

    return {
      car: packages.length ? createGroup('car') : EMPTY_GROUP,
      bike: packages.length ? createGroup('bike') : EMPTY_GROUP,
    }
  }, [packages])

  const vehicle: VehicleFilter = isMotorbike ? 'bike' : 'car'
  const current = packageGroups[vehicle]

  return (
    <section id="subscriptions" className="plans-section">
      <div className="section-inner">
        <div className="section-heading">
          <h2>Gói đăng ký thành viên</h2>
          <p>
            Tiết kiệm hơn với các gói đăng ký theo tháng, dành cho cư dân và
            nhân viên làm việc tại tòa nhà.
          </p>
        </div>

        <div className="pricing-toggle">
          <span>Ô tô</span>
          <button
            type="button"
            onClick={() => setIsMotorbike(!isMotorbike)}
            className={isMotorbike ? 'active' : ''}
            aria-label="Đổi bảng giá theo loại xe"
          >
            <span />
          </button>
          <span>Xe máy</span>
        </div>

        <div className="plans-grid">
          <PlanCard
            tag="Linh hoạt"
            title="1 Tháng"
            description="Phù hợp cho khách vãng lai thường xuyên"
            pkg={current.m1}
            vehicle={vehicle}
            features={['Truy cập 24/7 không giới hạn', 'Nhận diện biển số tự động']}
            disabledFeature="Vị trí đỗ cố định"
          />

          <PlanCard
            tag="Tiết kiệm"
            title="3 Tháng"
            description="Lựa chọn tối ưu cho cư dân"
            pkg={current.m3}
            vehicle={vehicle}
            features={[
              'Ưu tiên vị trí đỗ thuận tiện',
              'Miễn phí sạc xe điện 5h/tuần',
              'Giảm 10% phí rửa xe tại hầm',
            ]}
            popular
          />

          <PlanCard
            tag="Cao cấp"
            title="12 Tháng"
            description="Cam kết dài hạn, ưu đãi tối đa"
            pkg={current.m12}
            vehicle={vehicle}
            features={[
              'Vị trí đỗ riêng biệt, cố định',
              'Miễn phí rửa xe hằng tháng',
              'Hỗ trợ kỹ thuật tận nơi',
            ]}
          />
        </div>
      </div>
    </section>
  )
}

interface PlanCardProps {
  tag: string
  title: string
  description: string
  pkg: SubscriptionPackageDto | null
  vehicle: VehicleFilter
  features: string[]
  disabledFeature?: string
  popular?: boolean
}

function PlanCard({
  tag,
  title,
  description,
  pkg,
  vehicle,
  features,
  disabledFeature,
  popular,
}: PlanCardProps) {
  return (
    <article className={`plan-card ${popular ? 'plan-card--popular' : ''}`}>
      {popular && <div className="popular-badge">Phổ biến nhất</div>}

      <span className="plan-tag">{tag}</span>
      <h3>{title}</h3>
      <p>{description}</p>

      <div className="plan-price">
        <strong>{pkg ? formatCurrency(pkg.price) : 'Đang cập nhật'}</strong>
      </div>

      <ul className="plan-features">
        {features.map((feature) => (
          <li key={feature}>
            <CheckCircle size={19} strokeWidth={2.4} aria-hidden />
            {feature}
          </li>
        ))}
        {disabledFeature && (
          <li className="muted-feature">
            <XCircle size={19} strokeWidth={2.2} aria-hidden />
            {disabledFeature}
          </li>
        )}
      </ul>

      <Link
        to={pkg
          ? `/dang-ky-thang?package=${encodeURIComponent(pkg.packageId)}&vehicle=${vehicle}`
          : '/dang-ky-thang'}
        className={popular ? 'btn btn-primary btn-block' : 'btn btn-plan btn-block'}
        aria-disabled={!pkg}
      >
        {popular ? 'Chọn gói này' : 'Đăng ký ngay'}
      </Link>
    </article>
  )
}
