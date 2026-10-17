import { Camera, Clock, DollarSign, Layers } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiClient, API_CONFIG } from "../config/api";
import type { ApiResponse } from "../utils/apiServices";
import { useBooking } from "../context/BookingContext";
import { formatCurrency } from "../utils/pricing";

interface FloorDto {
  floorId: string;
  floorName: string;
  dedicatedVehicleTypeName?: string | null;
  totalCapacity?: number;
  isResident?: boolean;
}

export default function Features() {
  const { getPolicy, pricingLoading } = useBooking();
  const carPolicy = getPolicy("car");
  const bikePolicy = getPolicy("bike");
  const [floors, setFloors] = useState<FloorDto[]>([]);
  const [loadingFloors, setLoadingFloors] = useState(true);

  useEffect(() => {
    let ignore = false;
    const loadFloors = async () => {
      try {
        const res = await apiClient.get<ApiResponse<FloorDto[]>>("/Floor");
        if (!ignore && res?.isSuccess && Array.isArray(res.result)) {
          setFloors(res.result);
        }
      } catch {
        try {
          const req = await fetch(`${API_CONFIG.BASE_URL}/Floor`, {
            headers: { Accept: "application/json" },
          });
          if (req.ok) {
            const res = (await req.json()) as ApiResponse<FloorDto[]>;
            if (!ignore && res.isSuccess && Array.isArray(res.result)) {
              setFloors(res.result);
            }
          }
        } catch (err) {
          console.error("Không thể lấy danh sách tầng:", err);
        }
      } finally {
        if (!ignore) setLoadingFloors(false);
      }
    };

    void loadFloors();
    return () => {
      ignore = true;
    };
  }, []);

  return (
    <section className="features-section">
      <div className="section-inner">
        <div className="section-heading">
          <h2>Tại sao chọn chúng tôi?</h2>
        </div>

        <div className="features-grid">
          {/* Card 1: An ninh tuyệt đối */}
          <article className="feature-card feature-card--hero">
            <div>
              <Camera size={32} strokeWidth={2.2} aria-hidden />
              <h3>An ninh tuyệt đối</h3>
              <p>
                Hệ thống camera AI giám sát 24/7 cùng đội ngũ vận hành chuyên
                nghiệp tại tòa nhà 01 Lưu Hữu Phước.
              </p>
            </div>
          </article>

          {/* Card 2: Giờ hoạt động */}
          <article className="feature-card feature-card--accent">
            <div>
              <span className="feature-icon feature-icon--sm">
                <Clock size={22} strokeWidth={2.2} aria-hidden />
              </span>
              <h3>Giờ hoạt động</h3>
              <div className="feature-big-badge">24/7</div>
            </div>
            <p className="feature-subtext">
              Bãi xe hoạt động liên tục, tất cả các ngày trong tuần.
            </p>
          </article>

          {/* Card 3: Chính sách giá */}
          <article className="feature-card feature-card--pricing">
            <div>
              <span className="feature-icon feature-icon--sm">
                <DollarSign size={22} strokeWidth={2.2} aria-hidden />
              </span>
              <h3>Chính sách giá</h3>
              <div className="feature-price-rows">
                {pricingLoading ? (
                  <p className="feature-subtext">Đang tải bảng giá...</p>
                ) : (
                  <>
                    <div className="price-row">
                      <span>Ô tô:</span> <strong>{carPolicy ? `${formatCurrency(carPolicy.basePrice)}/${carPolicy.baseHours} giờ đầu` : "Chưa có giá"}</strong>
                    </div>
                    <div className="price-row">
                      <span>Xe máy:</span> <strong>{bikePolicy ? `${formatCurrency(bikePolicy.basePrice)}/${bikePolicy.baseHours} giờ đầu` : "Chưa có giá"}</strong>
                    </div>
                  </>
                )}
              </div>
            </div>
            <Link to="/legal#pricing-policy" className="feature-link">
              Xem thêm chi tiết &rarr;
            </Link>
          </article>

          {/* Card 4: Tầng chỗ đỗ */}
          <article className="feature-card feature-card--warm feature-card--floors">
            <div>
              <span className="feature-icon feature-icon--sm">
                <Layers size={22} strokeWidth={2.2} aria-hidden />
              </span>
              <h3>Tầng chỗ đỗ</h3>
              {loadingFloors ? (
                <p className="feature-subtext">Đang tải danh sách tầng...</p>
              ) : (
                <>
                  <div className="feature-big-badge">{floors.length} tầng</div>
                  <div className="feature-floor-tags">
                    {floors.map((floor) => {
                      const vehicle = floor.dedicatedVehicleTypeName;
                      return (
                        <span key={floor.floorId} className="floor-tag">
                          {floor.floorName}
                          {vehicle ? ` (${vehicle})` : ""}
                        </span>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}
