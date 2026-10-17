import { useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import AdminPageShell from '../../components/AdminPageShell'
import { apiClient } from '../../config/api'

interface Floor {
  floorId: string
  floorName: string
  totalCapacity: number
  capacity?: number
  isResident?: boolean
  dedicatedVehicleTypeId?: string | null
}

interface Gate {
  gateId: string
  gateName: string
  gateType: string
  floorId: string
  floorName?: string
  location?: string
  status?: string
}

interface VehicleType {
  vehicleTypeId: string
  typeName: string
  dimensions: string
  basePrice?: number
}

interface SubscriptionPackage {
  packageId: string
  packageName: string
  vehicleTypeId: string
  vehicleTypeName?: string
  durationMonths: number
  duration?: number
  price: number
  requireFixedSlot?: boolean
  description?: string
  status: string
}

interface ApiResponse<T> {
  isSuccess: boolean
  result: T
  message?: string
}

const isMotorbike = (typeName?: string) => {
  const normalized = (typeName ?? '').toLowerCase()
  return normalized.includes('motor') || normalized.includes('bike') || normalized.includes('xe máy') || normalized.includes('xe may')
}

export default function AdminSystemConfig() {
  const [activeTab, setActiveTab] = useState(1)

  // Shared/cached lists for modals
  const [floors, setFloors] = useState<Floor[]>([])
  const [vehicleTypes, setVehicleTypes] = useState<VehicleType[]>([])

  // Tab-specific loading, error & list states
  const [floorsLoading, setFloorsLoading] = useState(false)
  const [floorsError, setFloorsError] = useState<string | null>(null)

  const [gates, setGates] = useState<Gate[]>([])
  const [gatesLoading, setGatesLoading] = useState(false)
  const [gatesError, setGatesError] = useState<string | null>(null)

  const [vehicleTypesLoading, setVehicleTypesLoading] = useState(false)
  const [vehicleTypesError, setVehicleTypesError] = useState<string | null>(null)

  const [packages, setPackages] = useState<SubscriptionPackage[]>([])
  const [packagesLoading, setPackagesLoading] = useState(false)
  const [packagesError, setPackagesError] = useState<string | null>(null)

  // Modal display and loading state
  const [showModal, setShowModal] = useState<'floor' | 'gate' | 'vehicleType' | 'package' | null>(null)
  const [saving, setSaving] = useState(false)

  // Selected edit items
  const [editFloor, setEditFloor] = useState<Floor | null>(null)
  const [editGate, setEditGate] = useState<Gate | null>(null)
  const [editVehicleType, setEditVehicleType] = useState<VehicleType | null>(null)
  const [editPackage, setEditPackage] = useState<SubscriptionPackage | null>(null)

  // Form states
  const [floorForm, setFloorForm] = useState({ floorName: '', capacity: '' })
  const [gateForm, setGateForm] = useState({ gateName: '', gateType: 'Entry', floorId: '' })
  const [vehicleTypeForm, setVehicleTypeForm] = useState({ typeName: '', dimensions: '', basePrice: '' })
  const [packageForm, setPackageForm] = useState({
    packageName: '',
    price: '',
    durationMonths: '',
    description: '',
    vehicleTypeId: '',
    requireFixedSlot: false,
    status: 'Active',
  })
  const selectedPackageVehicleType = vehicleTypes.find(
    (item) => item.vehicleTypeId === packageForm.vehicleTypeId,
  )
  const selectedPackageIsMotorbike = isMotorbike(selectedPackageVehicleType?.typeName)

  // Fetch logic
  const fetchFloors = async () => {
    setFloorsLoading(true)
    setFloorsError(null)
    try {
      const res = await apiClient.get<ApiResponse<Floor[]>>('/Floor')
      if (res.isSuccess) {
        setFloors(res.result)
      } else {
        setFloorsError(res.message || 'Không thể tải dữ liệu. Vui lòng thử lại.')
      }
    } catch (err) {
      console.error(err)
      setFloorsError('Không thể tải dữ liệu. Vui lòng thử lại.')
    } finally {
      setFloorsLoading(false)
    }
  }

  const fetchGates = async () => {
    setGatesLoading(true)
    setGatesError(null)
    try {
      const res = await apiClient.get<ApiResponse<Gate[]>>('/Gate')
      if (res.isSuccess) {
        setGates(res.result)
      } else {
        setGatesError(res.message || 'Không thể tải dữ liệu. Vui lòng thử lại.')
      }
    } catch (err) {
      console.error(err)
      setGatesError('Không thể tải dữ liệu. Vui lòng thử lại.')
    } finally {
      setGatesLoading(false)
    }
  }

  const fetchVehicleTypes = async () => {
    setVehicleTypesLoading(true)
    setVehicleTypesError(null)
    try {
      const res = await apiClient.get<ApiResponse<VehicleType[]>>('/VehicleType')
      if (res.isSuccess) {
        setVehicleTypes(res.result)
      } else {
        setVehicleTypesError(res.message || 'Không thể tải dữ liệu. Vui lòng thử lại.')
      }
    } catch (err) {
      console.error(err)
      setVehicleTypesError('Không thể tải dữ liệu. Vui lòng thử lại.')
    } finally {
      setVehicleTypesLoading(false)
    }
  }

  const fetchPackages = async () => {
    setPackagesLoading(true)
    setPackagesError(null)
    try {
      const res = await apiClient.get<ApiResponse<SubscriptionPackage[]>>('/SubscriptionPackage')
      if (res.isSuccess) {
        setPackages(res.result)
      } else {
        setPackagesError(res.message || 'Không thể tải dữ liệu. Vui lòng thử lại.')
      }
    } catch (err) {
      console.error(err)
      setPackagesError('Không thể tải dữ liệu. Vui lòng thử lại.')
    } finally {
      setPackagesLoading(false)
    }
  }

  // Load data based on active tab
  useEffect(() => {
    if (activeTab === 2) {
      fetchFloors()
    } else if (activeTab === 3) {
      fetchGates()
      fetchFloors() // Populates gate placement selection
    } else if (activeTab === 4) {
      fetchVehicleTypes()
    } else if (activeTab === 5) {
      fetchPackages()
      fetchVehicleTypes() // Populates vehicle type package selection
    }
  }, [activeTab])

  // Modals operations
  const closeModal = () => {
    setShowModal(null)
    setEditFloor(null)
    setEditGate(null)
    setEditVehicleType(null)
    setEditPackage(null)
  }

  // Floor CRUD handlers
  const openCreateFloor = () => {
    setEditFloor(null)
    setFloorForm({ floorName: '', capacity: '' })
    setShowModal('floor')
  }

  const openEditFloor = (f: Floor) => {
    setEditFloor(f)
    setFloorForm({
      floorName: f.floorName,
      capacity: String(f.totalCapacity !== undefined ? f.totalCapacity : f.capacity || 0),
    })
    setShowModal('floor')
  }

  const handleSaveFloor = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const payload = {
        floorName: floorForm.floorName.trim(),
        totalCapacity: Number(floorForm.capacity),
        isResident: editFloor?.isResident ?? false,
        dedicatedVehicleTypeId: editFloor?.dedicatedVehicleTypeId ?? null,
      }
      if (editFloor) {
        const res = await apiClient.put<ApiResponse<unknown>>('/Floor', {
          floorId: editFloor.floorId,
          ...payload,
        })
        if (!res.isSuccess) throw new Error(res.message || 'Lỗi lưu thông tin')
      } else {
        const res = await apiClient.post<ApiResponse<unknown>>('/Floor', payload)
        if (!res.isSuccess) throw new Error(res.message || 'Lỗi tạo thông tin')
      }
      closeModal()
      fetchFloors()
    } catch (err: any) {
      console.error(err)
      const errMsg = String(err?.message || err)
      if (errMsg.includes('404') || errMsg.includes('405')) {
        alert('Tính năng đang phát triển.')
      } else {
        alert('Không thể tải dữ liệu. Vui lòng thử lại.')
      }
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteFloor = async (id: string, name: string) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa tầng "${name}"?`)) return
    try {
      await apiClient.delete<ApiResponse<unknown>>(`/Floor/${id}`)
      fetchFloors()
    } catch (err: any) {
      console.error(err)
      const errMsg = String(err?.message || err)
      if (errMsg.includes('404') || errMsg.includes('405')) {
        alert('Tính năng đang phát triển.')
      } else {
        alert('Không thể tải dữ liệu. Vui lòng thử lại.')
      }
    }
  }

  // Gate CRUD handlers
  const openCreateGate = () => {
    setEditGate(null)
    setGateForm({
      gateName: '',
      gateType: 'Entry',
      floorId: floors[0]?.floorId || '',
    })
    setShowModal('gate')
  }

  const openEditGate = (g: Gate) => {
    setEditGate(g)
    setGateForm({
      gateName: g.gateName,
      gateType: g.gateType || g.status || 'Entry',
      floorId: g.floorId,
    })
    setShowModal('gate')
  }

  const handleSaveGate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!gateForm.floorId) {
      alert('Vui lòng chọn tầng (Vị trí).')
      return
    }
    setSaving(true)
    try {
      const payload = {
        gateName: gateForm.gateName.trim(),
        gateType: gateForm.gateType,
        floorId: gateForm.floorId,
      }
      if (editGate) {
        const res = await apiClient.put<ApiResponse<unknown>>('/Gate', {
          gateId: editGate.gateId,
          ...payload,
        })
        if (!res.isSuccess) throw new Error(res.message || 'Lỗi lưu thông tin')
      } else {
        const res = await apiClient.post<ApiResponse<unknown>>('/Gate', payload)
        if (!res.isSuccess) throw new Error(res.message || 'Lỗi tạo thông tin')
      }
      closeModal()
      fetchGates()
    } catch (err: any) {
      console.error(err)
      const errMsg = String(err?.message || err)
      if (errMsg.includes('404') || errMsg.includes('405')) {
        alert('Tính năng đang phát triển.')
      } else {
        alert('Không thể tải dữ liệu. Vui lòng thử lại.')
      }
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteGate = async (id: string, name: string) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa cổng "${name}"?`)) return
    try {
      await apiClient.delete<ApiResponse<unknown>>(`/Gate/${id}`)
      fetchGates()
    } catch (err: any) {
      console.error(err)
      const errMsg = String(err?.message || err)
      if (errMsg.includes('404') || errMsg.includes('405')) {
        alert('Tính năng đang phát triển.')
      } else {
        alert('Không thể tải dữ liệu. Vui lòng thử lại.')
      }
    }
  }

  // VehicleType CRUD handlers
  const openCreateVehicleType = () => {
    setEditVehicleType(null)
    setVehicleTypeForm({ typeName: '', dimensions: '', basePrice: '' })
    setShowModal('vehicleType')
  }

  const openEditVehicleType = (vt: VehicleType) => {
    setEditVehicleType(vt)
    setVehicleTypeForm({
      typeName: vt.typeName,
      dimensions: vt.dimensions,
      basePrice: String(vt.basePrice || ''),
    })
    setShowModal('vehicleType')
  }

  const handleSaveVehicleType = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const payload = {
        typeName: vehicleTypeForm.typeName.trim(),
        dimensions: vehicleTypeForm.dimensions.trim(),
        basePrice: vehicleTypeForm.basePrice ? Number(vehicleTypeForm.basePrice) : undefined,
      }
      if (editVehicleType) {
        const res = await apiClient.put<ApiResponse<unknown>>('/VehicleType', {
          vehicleTypeId: editVehicleType.vehicleTypeId,
          ...payload,
        })
        if (!res.isSuccess) throw new Error(res.message || 'Lỗi lưu thông tin')
      } else {
        const res = await apiClient.post<ApiResponse<unknown>>('/VehicleType', payload)
        if (!res.isSuccess) throw new Error(res.message || 'Lỗi tạo thông tin')
      }
      closeModal()
      fetchVehicleTypes()
    } catch (err: any) {
      console.error(err)
      const errMsg = String(err?.message || err)
      if (errMsg.includes('404') || errMsg.includes('405')) {
        alert('Tính năng đang phát triển.')
      } else {
        alert('Không thể tải dữ liệu. Vui lòng thử lại.')
      }
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteVehicleType = async (id: string, name: string) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa loại xe "${name}"?`)) return
    try {
      await apiClient.delete<ApiResponse<unknown>>(`/VehicleType/${id}`)
      fetchVehicleTypes()
    } catch (err: any) {
      console.error(err)
      const errMsg = String(err?.message || err)
      if (errMsg.includes('404') || errMsg.includes('405')) {
        alert('Tính năng đang phát triển.')
      } else {
        alert('Không thể tải dữ liệu. Vui lòng thử lại.')
      }
    }
  }

  // SubscriptionPackage CRUD handlers
  const openCreatePackage = () => {
    setEditPackage(null)
    setPackageForm({
      packageName: '',
      price: '',
      durationMonths: '',
      description: '',
      vehicleTypeId: vehicleTypes[0]?.vehicleTypeId || '',
      requireFixedSlot: false,
      status: 'Active',
    })
    setShowModal('package')
  }

  const openEditPackage = (p: SubscriptionPackage) => {
    setEditPackage(p)
    setPackageForm({
      packageName: p.packageName,
      price: String(p.price),
      durationMonths: String(p.durationMonths !== undefined ? p.durationMonths : p.duration || 0),
      description: p.description || '',
      vehicleTypeId: p.vehicleTypeId,
      requireFixedSlot: p.requireFixedSlot ?? false,
      status: p.status || 'Active',
    })
    setShowModal('package')
  }

  const handleSavePackage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!packageForm.vehicleTypeId) {
      alert('Vui lòng chọn loại xe.')
      return
    }
    setSaving(true)
    try {
      const payload = {
        packageName: packageForm.packageName.trim(),
        price: Number(packageForm.price),
        durationMonths: Number(packageForm.durationMonths),
        description: packageForm.description.trim(),
        vehicleTypeId: packageForm.vehicleTypeId,
        requireFixedSlot: packageForm.requireFixedSlot,
        status: packageForm.status,
      }
      if (editPackage) {
        const res = await apiClient.put<ApiResponse<unknown>>(
          `/SubscriptionPackage/${editPackage.packageId}`,
          payload
        )
        if (!res.isSuccess) throw new Error(res.message || 'Lỗi lưu thông tin')
      } else {
        const res = await apiClient.post<ApiResponse<unknown>>('/SubscriptionPackage', payload)
        if (!res.isSuccess) throw new Error(res.message || 'Lỗi tạo thông tin')
      }
      closeModal()
      fetchPackages()
    } catch (err: any) {
      console.error(err)
      const errMsg = String(err?.message || err)
      if (errMsg.includes('404') || errMsg.includes('405')) {
        alert('Tính năng đang phát triển.')
      } else {
        alert('Không thể tải dữ liệu. Vui lòng thử lại.')
      }
    } finally {
      setSaving(false)
    }
  }

  const handleDeletePackage = async (id: string, name: string) => {
    if (!window.confirm(`Bạn có chắc chắn muốn ngừng bán gói thuê bao "${name}"?`)) return
    try {
      await apiClient.delete<ApiResponse<unknown>>(`/SubscriptionPackage/${id}`)
      fetchPackages()
    } catch (err: any) {
      console.error(err)
      const errMsg = String(err?.message || err)
      if (errMsg.includes('404') || errMsg.includes('405')) {
        alert('Tính năng đang phát triển.')
      } else {
        alert('Không thể tải dữ liệu. Vui lòng thử lại.')
      }
    }
  }

  return (
    <AdminPageShell activeItem="system">
      <div className="staff-content-wrapper">
        <div className="staff-section">
          <h2>Quản lý cấu hình hệ thống</h2>
          <p className="section-desc">
            Thiết lập thông số vận hành, quản lý tầng hầm, cổng kiểm soát, loại xe và các gói cước thuê bao tháng.
          </p>

          {/* Navigation Tab Bar */}
          <div className="floor-tabs" style={{ marginBottom: '1.5rem' }}>
            <button
              type="button"
              className={`floor-tab ${activeTab === 1 ? 'active' : ''}`}
              onClick={() => setActiveTab(1)}
            >
              Cấu hình chung
            </button>
            <button
              type="button"
              className={`floor-tab ${activeTab === 2 ? 'active' : ''}`}
              onClick={() => setActiveTab(2)}
            >
              Quản lý tầng
            </button>
            <button
              type="button"
              className={`floor-tab ${activeTab === 3 ? 'active' : ''}`}
              onClick={() => setActiveTab(3)}
            >
              Quản lý cổng
            </button>
            <button
              type="button"
              className={`floor-tab ${activeTab === 4 ? 'active' : ''}`}
              onClick={() => setActiveTab(4)}
            >
              Quản lý loại xe
            </button>
            <button
              type="button"
              className={`floor-tab ${activeTab === 5 ? 'active' : ''}`}
              onClick={() => setActiveTab(5)}
            >
              Quản lý gói thuê bao
            </button>
          </div>

          {/* Tab 1: Cấu hình chung */}
          {activeTab === 1 && (
            <form className="config-form card-panel" onSubmit={(e) => e.preventDefault()}>
              <fieldset className="config-fieldset">
                <legend>Thông tin bãi</legend>
                <div className="form-field">
                  <label htmlFor="site-name">Tên hệ thống</label>
                  <input id="site-name" type="text" defaultValue="EasyParking" />
                </div>
                <div className="form-field">
                  <label htmlFor="timezone">Múi giờ</label>
                  <select id="timezone" defaultValue="asia-hcm">
                    <option value="asia-hcm">Asia/Ho_Chi_Minh (UTC+7)</option>
                  </select>
                </div>
              </fieldset>

              <fieldset className="config-fieldset">
                <legend>Thanh toán & thông báo</legend>
                <div className="form-field checkbox-row">
                  <input id="enable-momo" type="checkbox" defaultChecked />
                  <label htmlFor="enable-momo">Bật thanh toán MoMo</label>
                </div>
                <div className="form-field checkbox-row">
                  <input id="enable-email" type="checkbox" defaultChecked />
                  <label htmlFor="enable-email">Gửi email xác nhận đặt chỗ</label>
                </div>
                <div className="form-field checkbox-row">
                  <input id="enable-sms" type="checkbox" />
                  <label htmlFor="enable-sms">Gửi SMS nhắc hết giờ</label>
                </div>
              </fieldset>

              <fieldset className="config-fieldset">
                <legend>Bảo mật & sao lưu</legend>
                <div className="form-field">
                  <label htmlFor="session-timeout">Thời gian phiên (phút)</label>
                  <input id="session-timeout" type="number" min={15} defaultValue={60} />
                </div>
                <div className="form-field">
                  <label htmlFor="backup-schedule">Lịch sao lưu tự động</label>
                  <select id="backup-schedule" defaultValue="daily">
                    <option value="daily">Hàng ngày — 02:00</option>
                    <option value="weekly">Hàng tuần — Chủ nhật</option>
                  </select>
                </div>
              </fieldset>

              <div className="form-actions">
                <button type="button" className="btn btn-ghost">
                  Khôi phục mặc định
                </button>
                <button type="submit" className="btn btn-primary">
                  Lưu cấu hình
                </button>
              </div>
            </form>
          )}

          {/* List and toolbar container for active CRUD tabs */}
          {activeTab !== 1 && (
            <>
              <div
                className="toolbar-row card-panel"
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '1rem',
                  padding: '0.75rem 1.25rem',
                }}
              >
                <p style={{ margin: 0, color: 'var(--text-muted)' }}>
                  {activeTab === 2 && (floorsLoading ? 'Đang tải...' : `${floors.length} tầng đang hoạt động`)}
                  {activeTab === 3 && (gatesLoading ? 'Đang tải...' : `${gates.length} cổng đang hoạt động`)}
                  {activeTab === 4 && (vehicleTypesLoading ? 'Đang tải...' : `${vehicleTypes.length} loại xe đã hỗ trợ`)}
                  {activeTab === 5 && (packagesLoading ? 'Đang tải...' : `${packages.length} gói thuê bao hiện có`)}
                </p>
                {activeTab === 2 && (
                  <button type="button" className="btn btn-primary" onClick={openCreateFloor}>
                    <Plus size={16} style={{ marginRight: '0.25rem' }} />
                    Thêm tầng
                  </button>
                )}
                {activeTab === 3 && (
                  <button type="button" className="btn btn-primary" onClick={openCreateGate}>
                    <Plus size={16} style={{ marginRight: '0.25rem' }} />
                    Thêm cổng
                  </button>
                )}
                {activeTab === 4 && (
                  <button type="button" className="btn btn-primary" onClick={openCreateVehicleType}>
                    <Plus size={16} style={{ marginRight: '0.25rem' }} />
                    Thêm loại xe
                  </button>
                )}
                {activeTab === 5 && (
                  <button type="button" className="btn btn-primary" onClick={openCreatePackage}>
                    <Plus size={16} style={{ marginRight: '0.25rem' }} />
                    Thêm gói
                  </button>
                )}
              </div>

              {/* Tab 2: Quản lý tầng */}
              {activeTab === 2 && (
                <div className="card-panel">
                  {floorsLoading && <p style={{ color: 'var(--text-muted)' }}>Đang tải danh sách tầng...</p>}
                  {floorsError && <p style={{ color: 'var(--danger, #ef4444)' }}>{floorsError}</p>}
                  {!floorsLoading && !floorsError && (
                    <table className="ui-table">
                      <thead>
                        <tr>
                          <th>Tên tầng</th>
                          <th>Sức chứa (slot)</th>
                          <th style={{ width: '150px' }}>Thao tác</th>
                        </tr>
                      </thead>
                      <tbody>
                        {floors.length === 0 ? (
                          <tr>
                            <td colSpan={3} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                              Chưa có tầng hầm nào.
                            </td>
                          </tr>
                        ) : (
                          floors.map((f) => {
                            const cap = f.totalCapacity !== undefined ? f.totalCapacity : f.capacity || 0
                            return (
                              <tr key={f.floorId}>
                                <td>{f.floorName}</td>
                                <td>{cap}</td>
                                <td>
                                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <button
                                      type="button"
                                      className="btn btn-outline btn-sm"
                                      onClick={() => openEditFloor(f)}
                                    >
                                      Sửa
                                    </button>
                                    <button
                                      type="button"
                                      className="btn btn-outline btn-sm"
                                      style={{ borderColor: 'var(--danger, #ef4444)', color: 'var(--danger, #ef4444)' }}
                                      onClick={() => handleDeleteFloor(f.floorId, f.floorName)}
                                    >
                                      Xóa
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            )
                          })
                        )}
                      </tbody>
                    </table>
                  )}
                </div>
              )}

              {/* Tab 3: Quản lý cổng */}
              {activeTab === 3 && (
                <div className="card-panel">
                  {gatesLoading && <p style={{ color: 'var(--text-muted)' }}>Đang tải danh sách cổng...</p>}
                  {gatesError && <p style={{ color: 'var(--danger, #ef4444)' }}>{gatesError}</p>}
                  {!gatesLoading && !gatesError && (
                    <table className="ui-table">
                      <thead>
                        <tr>
                          <th>Tên cổng</th>
                          <th>Vị trí (Tầng)</th>
                          <th>Loại cổng / Trạng thái</th>
                          <th style={{ width: '150px' }}>Thao tác</th>
                        </tr>
                      </thead>
                      <tbody>
                        {gates.length === 0 ? (
                          <tr>
                            <td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                              Chưa có cổng nào được cấu hình.
                            </td>
                          </tr>
                        ) : (
                          gates.map((g) => {
                            const loc = g.floorName || g.location || '—'
                            const typeLabel =
                              g.gateType === 'Entry'
                                ? 'Cổng vào (Entry)'
                                : g.gateType === 'Exit'
                                ? 'Cổng ra (Exit)'
                                : g.gateType || g.status || '—'
                            return (
                              <tr key={g.gateId}>
                                <td>{g.gateName}</td>
                                <td>{loc}</td>
                                <td>{typeLabel}</td>
                                <td>
                                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <button
                                      type="button"
                                      className="btn btn-outline btn-sm"
                                      onClick={() => openEditGate(g)}
                                    >
                                      Sửa
                                    </button>
                                    <button
                                      type="button"
                                      className="btn btn-outline btn-sm"
                                      style={{ borderColor: 'var(--danger, #ef4444)', color: 'var(--danger, #ef4444)' }}
                                      onClick={() => handleDeleteGate(g.gateId, g.gateName)}
                                    >
                                      Xóa
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            )
                          })
                        )}
                      </tbody>
                    </table>
                  )}
                </div>
              )}

              {/* Tab 4: Quản lý loại xe */}
              {activeTab === 4 && (
                <div className="card-panel">
                  {vehicleTypesLoading && <p style={{ color: 'var(--text-muted)' }}>Đang tải danh sách loại xe...</p>}
                  {vehicleTypesError && <p style={{ color: 'var(--danger, #ef4444)' }}>{vehicleTypesError}</p>}
                  {!vehicleTypesLoading && !vehicleTypesError && (
                    <table className="ui-table">
                      <thead>
                        <tr>
                          <th>Tên loại</th>
                          <th>Kích thước</th>
                          <th>Giá cơ bản</th>
                          <th style={{ width: '150px' }}>Thao tác</th>
                        </tr>
                      </thead>
                      <tbody>
                        {vehicleTypes.length === 0 ? (
                          <tr>
                            <td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                              Chưa có loại xe nào.
                            </td>
                          </tr>
                        ) : (
                          vehicleTypes.map((vt) => {
                            const priceText =
                              vt.basePrice !== undefined ? `${vt.basePrice.toLocaleString('vi-VN')} VNĐ` : '—'
                            return (
                              <tr key={vt.vehicleTypeId}>
                                <td>{vt.typeName}</td>
                                <td>{vt.dimensions}</td>
                                <td>{priceText}</td>
                                <td>
                                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <button
                                      type="button"
                                      className="btn btn-outline btn-sm"
                                      onClick={() => openEditVehicleType(vt)}
                                    >
                                      Sửa
                                    </button>
                                    <button
                                      type="button"
                                      className="btn btn-outline btn-sm"
                                      style={{ borderColor: 'var(--danger, #ef4444)', color: 'var(--danger, #ef4444)' }}
                                      onClick={() => handleDeleteVehicleType(vt.vehicleTypeId, vt.typeName)}
                                    >
                                      Xóa
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            )
                          })
                        )}
                      </tbody>
                    </table>
                  )}
                </div>
              )}

              {/* Tab 5: Quản lý gói thuê bao */}
              {activeTab === 5 && (
                <div className="card-panel">
                  {packagesLoading && <p style={{ color: 'var(--text-muted)' }}>Đang tải danh sách gói...</p>}
                  {packagesError && <p style={{ color: 'var(--danger, #ef4444)' }}>{packagesError}</p>}
                  {!packagesLoading && !packagesError && (
                    <table className="ui-table">
                      <thead>
                        <tr>
                          <th>Tên gói</th>
                          <th>Loại xe</th>
                          <th>Giá</th>
                          <th>Thời hạn (tháng)</th>
                          <th>Mô tả</th>
                          <th style={{ width: '150px' }}>Thao tác</th>
                        </tr>
                      </thead>
                      <tbody>
                        {packages.length === 0 ? (
                          <tr>
                            <td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                              Chưa có gói thuê bao nào.
                            </td>
                          </tr>
                        ) : (
                          packages.map((p) => {
                            const duration = p.durationMonths !== undefined ? p.durationMonths : p.duration || 0
                            const vtLabel = p.vehicleTypeName || '—'
                            return (
                              <tr key={p.packageId}>
                                <td>{p.packageName}</td>
                                <td>{vtLabel}</td>
                                <td>{p.price.toLocaleString('vi-VN')} VNĐ</td>
                                <td>{duration}</td>
                                <td>{p.description || '—'}</td>
                                <td>
                                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <button
                                      type="button"
                                      className="btn btn-outline btn-sm"
                                      onClick={() => openEditPackage(p)}
                                    >
                                      Sửa
                                    </button>
                                    <button
                                      type="button"
                                      className="btn btn-outline btn-sm"
                                      style={{ borderColor: 'var(--danger, #ef4444)', color: 'var(--danger, #ef4444)' }}
                                      onClick={() => handleDeletePackage(p.packageId, p.packageName)}
                                    >
                                      Xóa
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            )
                          })
                        )}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Floor Create/Edit Modal */}
      {showModal === 'floor' && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) closeModal() }}>
          <div className="modal-panel">
            <h3 className="modal-title">{editFloor ? 'Sửa tầng' : 'Thêm tầng'}</h3>
            <form onSubmit={handleSaveFloor}>
              <div className="form-field">
                <label htmlFor="floor-name">Tên tầng *</label>
                <input
                  id="floor-name"
                  type="text"
                  required
                  value={floorForm.floorName}
                  onChange={(e) => setFloorForm({ ...floorForm, floorName: e.target.value })}
                  placeholder="VD: Tầng B1"
                />
              </div>
              <div className="form-field">
                <label htmlFor="floor-capacity">Sức chứa (slot) *</label>
                <input
                  id="floor-capacity"
                  type="number"
                  required
                  min={1}
                  value={floorForm.capacity}
                  onChange={(e) => setFloorForm({ ...floorForm, capacity: e.target.value })}
                  placeholder="VD: 96"
                />
              </div>
              <div className="form-actions">
                <button type="button" className="btn btn-ghost" onClick={closeModal}>
                  Huỷ
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Đang lưu...' : 'Lưu'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Gate Create/Edit Modal */}
      {showModal === 'gate' && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) closeModal() }}>
          <div className="modal-panel">
            <h3 className="modal-title">{editGate ? 'Sửa cổng' : 'Thêm cổng'}</h3>
            <form onSubmit={handleSaveGate}>
              <div className="form-field">
                <label htmlFor="gate-name">Tên cổng *</label>
                <input
                  id="gate-name"
                  type="text"
                  required
                  value={gateForm.gateName}
                  onChange={(e) => setGateForm({ ...gateForm, gateName: e.target.value })}
                  placeholder="VD: Cổng chính"
                />
              </div>

              <div className="form-field">
                <label htmlFor="gate-floor">Vị trí (Tầng) *</label>
                <select
                  id="gate-floor"
                  required
                  value={gateForm.floorId}
                  onChange={(e) => setGateForm({ ...gateForm, floorId: e.target.value })}
                >
                  <option value="" disabled>-- Chọn tầng --</option>
                  {floors.map((f) => (
                    <option key={f.floorId} value={f.floorId}>
                      {f.floorName}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-field">
                <label htmlFor="gate-type">Loại cổng / Trạng thái *</label>
                <select
                  id="gate-type"
                  required
                  value={gateForm.gateType}
                  onChange={(e) => setGateForm({ ...gateForm, gateType: e.target.value })}
                >
                  <option value="Entry">Cổng vào (Entry)</option>
                  <option value="Exit">Cổng ra (Exit)</option>
                </select>
              </div>

              <div className="form-actions">
                <button type="button" className="btn btn-ghost" onClick={closeModal}>
                  Huỷ
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Đang lưu...' : 'Lưu'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* VehicleType Create/Edit Modal */}
      {showModal === 'vehicleType' && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) closeModal() }}>
          <div className="modal-panel">
            <h3 className="modal-title">{editVehicleType ? 'Sửa loại xe' : 'Thêm loại xe'}</h3>
            <form onSubmit={handleSaveVehicleType}>
              <div className="form-field">
                <label htmlFor="vt-name">Tên loại xe *</label>
                <input
                  id="vt-name"
                  type="text"
                  required
                  value={vehicleTypeForm.typeName}
                  onChange={(e) => setVehicleTypeForm({ ...vehicleTypeForm, typeName: e.target.value })}
                  placeholder="VD: Ô tô"
                />
              </div>

              <div className="form-field">
                <label htmlFor="vt-dimensions">Kích thước *</label>
                <input
                  id="vt-dimensions"
                  type="text"
                  required
                  value={vehicleTypeForm.dimensions}
                  onChange={(e) => setVehicleTypeForm({ ...vehicleTypeForm, dimensions: e.target.value })}
                  placeholder="VD: 4.5m x 1.8m"
                />
              </div>

              <div className="form-field">
                <label htmlFor="vt-price">Giá cơ bản (VNĐ)</label>
                <input
                  id="vt-price"
                  type="number"
                  min={0}
                  value={vehicleTypeForm.basePrice}
                  onChange={(e) => setVehicleTypeForm({ ...vehicleTypeForm, basePrice: e.target.value })}
                  placeholder="VD: 25000"
                />
              </div>

              <div className="form-actions">
                <button type="button" className="btn btn-ghost" onClick={closeModal}>
                  Huỷ
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Đang lưu...' : 'Lưu'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SubscriptionPackage Create/Edit Modal */}
      {showModal === 'package' && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) closeModal() }}>
          <div className="modal-panel">
            <h3 className="modal-title">{editPackage ? 'Sửa gói thuê bao' : 'Thêm gói thuê bao'}</h3>
            <form onSubmit={handleSavePackage}>
              <div className="form-field">
                <label htmlFor="pkg-name">Tên gói *</label>
                <input
                  id="pkg-name"
                  type="text"
                  required
                  value={packageForm.packageName}
                  onChange={(e) => setPackageForm({ ...packageForm, packageName: e.target.value })}
                  placeholder="VD: Gói cơ bản"
                />
              </div>

              <div className="form-field">
                <label htmlFor="pkg-vtype">Loại phương tiện áp dụng *</label>
                <select
                  id="pkg-vtype"
                  required
                  value={packageForm.vehicleTypeId}
                  onChange={(e) => {
                    const nextType = vehicleTypes.find((item) => item.vehicleTypeId === e.target.value)
                    setPackageForm({
                      ...packageForm,
                      vehicleTypeId: e.target.value,
                      requireFixedSlot: isMotorbike(nextType?.typeName) ? false : packageForm.requireFixedSlot,
                    })
                  }}
                >
                  <option value="" disabled>-- Chọn loại xe --</option>
                  {vehicleTypes.map((vt) => (
                    <option key={vt.vehicleTypeId} value={vt.vehicleTypeId}>
                      {vt.typeName}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-field">
                <label htmlFor="pkg-price">Giá gói (VNĐ) *</label>
                <input
                  id="pkg-price"
                  type="number"
                  required
                  min={1}
                  value={packageForm.price}
                  onChange={(e) => setPackageForm({ ...packageForm, price: e.target.value })}
                  placeholder="VD: 200000"
                />
              </div>

              <div className="form-field">
                <label htmlFor="pkg-duration">Thời hạn (tháng) *</label>
                <input
                  id="pkg-duration"
                  type="number"
                  required
                  min={1}
                  value={packageForm.durationMonths}
                  onChange={(e) => setPackageForm({ ...packageForm, durationMonths: e.target.value })}
                  placeholder="VD: 1"
                />
              </div>

              <div className="form-field">
                <label htmlFor="pkg-desc">Mô tả</label>
                <textarea
                  id="pkg-desc"
                  rows={3}
                  value={packageForm.description}
                  onChange={(e) => setPackageForm({ ...packageForm, description: e.target.value })}
                  placeholder="Nhập mô tả chi tiết về gói thuê bao..."
                />
              </div>

              <div className="form-field">
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input
                    type="checkbox"
                    checked={packageForm.requireFixedSlot}
                    disabled={selectedPackageIsMotorbike}
                    onChange={(e) => setPackageForm({ ...packageForm, requireFixedSlot: e.target.checked })}
                  />
                  Cho phép user chọn vị trí ô tô cố định
                </label>
                {selectedPackageIsMotorbike && <small>Xe máy không sử dụng vị trí cố định.</small>}
              </div>

              <div className="form-field">
                <label htmlFor="pkg-status">Trạng thái *</label>
                <select
                  id="pkg-status"
                  value={packageForm.status}
                  onChange={(e) => setPackageForm({ ...packageForm, status: e.target.value })}
                >
                  <option value="Active">Đang bán</option>
                  <option value="Inactive">Ngừng bán</option>
                  <option value="Suspended">Tạm ngưng</option>
                </select>
              </div>

              <div className="form-actions">
                <button type="button" className="btn btn-ghost" onClick={closeModal}>
                  Huỷ
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Đang lưu...' : 'Lưu'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminPageShell>
  )
}
