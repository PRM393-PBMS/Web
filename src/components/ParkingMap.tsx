import { ArrowDown, MapPin, MousePointerClick } from 'lucide-react'
import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import type { ParkingFloor, ParkingSpot, SpotStatus } from '../types/parking'
import { spotLabel as formatSpotLabel } from '../data/parkingLayoutConfig'

interface ParkingMapProps {
  floors: ParkingFloor[]
  onSelect?: (spot: ParkingSpot, floor: ParkingFloor) => void
}

const STATUS_LABEL: Record<SpotStatus, string> = {
  available: 'Trống',
  occupied: 'Đã có xe',
  assigned: 'Đã phân bổ',
  selected: 'Đang chọn',
  disabled: 'Không dùng',
}

export default function ParkingMap({ floors, onSelect }: ParkingMapProps) {
  const [activeFloorId, setActiveFloorId] = useState(floors[0]?.id ?? 1)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const floor = floors.find((f) => f.id === activeFloorId) ?? floors[0]

  const selectedSpot = useMemo(() => {
    if (!selectedId || !floor) return null
    return floor.spots.find((s) => s.id === selectedId) ?? null
  }, [selectedId, floor])

  useEffect(() => {
    if (!floors.some((f) => f.id === activeFloorId)) {
      setActiveFloorId(floors[0]?.id ?? 1)
      setSelectedId(null)
    }
  }, [floors, activeFloorId])

  const selectSpot = (spot: ParkingSpot) => {
    if (spot.status === 'occupied' || spot.status === 'assigned' || spot.status === 'disabled') {
      return
    }
    setSelectedId(spot.id)
    if (floor) onSelect?.(spot, floor)
  }

  const getDisplayStatus = (spot: ParkingSpot): SpotStatus =>
    selectedId === spot.id ? 'selected' : spot.status

  if (!floor) return null

  return (
    <section className="parking-map" aria-label="Sơ đồ chọn chỗ đỗ">
      <div className="map-toolbar">
        <div className="floor-tabs" role="tablist">
          {floors.map((f) => (
            <button
              key={f.id}
              type="button"
              role="tab"
              aria-selected={f.id === activeFloorId}
              className={`floor-tab${f.id === activeFloorId ? ' active' : ''}`}
              onClick={() => {
                setActiveFloorId(f.id)
                setSelectedId(null)
              }}
            >
              {f.name}
            </button>
          ))}
        </div>
        <ul className="map-legend">
          <li><span className="dot available" /> Trống</li>
          <li><span className="dot selected" /> Đang chọn</li>
          <li><span className="dot assigned" /> Đã phân bổ</li>
          <li><span className="dot occupied" /> Có xe</li>
        </ul>
      </div>

      <aside className="map-sidebar">
        <h3>Chỗ đã chọn</h3>
        {!selectedSpot ? (
          <p className="muted">
            <MousePointerClick size={16} strokeWidth={2} aria-hidden />
            Nhấn ô trống trên sơ đồ bên phải để chọn chỗ đỗ.
          </p>
        ) : (
          <div className="selected-spot-card">
            <MapPin size={18} strokeWidth={2.2} aria-hidden />
            <div>
              <strong>{floor.name}</strong>
              <span>Vị trí {formatSpotLabel(selectedSpot.row, selectedSpot.number)}</span>
            </div>
          </div>
        )}
      </aside>

      <div className="map-stage">
        <div className="map-entrance" aria-hidden="true">
          <ArrowDown size={16} strokeWidth={2} />
          <span>Lối vào / Thang máy</span>
        </div>
        <div
          className="map-grid-wrap"
          style={{ '--map-cols': String(floor.cols) } as CSSProperties}
        >
          <div className="map-col-labels" aria-hidden="true">
            <span className="map-corner" />
            {Array.from({ length: floor.cols }, (_, i) => (
              <span key={i}>{i + 1}</span>
            ))}
            <span className="map-corner" />
          </div>
          <div className="map-grid">
            {floor.rows.map((row) => (
              <div key={row} className="map-row">
                <span className="row-label">{row}</span>
                <div className="row-spots">
                  {floor.spots
                    .filter((s) => s.row === row)
                    .map((spot) => {
                      const status = getDisplayStatus(spot)
                      const clickable = status === 'available' || status === 'selected'
                      const label = formatSpotLabel(spot.row, spot.number)
                      return (
                        <button
                          key={spot.id}
                          type="button"
                          className={`spot spot--${status}`}
                          disabled={!clickable}
                          aria-label={`${label} — ${STATUS_LABEL[status]}`}
                          aria-pressed={status === 'selected'}
                          onClick={() => selectSpot(spot)}
                        >
                          <span className="spot-label">{label}</span>
                        </button>
                      )
                    })}
                </div>
                <span className="row-label">{row}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
