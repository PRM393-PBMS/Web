import { Pencil, Plus, RefreshCw, Search, Shield, ShieldCheck, Trash2, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import AdminPageShell from '../../components/AdminPageShell'
import ManagerConfirmActionModal from '../../components/ManagerConfirmActionModal'
import { ToastContainer, useToast } from '../../components/Toast'
import { apiClient, API_ENDPOINTS } from '../../config/api'

interface ApiResponse<T = unknown> {
  statusCode: number
  message: string
  isSuccess: boolean
  result?: T
}

interface Role {
  roleId: string
  roleName: string
  description: string
}

interface RoleForm {
  roleName: string
  description: string
}

const EMPTY_FORM: RoleForm = { roleName: '', description: '' }

function isAdminRole(role: Role) {
  return role.roleName.trim().toLowerCase() === 'admin'
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback
}

export default function AdminRoles() {
  const [roles, setRoles] = useState<Role[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [editingRole, setEditingRole] = useState<Role | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Role | null>(null)
  const [form, setForm] = useState<RoleForm>(EMPTY_FORM)
  const [formError, setFormError] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const toast = useToast()

  const fetchRoles = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await apiClient.get<ApiResponse<Role[]>>(API_ENDPOINTS.ROLES_GET_ALL)
      setRoles(response.isSuccess && Array.isArray(response.result) ? response.result : [])
      if (!response.isSuccess) {
        setError(response.message || 'Không thể tải danh sách vai trò.')
      }
    } catch (error) {
      setRoles([])
      setError(errorMessage(error, 'Không thể kết nối đến hệ thống.'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    queueMicrotask(() => void fetchRoles())
  }, [fetchRoles])

  const filteredRoles = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    return [...roles]
      .filter((role) =>
        !normalized ||
        `${role.roleName} ${role.description ?? ''}`.toLowerCase().includes(normalized),
      )
      .sort((a, b) => a.roleName.localeCompare(b.roleName, 'vi'))
  }, [query, roles])

  const openCreateModal = () => {
    setEditingRole(null)
    setForm(EMPTY_FORM)
    setFormError('')
    setModalOpen(true)
  }

  const openEditModal = (role: Role) => {
    if (isAdminRole(role)) {
      toast.warning('Vai trò Admin được hệ thống bảo vệ và không thể chỉnh sửa.')
      return
    }
    setEditingRole(role)
    setForm({ roleName: role.roleName, description: role.description ?? '' })
    setFormError('')
    setModalOpen(true)
  }

  const closeModal = () => {
    if (submitting) return
    setModalOpen(false)
    setEditingRole(null)
    setForm(EMPTY_FORM)
    setFormError('')
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    const roleName = form.roleName.trim()
    if (!roleName) {
      setFormError('Vui lòng nhập tên vai trò.')
      return
    }

    setSubmitting(true)
    setFormError('')
    try {
      const response = editingRole
        ? await apiClient.put<ApiResponse<Role>>(API_ENDPOINTS.ROLES_UPDATE, {
            roleId: editingRole.roleId,
            roleName,
            description: form.description.trim() || null,
          })
        : await apiClient.post<ApiResponse<Role>>(API_ENDPOINTS.ROLES_CREATE, {
            roleName,
            description: form.description.trim() || null,
          })

      if (!response.isSuccess) {
        setFormError(response.message || 'Không thể lưu vai trò.')
        return
      }

      setModalOpen(false)
      setEditingRole(null)
      setForm(EMPTY_FORM)
      toast.success(
        response.message ||
          (editingRole ? 'Cập nhật vai trò thành công.' : 'Tạo vai trò thành công.'),
      )
      await fetchRoles()
    } catch (error) {
      setFormError(errorMessage(error, 'Không thể lưu vai trò. Vui lòng thử lại.'))
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    const response = await apiClient.delete<ApiResponse>(
      `${API_ENDPOINTS.ROLES_DELETE}/${deleteTarget.roleId}`,
    )
    if (!response.isSuccess) {
      throw new Error(response.message || 'Không thể xóa vai trò.')
    }
    const deletedRoleName = deleteTarget.roleName
    setDeleteTarget(null)
    toast.success(response.message || `Đã xóa vai trò ${deletedRoleName}.`)
    await fetchRoles()
  }

  const requestDelete = (role: Role) => {
    if (isAdminRole(role)) {
      toast.warning('Vai trò Admin được hệ thống bảo vệ và không thể xóa.')
      return
    }
    setDeleteTarget(role)
  }

  return (
    <AdminPageShell activeItem="roles">
      <ToastContainer toasts={toast.toasts} onClose={toast.close} />
      <div className="staff-content-wrapper manager-resource-page">
        <header className="manager-resource-header">
          <div className="manager-resource-title">
            <span className="manager-resource-icon"><Shield size={24} aria-hidden /></span>
            <div>
              <h2>Quản lý vai trò</h2>
              <p>Tạo và duy trì các vai trò có thể gán cho tài khoản trong hệ thống.</p>
            </div>
          </div>
          <div className="manager-header-actions">
            <button type="button" className="btn btn-outline" onClick={fetchRoles} disabled={loading}>
              <RefreshCw size={17} className={loading ? 'spin' : ''} aria-hidden /> Làm mới
            </button>
            <button type="button" className="btn btn-primary manager-add-button" onClick={openCreateModal}>
              <Plus size={18} aria-hidden /> Thêm vai trò
            </button>
          </div>
        </header>

        <section className="manager-summary-grid" aria-label="Tổng quan vai trò">
          <article className="manager-summary-card">
            <span>Tổng vai trò</span><strong>{roles.length}</strong><small>Đang được định nghĩa</small>
          </article>
          <article className="manager-summary-card manager-summary-card--purple">
            <span>Vai trò có thể quản lý</span><strong>{roles.filter((role) => !isAdminRole(role)).length}</strong><small>Không bao gồm quyền Admin hệ thống</small>
          </article>
        </section>

        <section className="card-panel manager-resource-panel">
          <div className="manager-resource-toolbar">
            <label className="manager-search-field" htmlFor="admin-role-search">
              <Search size={18} aria-hidden />
              <input
                id="admin-role-search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Tìm theo tên hoặc mô tả..."
              />
              {query && <button type="button" aria-label="Xóa tìm kiếm" onClick={() => setQuery('')}><X size={16} /></button>}
            </label>
            <div className="manager-toolbar-meta"><span>{filteredRoles.length}/{roles.length} vai trò</span></div>
          </div>

          {error && <div className="manager-inline-error" role="alert">{error}</div>}

          <div className="table-wrap manager-table-wrap">
            <table className="ui-table manager-resource-table">
              <thead><tr><th>Vai trò</th><th>Mô tả</th><th>Phạm vi</th><th>Thao tác</th></tr></thead>
              <tbody>
                {loading && roles.length === 0 ? (
                  <tr><td colSpan={4}><div className="manager-empty-state">Đang tải dữ liệu...</div></td></tr>
                ) : filteredRoles.length === 0 ? (
                  <tr><td colSpan={4}><div className="manager-empty-state"><Shield size={30} aria-hidden /><strong>Không có vai trò phù hợp</strong><span>{query ? 'Hãy thử từ khóa khác.' : 'Hãy thêm vai trò đầu tiên.'}</span></div></td></tr>
                ) : filteredRoles.map((role) => {
                  const protectedRole = isAdminRole(role)
                  return (
                    <tr key={role.roleId}>
                      <td><div className="manager-name-cell"><span><ShieldCheck size={18} /></span><strong>{role.roleName}</strong></div></td>
                      <td>{role.description || <span className="manager-muted-value">Chưa có mô tả</span>}</td>
                      <td>{protectedRole ? <span className="badge badge-paid">Hệ thống bảo vệ</span> : <span className="badge badge-pending">Có thể quản lý</span>}</td>
                      <td>
                        <div className="manager-row-actions">
                          <button type="button" className="btn btn-outline btn-sm manager-edit-button" onClick={() => openEditModal(role)}><Pencil size={15} /> Sửa</button>
                          <button type="button" className="btn btn-ghost btn-sm manager-danger-action" onClick={() => requestDelete(role)}><Trash2 size={15} /> Xóa</button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {modalOpen && (
        <div className="modal-overlay" onClick={(event) => event.target === event.currentTarget && closeModal()}>
          <div className="modal-panel manager-form-modal" role="dialog" aria-modal="true" aria-labelledby="role-modal-title">
            <div className="manager-modal-header">
              <div>
                <h3 id="role-modal-title" className="modal-title">{editingRole ? 'Cập nhật vai trò' : 'Thêm vai trò'}</h3>
                <p>Vai trò Admin là quyền hệ thống và không thể tạo, đổi tên hoặc xóa.</p>
              </div>
              <button type="button" className="btn btn-ghost btn-sm" onClick={closeModal} disabled={submitting} aria-label="Đóng"><X size={20} /></button>
            </div>
            <form onSubmit={(event) => void handleSubmit(event)}>
              {formError && <div className="manager-inline-error" role="alert">{formError}</div>}
              <div className="form-field">
                <label htmlFor="role-name">Tên vai trò *</label>
                <input id="role-name" autoFocus required maxLength={50} value={form.roleName} onChange={(event) => setForm({ ...form, roleName: event.target.value })} disabled={submitting} placeholder="Ví dụ: Supervisor" />
                <small className="field-hint">Tối đa 50 ký tự và không được trùng tên vai trò đã có.</small>
              </div>
              <div className="form-field">
                <label htmlFor="role-description">Mô tả</label>
                <textarea id="role-description" rows={4} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} disabled={submitting} placeholder="Mô tả phạm vi sử dụng của vai trò..." />
              </div>
              <div className="form-actions">
                <button type="button" className="btn btn-ghost" onClick={closeModal} disabled={submitting}>Hủy</button>
                <button type="submit" className="btn btn-primary" disabled={submitting || !form.roleName.trim()}>{submitting ? 'Đang lưu...' : editingRole ? 'Lưu thay đổi' : 'Thêm vai trò'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ManagerConfirmActionModal
        open={Boolean(deleteTarget)}
        title="Xóa vai trò?"
        description={<>Bạn có chắc muốn xóa vai trò <strong>{deleteTarget?.roleName}</strong>? Hành động này không thể hoàn tác.</>}
        targetLabel={deleteTarget?.roleName}
        targetMeta={deleteTarget?.description}
        targetIcon={<Shield size={18} aria-hidden />}
        note="Không thể xóa vai trò đang được gán cho một hoặc nhiều tài khoản."
        errorFallback="Không thể xóa vai trò."
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
      />
    </AdminPageShell>
  )
}
