import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { Building2, ImagePlus, MapPin, Pencil, Plus, RefreshCw, Search, Trash2, X } from 'lucide-react'
import ManagerConfirmActionModal from '../../components/ManagerConfirmActionModal'
import AdminPageShell from '../../components/AdminPageShell'
import ManagerPageShell from '../../components/ManagerPageShell'
import { API_ROOT_URL } from '../../config/api'
import { parkingApi, type ParkingDto } from '../../utils/apiServices'

const EMPTY_FORM = { name: '', location: '', latitude: '', longitude: '', openingHours: '' }

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback
}

/** Ảnh lưu dạng /uploads/... trên máy chủ: ghép với gốc máy chủ để hiển thị. */
function imageSrc(url: string | null) {
  if (!url) return ''
  return /^https?:\/\//i.test(url) ? url : `${API_ROOT_URL}${url}`
}

function parseCoordinate(value: string, min: number, max: number) {
  if (!value.trim()) return null
  const number = Number(value.replace(',', '.'))
  return Number.isFinite(number) && number >= min && number <= max ? number : Number.NaN
}

/** [area] admin: thêm/sửa/xoá; manager: chỉ xem (cấu trúc bãi do admin quản lý). */
export default function ManagerParkings({ area = 'manager' }: { area?: 'manager' | 'admin' }) {
  const canEdit = area === 'admin'
  const Shell = area === 'admin' ? AdminPageShell : ManagerPageShell
  const [parkings, setParkings] = useState<ParkingDto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editTarget, setEditTarget] = useState<ParkingDto | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<ParkingDto | null>(null)
  const [uploadingId, setUploadingId] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const uploadTargetRef = useRef<ParkingDto | null>(null)

  const fetchParkings = async () => {
    setLoading(true)
    setError(null)
    try {
      setParkings(await parkingApi.getAll())
    } catch (requestError) {
      setError(errorMessage(requestError, 'Không thể tải danh sách bãi đỗ.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    queueMicrotask(() => void fetchParkings())
  }, [])

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return parkings
    return parkings.filter((item) => `${item.name} ${item.location}`.toLowerCase().includes(normalized))
  }, [parkings, query])

  const openCreate = () => {
    setEditTarget(null)
    setForm(EMPTY_FORM)
    setFormError('')
    setShowModal(true)
  }

  const openEdit = (parking: ParkingDto) => {
    setEditTarget(parking)
    setForm({
      name: parking.name,
      location: parking.location,
      latitude: parking.latitude?.toString() ?? '',
      longitude: parking.longitude?.toString() ?? '',
      openingHours: parking.openingHours ?? '',
    })
    setFormError('')
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setEditTarget(null)
    setForm(EMPTY_FORM)
    setFormError('')
  }

  const handleSave = async (event: FormEvent) => {
    event.preventDefault()
    const name = form.name.trim()
    const location = form.location.trim()
    if (!name || !location) {
      setFormError('Vui lòng nhập tên và địa chỉ bãi đỗ.')
      return
    }
    const latitude = parseCoordinate(form.latitude, -90, 90)
    const longitude = parseCoordinate(form.longitude, -180, 180)
    if (Number.isNaN(latitude) || Number.isNaN(longitude)) {
      setFormError('Vĩ độ phải trong khoảng -90 đến 90, kinh độ trong khoảng -180 đến 180.')
      return
    }
    if ((latitude === null) !== (longitude === null)) {
      setFormError('Nhập đủ cả vĩ độ và kinh độ, hoặc để trống cả hai.')
      return
    }

    setSaving(true)
    setFormError('')
    try {
      const payload = { name, location, latitude, longitude, openingHours: form.openingHours.trim() || null }
      if (editTarget) await parkingApi.update(editTarget.id, payload)
      else await parkingApi.create(payload)
      closeModal()
      await fetchParkings()
    } catch (requestError) {
      setFormError(errorMessage(requestError, 'Lưu bãi đỗ thất bại. Vui lòng thử lại.'))
    } finally {
      setSaving(false)
    }
  }

  const pickImage = (parking: ParkingDto) => {
    uploadTargetRef.current = parking
    fileInputRef.current?.click()
  }

  const handleImage = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    const target = uploadTargetRef.current
    event.target.value = ''
    if (!file || !target) return
    if (file.size > 5 * 1024 * 1024) {
      setError('Ảnh tối đa 5MB.')
      return
    }
    setUploadingId(target.id)
    setError(null)
    try {
      await parkingApi.uploadImage(target.id, file)
      await fetchParkings()
    } catch (requestError) {
      setError(errorMessage(requestError, 'Không tải được ảnh bãi đỗ.'))
    } finally {
      setUploadingId('')
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    await parkingApi.remove(deleteTarget.id)
    setDeleteTarget(null)
    await fetchParkings()
  }

  const withCoordinates = parkings.filter((item) => item.latitude !== null && item.longitude !== null).length

  return (
    <Shell activeItem={area === 'admin' ? 'lot-designer' : 'parkings'}>
      <div className="staff-content-wrapper manager-resource-page">
        <header className="manager-resource-header">
          <div className="manager-resource-title">
            <span className="manager-resource-icon"><Building2 size={24} aria-hidden /></span>
            <div>
              <h2>Quản lý bãi đỗ</h2>
              <p>Mỗi tầng thuộc một bãi. Toạ độ, giờ mở cửa và ảnh hiện trên bản đồ của app khách.</p>
            </div>
          </div>
          <div className="manager-header-actions">
            <button type="button" className="btn btn-outline" onClick={fetchParkings} disabled={loading}><RefreshCw size={17} className={loading ? 'spin' : ''} aria-hidden /> Làm mới</button>
            {canEdit ? <button type="button" className="btn btn-primary manager-add-button" onClick={openCreate}><Plus size={18} aria-hidden /> Thêm bãi đỗ</button> : <span className="field-hint">Chỉ admin thêm, sửa, xoá ở mục Thiết kế bãi đỗ.</span>}
          </div>
        </header>

        <section className="manager-summary-grid" aria-label="Tổng quan bãi đỗ">
          <article className="manager-summary-card"><span>Tổng bãi đỗ</span><strong>{parkings.length}</strong><small>Đang hoạt động trong hệ thống</small></article>
          <article className="manager-summary-card manager-summary-card--accent"><span>Có toạ độ bản đồ</span><strong>{withCoordinates}</strong><small>Khách thấy trên bản đồ app</small></article>
        </section>

        <section className="card-panel manager-resource-panel">
          <div className="manager-resource-toolbar">
            <label className="manager-search-field" htmlFor="parking-search">
              <Search size={18} aria-hidden />
              <input id="parking-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm theo tên hoặc địa chỉ..." />
              {query && <button type="button" aria-label="Xóa tìm kiếm" onClick={() => setQuery('')}><X size={16} aria-hidden /></button>}
            </label>
            <div className="manager-toolbar-meta"><span>{filtered.length}/{parkings.length} bãi</span></div>
          </div>

          {error && <div className="manager-inline-error" role="alert">{error}</div>}

          <div className="table-wrap manager-table-wrap">
            <table className="ui-table manager-resource-table">
              <thead><tr><th>Bãi đỗ</th><th>Địa chỉ</th><th>Giờ mở cửa</th><th>Toạ độ</th><th>Thao tác</th></tr></thead>
              <tbody>
                {loading && parkings.length === 0 ? (
                  <tr><td colSpan={5}><div className="manager-empty-state">Đang tải dữ liệu...</div></td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={5}><div className="manager-empty-state"><Building2 size={30} aria-hidden /><strong>Không có dữ liệu phù hợp</strong><span>{query ? 'Thử từ khóa khác.' : 'Hãy thêm bãi đỗ đầu tiên, sau đó tạo tầng thuộc bãi.'}</span></div></td></tr>
                ) : filtered.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <div className="manager-name-cell">
                        {item.imageUrl
                          ? <img className="parking-thumb" src={imageSrc(item.imageUrl)} alt="" />
                          : <span><Building2 size={18} aria-hidden /></span>}
                        <strong>{item.name}</strong>
                      </div>
                    </td>
                    <td>{item.location}</td>
                    <td>{item.openingHours || <span className="manager-muted-value">Chưa nhập</span>}</td>
                    <td>{item.latitude !== null && item.longitude !== null
                      ? <span className="parking-coords"><MapPin size={14} aria-hidden /> {item.latitude.toFixed(5)}, {item.longitude.toFixed(5)}</span>
                      : <span className="manager-muted-value">Chưa nhập</span>}</td>
                    <td><div className="manager-row-actions">
                      {canEdit && <button type="button" className="btn btn-outline btn-sm manager-edit-button" onClick={() => openEdit(item)}><Pencil size={15} aria-hidden /> Sửa</button>}
                      <button type="button" className="btn btn-outline btn-sm" onClick={() => pickImage(item)} disabled={uploadingId === item.id}><ImagePlus size={15} aria-hidden /> {uploadingId === item.id ? 'Đang tải...' : 'Ảnh'}</button>
                      {canEdit && <button type="button" className="btn btn-ghost btn-sm manager-danger-action" onClick={() => setDeleteTarget(item)}><Trash2 size={15} aria-hidden /> Xóa</button>}
                    </div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={handleImage} />
        </section>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={(event) => event.target === event.currentTarget && closeModal()}>
          <div className="modal-panel manager-form-modal" role="dialog" aria-modal="true" aria-labelledby="parking-modal-title">
            <div className="manager-modal-header">
              <div><h3 id="parking-modal-title" className="modal-title">{editTarget ? 'Cập nhật bãi đỗ' : 'Thêm bãi đỗ'}</h3><p>Tên bãi không được trùng.</p></div>
              <button type="button" className="btn btn-ghost btn-sm" aria-label="Đóng" onClick={closeModal}><X size={20} aria-hidden /></button>
            </div>
            <form onSubmit={handleSave}>
              {formError && <div className="manager-inline-error" role="alert">{formError}</div>}
              <div className="form-field"><label htmlFor="pk-name">Tên bãi đỗ *</label><input id="pk-name" autoFocus maxLength={255} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Ví dụ: Bãi FPT Quận 9" /></div>
              <div className="form-field"><label htmlFor="pk-location">Địa chỉ *</label><input id="pk-location" maxLength={500} value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} placeholder="Ví dụ: Khu Công nghệ cao, Thủ Đức" /></div>
              <div className="form-grid-2">
                <div className="form-field"><label htmlFor="pk-lat">Vĩ độ</label><input id="pk-lat" inputMode="decimal" value={form.latitude} onChange={(event) => setForm({ ...form, latitude: event.target.value })} placeholder="10.84129" /></div>
                <div className="form-field"><label htmlFor="pk-lng">Kinh độ</label><input id="pk-lng" inputMode="decimal" value={form.longitude} onChange={(event) => setForm({ ...form, longitude: event.target.value })} placeholder="106.80983" /></div>
              </div>
              <div className="form-field"><label htmlFor="pk-hours">Giờ mở cửa</label><input id="pk-hours" maxLength={50} value={form.openingHours} onChange={(event) => setForm({ ...form, openingHours: event.target.value })} placeholder="24/7 hoặc 06:00 - 22:00" /><small className="field-hint">Để trống toạ độ thì bãi chỉ hiện trong danh sách, không hiện trên bản đồ.</small></div>
              <div className="form-actions"><button type="button" className="btn btn-ghost" onClick={closeModal} disabled={saving}>Hủy</button><button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Đang lưu...' : editTarget ? 'Lưu thay đổi' : 'Thêm bãi đỗ'}</button></div>
            </form>
          </div>
        </div>
      )}

      <ManagerConfirmActionModal
        open={Boolean(deleteTarget)}
        title="Xóa bãi đỗ?"
        description={<>Bạn có chắc muốn xóa <strong>{deleteTarget?.name}</strong>? Hành động này không thể hoàn tác.</>}
        targetLabel={deleteTarget?.name}
        targetMeta={deleteTarget?.location}
        targetIcon={<Building2 size={18} aria-hidden />}
        note="Bãi còn tầng hoặc ô đỗ sẽ không xóa được. Xóa hoặc chuyển các tầng trước."
        errorFallback="Không thể xóa bãi đỗ."
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
      />
    </Shell>
  )
}
