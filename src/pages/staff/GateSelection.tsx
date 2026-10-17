import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowRight,
  Building2,
  CarFront,
  Check,
  DoorOpen,
  LogIn,
  LogOut,
  Users,
} from 'lucide-react'
import StaffPageShell from '../../components/StaffPageShell'
import {
  floorApi,
  gateApi,
  type FloorDto,
  type GateDto,
} from '../../utils/apiServices'
import {
  isCarVehicleTypeName,
  saveStaffGateContext,
  type StaffGateOperation,
} from '../../utils/staffGateContext'

export default function StaffGateSelection() {
  const navigate = useNavigate()
  const location = useLocation()
  const initialState = location.state as {
    activePanel?: 'scan' | 'reservations' | 'active-vehicles'
    sessionId?: string
    reservationId?: string
    licensePlate?: string
    qrPayload?: string
    checkInType?: 'reservation'
    gateAccessGranted?: boolean
  } | null
  const destination = new URLSearchParams(location.search).get('destination')
  const { operation: operationParam } = useParams()
  const operation: StaffGateOperation = operationParam === 'checkout' ? 'checkout' : 'checkin'
  const expectedGateType = operation === 'checkin' ? 'Entry' : 'Exit'
  const [floors, setFloors] = useState<FloorDto[]>([])
  const [gates, setGates] = useState<GateDto[]>([])
  const [floorId, setFloorId] = useState('')
  const [gateId, setGateId] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    queueMicrotask(() => {
      setLoading(true)
      setError('')
      Promise.all([floorApi.getAll(), gateApi.getAll()])
        .then(([floorResponse, gateResponse]) => {
          const nextFloors = floorResponse.isSuccess ? floorResponse.result ?? [] : []
          const nextGates = gateResponse.isSuccess
            ? (gateResponse.result ?? []).filter(
                (gate) => gate.gateType?.toLowerCase() === expectedGateType.toLowerCase(),
              )
            : []
          setFloors(nextFloors)
          setGates(nextGates)
          if (nextFloors.length === 0) setError('Chưa có tầng nào được cấu hình.')
        })
        .catch((requestError) => {
          console.error(requestError)
          setError('Không thể tải cấu hình tầng và cổng. Vui lòng thử lại.')
        })
        .finally(() => setLoading(false))
    })
  }, [expectedGateType])

  const selectedFloor = floors.find((floor) => floor.floorId === floorId)
  const availableGates = useMemo(
    () => gates.filter((gate) => gate.floorId === floorId),
    [floorId, gates],
  )
  const selectedGate = availableGates.find((gate) => gate.gateId === gateId)

  const selectFloor = (nextFloorId: string) => {
    setFloorId(nextFloorId)
    setGateId('')
  }

  const continueToOperation = () => {
    if (!selectedFloor || !selectedGate) return
    saveStaffGateContext({
      operation,
      floorId: selectedFloor.floorId,
      floorName: selectedFloor.floorName,
      isResident: selectedFloor.isResident,
      dedicatedVehicleTypeId: selectedFloor.dedicatedVehicleTypeId ?? undefined,
      dedicatedVehicleTypeName: selectedFloor.dedicatedVehicleTypeName ?? undefined,
      gateId: selectedGate.gateId,
      gateName: selectedGate.gateName,
      gateType: expectedGateType,
    })
    const checkInDestination =
      destination === 'reservations'
        ? '/staff/reservations'
        : destination === 'active-vehicles'
          ? '/staff/active-vehicles'
          : '/staff/scan-plate'
    navigate(operation === 'checkin' ? checkInDestination : '/staff/checkout', {
      state: { ...(initialState ?? {}), gateAccessGranted: true },
    })
  }

  return (
    <StaffPageShell activeItem={operation === 'checkin' ? 'scan' : 'checkout'}>
      <div className="staff-content-wrapper staff-manager-page manager-resource-page staff-gate-selector">
        <header className="manager-resource-header">
          <div className="manager-resource-title">
            <span className={`manager-resource-icon ${operation === 'checkin' ? 'manager-resource-icon--green' : 'manager-resource-icon--orange'}`}>
              {operation === 'checkin' ? <LogIn size={24} aria-hidden /> : <LogOut size={24} aria-hidden />}
            </span>
            <div>
              <h2>Chọn vị trí {operation === 'checkin' ? 'check-in' : 'check-out'}</h2>
              <p>Chọn đúng tầng trước, sau đó chọn cổng thuộc tầng để bắt đầu nghiệp vụ.</p>
            </div>
          </div>
        </header>

        <div className="staff-gate-steps" aria-label="Các bước chọn vị trí">
          <span className={floorId ? 'done' : 'active'}><b>{floorId ? <Check size={15} /> : '1'}</b> Chọn tầng</span>
          <i />
          <span className={gateId ? 'done' : floorId ? 'active' : ''}><b>{gateId ? <Check size={15} /> : '2'}</b> Chọn cổng</span>
          <i />
          <span className={gateId ? 'active' : ''}><b>3</b> Vào Check-in/Check-out</span>
        </div>

        {error && <div className="manager-inline-error" role="alert">{error}</div>}

        <section className="card-panel staff-gate-selection-panel">
          <div className="scan-card-heading">
            <span className="scan-step-badge">1</span>
            <div><h3>Chọn tầng vận hành</h3><p>Nhóm khách và loại xe được lấy từ cấu hình của tầng.</p></div>
          </div>
          {loading ? (
            <div className="manager-empty-state">Đang tải cấu hình...</div>
          ) : (
            <div className="staff-floor-choice-grid">
              {floors.map((floor) => {
                const gateCount = gates.filter((gate) => gate.floorId === floor.floorId).length
                const selected = floor.floorId === floorId
                const allowsReservation =
                  !floor.isResident &&
                  isCarVehicleTypeName(floor.dedicatedVehicleTypeName)
                return (
                  <button
                    key={floor.floorId}
                    type="button"
                    className={`staff-floor-choice ${selected ? 'selected' : ''}`}
                    onClick={() => selectFloor(floor.floorId)}
                  >
                    <span className={`manager-floor-symbol ${floor.isResident ? 'resident' : ''}`}><Building2 size={22} /></span>
                    <span>
                      <strong>{floor.floorName}</strong>
                      <small><Users size={14} /> {floor.isResident ? 'Cư dân / khách tháng' : allowsReservation ? 'Khách vãng lai / đặt trước' : 'Khách vãng lai'}</small>
                      <small><CarFront size={14} /> {floor.dedicatedVehicleTypeName || 'Dùng chung nhiều loại xe'}</small>
                      <small><DoorOpen size={14} /> {gateCount} cổng {operation === 'checkin' ? 'vào' : 'ra'}</small>
                    </span>
                    {selected && <Check className="staff-choice-check" size={18} />}
                  </button>
                )
              })}
            </div>
          )}
        </section>

        <section className={`card-panel staff-gate-selection-panel ${!floorId ? 'disabled' : ''}`}>
          <div className="scan-card-heading">
            <span className="scan-step-badge">2</span>
            <div><h3>Chọn cổng {operation === 'checkin' ? 'vào' : 'ra'}</h3><p>Chỉ hiển thị cổng đúng loại và thuộc tầng đã chọn.</p></div>
          </div>
          {!floorId ? (
            <div className="manager-empty-state">Chọn một tầng để xem danh sách cổng.</div>
          ) : availableGates.length === 0 ? (
            <div className="manager-empty-state">Tầng này chưa có cổng {operation === 'checkin' ? 'vào' : 'ra'}.</div>
          ) : (
            <div className="staff-gate-choice-grid">
              {availableGates.map((gate) => (
                <button
                  key={gate.gateId}
                  type="button"
                  className={`staff-gate-choice ${gate.gateId === gateId ? 'selected' : ''}`}
                  onClick={() => setGateId(gate.gateId)}
                >
                  <DoorOpen size={22} />
                  <span><strong>{gate.gateName}</strong><small>{selectedFloor?.floorName} · Cổng {operation === 'checkin' ? 'vào' : 'ra'}</small></span>
                  {gate.gateId === gateId && <Check className="staff-choice-check" size={18} />}
                </button>
              ))}
            </div>
          )}
        </section>

        <div className="staff-gate-selector-footer">
          <div>
            {selectedFloor && selectedGate ? (
              <><strong>{selectedFloor.floorName} · {selectedGate.gateName}</strong><span>{selectedFloor.isResident ? 'Cư dân' : isCarVehicleTypeName(selectedFloor.dedicatedVehicleTypeName) ? 'Khách / đặt trước' : 'Khách vãng lai'} · {selectedFloor.dedicatedVehicleTypeName || 'Nhiều loại xe'}</span></>
            ) : <span>Hãy hoàn tất 2 bước để tiếp tục.</span>}
          </div>
          <button type="button" className="btn btn-primary" disabled={!selectedFloor || !selectedGate} onClick={continueToOperation}>
            Vào trang {operation === 'checkin' ? 'check-in' : 'check-out'} <ArrowRight size={17} />
          </button>
        </div>
      </div>
    </StaffPageShell>
  )
}
