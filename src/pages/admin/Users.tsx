import {
  Ban,
  LockKeyhole,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  UserCheck,
  Users,
  X,
} from 'lucide-react'
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

interface AdminUser {
  userId: string
  userName: string
  email: string
  fullName: string
  phoneNumber: string | null
  roleName: string
  status: string
}

interface UserRoleOption {
  roleId?: string
  roleName: string
  description?: string
}

interface UserFormState {
  userName: string
  email: string
  password: string
  fullName: string
  phoneNumber: string
  roleName: string
}

type ModalMode = 'create' | 'edit'

const EMPTY_FORM: UserFormState = {
  userName: '',
  email: '',
  password: '',
  fullName: '',
  phoneNumber: '',
  roleName: '',
}

const roleLabels: Record<string, string> = {
  admin: 'Quản trị viên',
  manager: 'Quản lý',
  staff: 'Nhân viên',
  user: 'Người dùng',
  customer: 'Khách hàng',
}

function roleLabel(roleName: string): string {
  return roleLabels[roleName?.toLowerCase() ?? ''] ?? roleName
}

function isAdminUser(user: AdminUser): boolean {
  return user.roleName?.toLowerCase() === 'admin'
}

function statusLabel(status: string): string {
  const normalized = status?.toLowerCase() ?? ''
  if (normalized === 'active') return 'Hoạt động'
  if (normalized === 'inactive') return 'Ngừng hoạt động'
  if (normalized === 'banned') return 'Bị cấm'
  return status || '—'
}

function statusBadgeClass(status: string): string {
  const normalized = status?.toLowerCase() ?? ''
  if (normalized === 'active') return 'badge badge-paid'
  if (normalized === 'banned') return 'badge badge-cancelled'
  return 'badge badge-pending'
}

function parseRolesResult(result: unknown): string[] {
  if (!Array.isArray(result)) return []
  if (typeof result[0] === 'string') return result as string[]
  return (result as UserRoleOption[]).map((role) => role.roleName).filter(Boolean)
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback
}

export default function AdminUsers() {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [roles, setRoles] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [rolesError, setRolesError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [modalOpen, setModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState<ModalMode>('create')
  const [currentUser, setCurrentUser] = useState<AdminUser | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null)
  const [form, setForm] = useState<UserFormState>(EMPTY_FORM)
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [statusUpdatingId, setStatusUpdatingId] = useState<string | null>(null)
  const toast = useToast()

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await apiClient.get<ApiResponse<AdminUser[]>>(API_ENDPOINTS.USER_GET_ALL)
      setUsers(response.isSuccess && Array.isArray(response.result) ? response.result : [])
      if (!response.isSuccess) {
        setError(response.message || 'Không thể tải danh sách tài khoản.')
      }
    } catch (error) {
      setUsers([])
      setError(errorMessage(error, 'Không thể kết nối đến hệ thống.'))
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchRoles = useCallback(async () => {
    setRolesError(null)
    try {
      const response = await apiClient.get<ApiResponse<string[] | UserRoleOption[]>>(
        API_ENDPOINTS.USER_GET_ROLES,
      )
      if (response.isSuccess) {
        setRoles(parseRolesResult(response.result))
      } else {
        setRoles([])
        setRolesError(response.message || 'Không thể tải danh sách vai trò có thể gán.')
      }
    } catch (error) {
      setRoles([])
      setRolesError(errorMessage(error, 'Không thể tải danh sách vai trò có thể gán.'))
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchUsers()
      void fetchRoles()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [fetchUsers, fetchRoles])

  const filteredUsers = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    return [...users]
      .filter((user) => {
        const matchesQuery =
          !normalizedQuery ||
          `${user.fullName} ${user.userName} ${user.email} ${user.phoneNumber ?? ''} ${user.roleName}`
            .toLowerCase()
            .includes(normalizedQuery)
        const matchesStatus =
          statusFilter === 'all' || user.status.toLowerCase() === statusFilter.toLowerCase()
        return matchesQuery && matchesStatus
      })
      .sort((a, b) => (a.fullName || '').localeCompare(b.fullName || '', 'vi'))
  }, [query, statusFilter, users])

  const activeCount = users.filter((user) => user.status.toLowerCase() === 'active').length
  const restrictedCount = users.length - activeCount

  const openCreateModal = () => {
    if (roles.length === 0) {
      toast.warning(rolesError || 'Chưa có vai trò phù hợp để tạo tài khoản.')
      return
    }
    setModalMode('create')
    setCurrentUser(null)
    setForm({ ...EMPTY_FORM, roleName: roles[0] })
    setFormError('')
    setModalOpen(true)
  }

  const openEditModal = (user: AdminUser) => {
    if (isAdminUser(user)) {
      toast.warning('Tài khoản Admin được hệ thống bảo vệ và không thể chỉnh sửa.')
      return
    }
    setModalMode('edit')
    setCurrentUser(user)
    setForm({
      userName: user.userName ?? '',
      email: user.email ?? '',
      password: '',
      fullName: user.fullName ?? '',
      phoneNumber: user.phoneNumber ?? '',
      roleName: user.roleName ?? '',
    })
    setFormError('')
    setModalOpen(true)
  }

  const closeModal = () => {
    if (submitting) return
    setModalOpen(false)
    setCurrentUser(null)
    setForm(EMPTY_FORM)
    setFormError('')
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setSubmitting(true)
    setFormError('')
    try {
      const payload = {
        userName: form.userName.trim(),
        email: form.email.trim(),
        password: form.password || null,
        fullName: form.fullName.trim(),
        phoneNumber: form.phoneNumber.trim() || null,
        roleName: form.roleName,
      }
      const response =
        modalMode === 'create'
          ? await apiClient.post<ApiResponse>(API_ENDPOINTS.USER_CREATE, payload)
          : await apiClient.put<ApiResponse>(API_ENDPOINTS.USER_UPDATE, {
              ...payload,
              userId: currentUser?.userId,
            })

      if (!response.isSuccess) {
        setFormError(response.message || 'Không thể lưu tài khoản.')
        return
      }

      setModalOpen(false)
      setCurrentUser(null)
      setForm(EMPTY_FORM)
      toast.success(
        response.message ||
          (modalMode === 'create'
            ? 'Tạo tài khoản thành công.'
            : 'Cập nhật tài khoản thành công.'),
      )
      await fetchUsers()
    } catch (error) {
      setFormError(errorMessage(error, 'Không thể lưu tài khoản. Vui lòng thử lại.'))
    } finally {
      setSubmitting(false)
    }
  }

  const handleStatusChange = async (user: AdminUser, nextStatus: string) => {
    if (isAdminUser(user)) {
      toast.warning('Tài khoản Admin được hệ thống bảo vệ và không thể đổi trạng thái.')
      return
    }
    if (nextStatus === user.status) return

    setStatusUpdatingId(user.userId)
    try {
      const response = await apiClient.patch<ApiResponse>(
        `${API_ENDPOINTS.USER_STATUS}/${user.userId}/status`,
        { status: nextStatus },
      )
      if (!response.isSuccess) {
        toast.error(response.message || 'Không thể thay đổi trạng thái tài khoản.')
        return
      }
      toast.success(
        response.message ||
          `Đã chuyển tài khoản ${user.fullName || user.email} sang ${statusLabel(nextStatus)}.`,
      )
      await fetchUsers()
    } catch (error) {
      toast.error(errorMessage(error, 'Không thể thay đổi trạng thái tài khoản.'))
    } finally {
      setStatusUpdatingId(null)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    const response = await apiClient.delete<ApiResponse>(
      `${API_ENDPOINTS.USER_DELETE}/${deleteTarget.userId}`,
    )
    if (!response.isSuccess) {
      throw new Error(response.message || 'Không thể vô hiệu hóa tài khoản.')
    }
    const targetName = deleteTarget.fullName || deleteTarget.email
    setDeleteTarget(null)
    toast.success(response.message || `Đã vô hiệu hóa tài khoản ${targetName}.`)
    await fetchUsers()
  }

  const requestDelete = (user: AdminUser) => {
    if (isAdminUser(user)) {
      toast.warning('Tài khoản Admin được hệ thống bảo vệ và không thể vô hiệu hóa.')
      return
    }
    setDeleteTarget(user)
  }

  const explainAdminProtection = () => {
    toast.info('Tài khoản Admin được hệ thống bảo vệ, không thể sửa, đổi trạng thái hoặc vô hiệu hóa.')
  }

  return (
    <AdminPageShell activeItem="users">
      <ToastContainer toasts={toast.toasts} onClose={toast.close} />
      <div className="staff-content-wrapper manager-resource-page">
        <header className="manager-resource-header">
          <div className="manager-resource-title">
            <span className="manager-resource-icon"><Users size={24} aria-hidden /></span>
            <div>
              <h2>Quản lý tài khoản</h2>
              <p>Tạo tài khoản, phân vai trò và kiểm soát quyền đăng nhập theo chính sách hệ thống.</p>
            </div>
          </div>
          <div className="manager-header-actions">
            <button type="button" className="btn btn-outline" onClick={fetchUsers} disabled={loading}>
              <RefreshCw size={17} className={loading ? 'spin' : ''} aria-hidden /> Làm mới
            </button>
            <button type="button" className="btn btn-primary manager-add-button" onClick={openCreateModal}>
              <Plus size={18} aria-hidden /> Thêm tài khoản
            </button>
          </div>
        </header>

        <section className="manager-summary-grid manager-summary-grid--three" aria-label="Tổng quan tài khoản">
          <article className="manager-summary-card">
            <span>Tổng tài khoản</span><strong>{users.length}</strong><small>Đang có trong hệ thống</small>
          </article>
          <article className="manager-summary-card manager-summary-card--green">
            <span>Đang hoạt động</span><strong>{activeCount}</strong><small>Có thể đăng nhập hệ thống</small>
          </article>
          <article className="manager-summary-card manager-summary-card--red">
            <span>Đang hạn chế</span><strong>{restrictedCount}</strong><small>Ngừng hoạt động hoặc bị cấm</small>
          </article>
        </section>

        <section className="card-panel manager-resource-panel">
          <div className="manager-resource-toolbar admin-user-toolbar">
            <label className="manager-search-field" htmlFor="admin-user-search">
              <Search size={18} aria-hidden />
              <input
                id="admin-user-search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Tìm theo tên, email, số điện thoại..."
              />
              {query && <button type="button" aria-label="Xóa tìm kiếm" onClick={() => setQuery('')}><X size={16} /></button>}
            </label>
            <select
              className="form-select-inline"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              aria-label="Lọc theo trạng thái"
            >
              <option value="all">Tất cả trạng thái</option>
              <option value="Active">Hoạt động</option>
              <option value="Inactive">Ngừng hoạt động</option>
              <option value="Banned">Bị cấm</option>
            </select>
            <div className="manager-toolbar-meta"><span>{filteredUsers.length}/{users.length} tài khoản</span></div>
          </div>

          {error && <div className="manager-inline-error" role="alert">{error}</div>}
          {rolesError && <div className="manager-inline-warning" role="status">{rolesError} Chức năng thêm/sửa tài khoản tạm thời bị hạn chế.</div>}

          <div className="table-wrap manager-table-wrap">
            <table className="ui-table manager-resource-table admin-user-table">
              <thead>
                <tr><th>Tài khoản</th><th>Liên hệ</th><th>Vai trò</th><th>Trạng thái</th><th>Thao tác</th></tr>
              </thead>
              <tbody>
                {loading && users.length === 0 ? (
                  <tr><td colSpan={5}><div className="manager-empty-state">Đang tải dữ liệu...</div></td></tr>
                ) : filteredUsers.length === 0 ? (
                  <tr><td colSpan={5}><div className="manager-empty-state"><Users size={30} aria-hidden /><strong>Không có tài khoản phù hợp</strong><span>{query || statusFilter !== 'all' ? 'Hãy thử thay đổi điều kiện lọc.' : 'Hãy tạo tài khoản đầu tiên.'}</span></div></td></tr>
                ) : filteredUsers.map((user) => {
                  const protectedUser = isAdminUser(user)
                  return (
                    <tr key={user.userId}>
                      <td><div className="manager-name-cell"><span><UserCheck size={18} /></span><div><strong>{user.fullName || 'Chưa đặt tên'}</strong><small>{user.userName}</small></div></div></td>
                      <td><strong>{user.email}</strong><br /><span className="manager-muted-value">{user.phoneNumber || 'Chưa có số điện thoại'}</span></td>
                      <td>{roleLabel(user.roleName)}{protectedUser && <span className="badge badge-paid admin-system-badge">Hệ thống</span>}</td>
                      <td><span className={statusBadgeClass(user.status)}>{statusLabel(user.status)}</span></td>
                      <td>
                        <div className="manager-row-actions admin-user-actions">
                          <button type="button" className="btn btn-outline btn-sm manager-edit-button" onClick={() => openEditModal(user)}><Pencil size={15} /> Sửa</button>
                          {protectedUser ? (
                            <button type="button" className="btn btn-ghost btn-sm admin-protected-action" onClick={explainAdminProtection}>
                              <LockKeyhole size={15} /> Được bảo vệ
                            </button>
                          ) : (
                            <select
                              className="admin-status-select"
                              disabled={statusUpdatingId === user.userId}
                              value={user.status}
                              onChange={(event) => void handleStatusChange(user, event.target.value)}
                              aria-label={`Đổi trạng thái của ${user.fullName || user.email}`}
                            >
                              <option value="Active">Hoạt động</option>
                              <option value="Inactive">Ngừng hoạt động</option>
                              <option value="Banned">Bị cấm</option>
                            </select>
                          )}
                          <button type="button" className="btn btn-ghost btn-sm manager-danger-action" onClick={() => requestDelete(user)}><Trash2 size={15} /> Vô hiệu hóa</button>
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
          <div className="modal-panel manager-form-modal admin-user-modal" role="dialog" aria-modal="true" aria-labelledby="user-modal-title">
            <div className="manager-modal-header">
              <div>
                <h3 id="user-modal-title" className="modal-title">{modalMode === 'create' ? 'Thêm tài khoản' : 'Cập nhật tài khoản'}</h3>
                <p>Thông tin đăng nhập và vai trò được kiểm tra trực tiếp bởi hệ thống.</p>
              </div>
              <button type="button" className="btn btn-ghost btn-sm" onClick={closeModal} disabled={submitting} aria-label="Đóng"><X size={20} /></button>
            </div>
            <form onSubmit={(event) => void handleSubmit(event)}>
              {formError && <div className="manager-inline-error" role="alert">{formError}</div>}
              <div className="form-grid-2">
                <div className="form-field"><label htmlFor="userName">Tên đăng nhập *</label><input id="userName" required maxLength={50} value={form.userName} onChange={(event) => setForm({ ...form, userName: event.target.value })} disabled={submitting} /></div>
                <div className="form-field"><label htmlFor="email">Email *</label><input id="email" type="email" required value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} disabled={submitting} /></div>
                <div className="form-field"><label htmlFor="fullName">Họ tên</label><input id="fullName" value={form.fullName} onChange={(event) => setForm({ ...form, fullName: event.target.value })} disabled={submitting} /></div>
                <div className="form-field"><label htmlFor="phoneNumber">Số điện thoại</label><input id="phoneNumber" value={form.phoneNumber} onChange={(event) => setForm({ ...form, phoneNumber: event.target.value })} disabled={submitting} /></div>
                <div className="form-field"><label htmlFor="password">Mật khẩu{modalMode === 'edit' ? ' mới' : ' *'}</label><input id="password" type="password" required={modalMode === 'create'} value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} disabled={submitting} autoComplete="new-password" /><small className="field-hint">{modalMode === 'edit' ? 'Để trống nếu không muốn đổi mật khẩu.' : 'Nhập mật khẩu cho tài khoản mới.'}</small></div>
                <div className="form-field"><label htmlFor="roleName">Vai trò *</label><select id="roleName" required value={form.roleName} onChange={(event) => setForm({ ...form, roleName: event.target.value })} disabled={submitting}>{roles.map((role) => <option key={role} value={role}>{roleLabel(role)}</option>)}</select></div>
              </div>
              <div className="form-actions">
                <button type="button" className="btn btn-ghost" onClick={closeModal} disabled={submitting}>Hủy</button>
                <button type="submit" className="btn btn-primary" disabled={submitting || !form.userName.trim() || !form.email.trim() || !form.roleName}>{submitting ? 'Đang lưu...' : modalMode === 'create' ? 'Tạo tài khoản' : 'Lưu thay đổi'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ManagerConfirmActionModal
        open={Boolean(deleteTarget)}
        title="Vô hiệu hóa tài khoản?"
        description={<>Tài khoản <strong>{deleteTarget?.fullName || deleteTarget?.email}</strong> sẽ chuyển sang trạng thái ngừng hoạt động và không thể đăng nhập.</>}
        targetLabel={deleteTarget?.email}
        targetMeta={deleteTarget ? `${roleLabel(deleteTarget.roleName)} · ${statusLabel(deleteTarget.status)}` : undefined}
        targetIcon={<Ban size={18} aria-hidden />}
        note="Hệ thống chỉ vô hiệu hóa tài khoản: dữ liệu vẫn được giữ lại và có thể kích hoạt lại bằng cách đổi trạng thái."
        confirmLabel="Xác nhận vô hiệu hóa"
        loadingLabel="Đang cập nhật..."
        errorFallback="Không thể vô hiệu hóa tài khoản."
        variant="warning"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
      />
    </AdminPageShell>
  )
}
