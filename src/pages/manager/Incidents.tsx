import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Eye,
  ImageOff,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import ManagerConfirmActionModal from "../../components/ManagerConfirmActionModal";
import ManagerPageShell from "../../components/ManagerPageShell";
import { ApiRequestError } from "../../config/api";
import { formatUtcToVietnamDateTime } from "../../utils/dateTime";
import {
  incidentReportApi,
  parkingSessionApi,
  type IncidentReportDto,
  type ParkingSessionDto,
  type UserDto,
} from "../../utils/apiServices";

const ISSUE_TYPES = [
  ["LostTicket", "Mất vé hoặc mã QR"],
  ["PlateMismatch", "Biển số không khớp"],
  ["PaymentIssue", "Vấn đề thanh toán"],
  ["SlotIssue", "Vấn đề vị trí đỗ xe"],
  ["VehicleDamage", "Xe hư hỏng hoặc va quẹt"],
  ["OverdueVehicle", "Xe gửi quá hạn"],
  ["WrongZone", "Xe gửi sai khu vực"],
  ["Other", "Sự cố khác"],
] as const;

const STATUS_LABELS: Record<string, string> = {
  open: "Chờ tiếp nhận",
  inprogress: "Đang xử lý",
  resolved: "Đã hoàn tất",
  cancelled: "Đã hủy",
};
const normalize = (value?: string) =>
  (value || "").replace(/[\s_-]/g, "").toLowerCase();
const statusLabel = (value?: string) =>
  STATUS_LABELS[normalize(value)] || value || "Không rõ";
const issueLabel = (value?: string) =>
  ISSUE_TYPES.find(([key]) => normalize(key) === normalize(value))?.[1] ||
  value ||
  "Sự cố khác";

export default function ManagerIncidents() {
  const [incidents, setIncidents] = useState<IncidentReportDto[]>([]);
  const [sessions, setSessions] = useState<ParkingSessionDto[]>([]);
  const [users, setUsers] = useState<UserDto[]>([]);
  const [staff, setStaff] = useState<UserDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [staffError, setStaffError] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [assigneeFilter, setAssigneeFilter] = useState("all");
  const [selected, setSelected] = useState<IncidentReportDto | null>(null);
  const [assignTarget, setAssignTarget] = useState<IncidentReportDto | null>(
    null,
  );
  const [assigneeId, setAssigneeId] = useState("");
  const [resolveTarget, setResolveTarget] = useState<IncidentReportDto | null>(
    null,
  );
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<IncidentReportDto | null>(
    null,
  );
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    sessionId: "",
    issueType: "Other",
    description: "",
  });
  const [proofFile, setProofFile] = useState<File | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    setStaffError("");
    try {
      const [incidentResult, sessionResult, userResult] =
        await Promise.allSettled([
          incidentReportApi.getAll(),
          parkingSessionApi.getAll(),
          incidentReportApi.getAssignees(),
        ]);
      if (
        incidentResult.status === "fulfilled" &&
        incidentResult.value.isSuccess
      )
        setIncidents(incidentResult.value.result || []);
      else if (
        incidentResult.status === "rejected" &&
        incidentResult.reason instanceof ApiRequestError &&
        incidentResult.reason.statusCode === 404
      )
        setIncidents([]);
      else
        throw incidentResult.status === "rejected"
          ? incidentResult.reason
          : new Error(incidentResult.value.message);
      setSessions(
        sessionResult.status === "fulfilled" && sessionResult.value.isSuccess
          ? sessionResult.value.result || []
          : [],
      );
      const loadedUsers =
        userResult.status === "fulfilled" && userResult.value.isSuccess
          ? userResult.value.result || []
          : [];
      if (userResult.status === "rejected") {
        setStaffError(
          userResult.reason instanceof Error
            ? userResult.reason.message
            : "Không thể tải danh sách người xử lý.",
        );
      } else if (!userResult.value.isSuccess) {
        setStaffError(
          userResult.value.message || "Không thể tải danh sách người xử lý.",
        );
      }
      setUsers(loadedUsers);
      setStaff(
        loadedUsers.filter(
          (user) =>
            ["staff", "manager"].includes(user.roleName.toLowerCase()) &&
            user.status.toLowerCase() === "active",
        ),
      );
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Không thể tải danh sách sự cố.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => void loadData());
  }, [loadData]);

  const filtered = useMemo(
    () =>
      incidents
        .filter((incident) => {
          if (
            statusFilter !== "all" &&
            normalize(incident.status) !== statusFilter
          )
            return false;
          if (assigneeFilter === "unassigned" && incident.handledByStaffId)
            return false;
          if (
            assigneeFilter !== "all" &&
            assigneeFilter !== "unassigned" &&
            incident.handledByStaffId !== assigneeFilter
          )
            return false;
          const term = query.trim().toLowerCase();
          if (!term) return true;
          return [
            incident.incidentId,
            incident.sessionId,
            incident.issueType,
            incident.description,
            incident.reportedByUserFullName,
            incident.handledByStaffFullName,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()
            .includes(term);
        })
        .sort((left, right) => {
          const rank: Record<string, number> = {
            open: 0,
            inprogress: 1,
            resolved: 2,
            cancelled: 3,
          };
          return (
            (rank[normalize(left.status)] ?? 4) -
            (rank[normalize(right.status)] ?? 4)
          );
        }),
    [assigneeFilter, incidents, query, statusFilter],
  );

  const sessionOf = (incident: IncidentReportDto) =>
    sessions.find((session) => session.sessionId === incident.sessionId);
  const counts = {
    open: incidents.filter((item) => normalize(item.status) === "open").length,
    progress: incidents.filter(
      (item) => normalize(item.status) === "inprogress",
    ).length,
    resolved: incidents.filter((item) => normalize(item.status) === "resolved")
      .length,
  };

  const updateIncident = async (
    incident: IncidentReportDto,
    changes: Partial<IncidentReportDto>,
  ) => {
    const response = await incidentReportApi.update({
      incidentId: incident.incidentId,
      sessionId: incident.sessionId,
      reportedByUserId: incident.reportedByUserId,
      issueType: incident.issueType,
      description: incident.description,
      proofImageUrl: incident.proofImageUrl,
      status: changes.status || incident.status,
      handledByStaffId: changes.handledByStaffId ?? incident.handledByStaffId,
      resolvedAt: incident.resolvedAt,
      resolutionNotes: changes.resolutionNotes ?? incident.resolutionNotes,
    });
    if (!response.isSuccess)
      throw new Error(response.message || "Không thể cập nhật sự cố.");
  };

  const assignIncident = async () => {
    if (!assignTarget || !assigneeId) return;
    setSaving(true);
    setError("");
    try {
      if (normalize(assignTarget.status) === "open") {
        const response = await incidentReportApi.assign(
          assignTarget.incidentId,
          assigneeId,
        );
        if (!response.isSuccess)
          throw new Error(response.message || "Không thể phân công sự cố.");
      } else
        await updateIncident(assignTarget, { handledByStaffId: assigneeId });
      setAssignTarget(null);
      setAssigneeId("");
      await loadData();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Không thể phân công sự cố.",
      );
    } finally {
      setSaving(false);
    }
  };

  const resolveIncident = async () => {
    if (!resolveTarget?.handledByStaffId || !resolutionNotes.trim()) return;
    setSaving(true);
    setError("");
    try {
      const response = await incidentReportApi.resolve(
        resolveTarget.incidentId,
        resolveTarget.handledByStaffId,
        resolutionNotes.trim(),
      );
      if (!response.isSuccess)
        throw new Error(response.message || "Không thể hoàn tất sự cố.");
      setResolveTarget(null);
      setResolutionNotes("");
      await loadData();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Không thể hoàn tất sự cố.",
      );
    } finally {
      setSaving(false);
    }
  };

  const createIncident = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      let proofImageUrl: string | undefined;
      if (proofFile)
        proofImageUrl = (await incidentReportApi.uploadProof(proofFile))
          .imageUrl;
      const response = await incidentReportApi.create({
        sessionId: createForm.sessionId || undefined,
        issueType: createForm.issueType,
        description: createForm.description.trim(),
        proofImageUrl,
      });
      if (!response.isSuccess)
        throw new Error(response.message || "Không thể tạo sự cố.");
      setCreateOpen(false);
      setCreateForm({ sessionId: "", issueType: "Other", description: "" });
      setProofFile(null);
      await loadData();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Không thể tạo sự cố.",
      );
    } finally {
      setSaving(false);
    }
  };

  const chooseProof = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    if (file && file.size > 5 * 1024 * 1024) {
      setError("Ảnh minh chứng không được vượt quá 5 MB.");
      event.target.value = "";
      setProofFile(null);
      return;
    }
    setError("");
    setProofFile(file);
  };

  const selectedSession = selected ? sessionOf(selected) : undefined;
  const selectedReporter = selected
    ? users.find((user) => user.userId === selected.reportedByUserId)
    : undefined;
  const selectedHandler = selected?.handledByStaffId
    ? users.find((user) => user.userId === selected.handledByStaffId)
    : undefined;
  const selectedStatus = normalize(selected?.status);

  return (
    <ManagerPageShell activeItem="incidents">
      <div className="staff-content-wrapper manager-resource-page manager-incident-page">
        <header className="manager-resource-header">
          <div className="manager-resource-title">
            <span className="manager-resource-icon manager-resource-icon--orange">
              <AlertTriangle size={24} />
            </span>
            <div>
              <h2>Quản lý sự cố</h2>
              <p>
                Giám sát, phân công và kiểm tra kết quả xử lý sự cố toàn hệ
                thống.
              </p>
            </div>
          </div>
          <div className="manager-header-actions">
            <button
              className="btn btn-outline"
              onClick={() => void loadData()}
              disabled={loading}
            >
              <RefreshCw size={17} className={loading ? "spin" : ""} /> Làm mới
            </button>
            <button
              className="btn btn-primary"
              onClick={() => setCreateOpen(true)}
            >
              <Plus size={17} /> Tạo sự cố
            </button>
          </div>
        </header>
        <section className="manager-summary-grid manager-summary-grid--four">
          <article className="manager-summary-card">
            <span>Tổng sự cố</span>
            <strong>{incidents.length}</strong>
            <small>Tất cả báo cáo</small>
          </article>
          <article className="manager-summary-card manager-summary-card--orange">
            <span>Chờ tiếp nhận</span>
            <strong>{counts.open}</strong>
            <small>Cần phân công</small>
          </article>
          <article className="manager-summary-card manager-summary-card--accent">
            <span>Đang xử lý</span>
            <strong>{counts.progress}</strong>
            <small>Staff đang phụ trách</small>
          </article>
          <article className="manager-summary-card manager-summary-card--green">
            <span>Đã hoàn tất</span>
            <strong>{counts.resolved}</strong>
            <small>Đã có kết quả</small>
          </article>
        </section>
        <section className="card-panel manager-resource-panel">
          <div className="manager-resource-toolbar manager-resource-toolbar--wrap">
            <label className="manager-search-field">
              <Search size={18} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Tìm nội dung, người báo cáo, staff hoặc mã phiên..."
              />
              {query && (
                <button onClick={() => setQuery("")} aria-label="Xóa">
                  <X size={16} />
                </button>
              )}
            </label>
            <div className="manager-filter-controls">
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
              >
                <option value="all">Tất cả trạng thái</option>
                <option value="open">Chờ tiếp nhận</option>
                <option value="inprogress">Đang xử lý</option>
                <option value="resolved">Đã hoàn tất</option>
                <option value="cancelled">Đã hủy</option>
              </select>
              <select
                value={assigneeFilter}
                onChange={(event) => setAssigneeFilter(event.target.value)}
              >
                <option value="all">Tất cả người xử lý</option>
                <option value="unassigned">Chưa phân công</option>
                {staff.map((user) => (
                  <option key={user.userId} value={user.userId}>
                    {user.fullName}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {error && <div className="manager-inline-error">{error}</div>}
          {loading && incidents.length === 0 ? (
            <div className="manager-empty-state">
              Đang tải danh sách sự cố...
            </div>
          ) : filtered.length === 0 ? (
            <div className="manager-empty-state">
              <ShieldCheck size={35} />
              <strong>Không có sự cố phù hợp</strong>
            </div>
          ) : (
            <div className="staff-incident-list">
              {filtered.map((incident) => {
                const status = normalize(incident.status);
                const session = sessionOf(incident);
                return (
                  <article
                    key={incident.incidentId}
                    className={`staff-incident-card status-${status}`}
                  >
                    <div className="staff-incident-icon">
                      <AlertTriangle size={21} />
                    </div>
                    <div className="staff-incident-main">
                      <div className="staff-incident-title">
                        <div>
                          <strong>{issueLabel(incident.issueType)}</strong>
                          <small>
                            {session
                              ? `${session.licensePlateIn} · ${session.vehicleTypeName || "Chưa rõ loại xe"}`
                              : incident.sessionId
                                ? `Phiên ${incident.sessionId.slice(0, 8).toUpperCase()}`
                                : "Không gắn phiên"}
                          </small>
                        </div>
                        <span
                          className={`manager-session-status status-${status}`}
                        >
                          <i />
                          {statusLabel(incident.status)}
                        </span>
                      </div>
                      <p>{incident.description}</p>
                      <div className="staff-incident-meta">
                        <span>
                          Người báo cáo:{" "}
                          <strong>
                            {incident.reportedByUserFullName || "Chưa rõ"}
                          </strong>
                        </span>
                        <span>
                          Phụ trách:{" "}
                          <strong>
                            {incident.handledByStaffFullName ||
                              "Chưa phân công"}
                          </strong>
                        </span>
                        {incident.resolvedAt && (
                          <span>
                            Hoàn tất:{" "}
                            <strong>
                              {formatUtcToVietnamDateTime(incident.resolvedAt)}
                            </strong>
                          </span>
                        )}
                      </div>
                      {incident.resolutionNotes && (
                        <div className="staff-incident-resolution">
                          <CheckCircle2 size={15} />
                          {incident.resolutionNotes}
                        </div>
                      )}
                    </div>
                    <div className="staff-incident-actions">
                      <button
                        className="btn btn-outline btn-sm"
                        onClick={() => setSelected(incident)}
                      >
                        <Eye size={15} /> Chi tiết
                      </button>
                      {status !== "resolved" && status !== "cancelled" && (
                        <button
                          className="btn btn-outline btn-sm"
                          onClick={() => {
                            setAssignTarget(incident);
                            setAssigneeId(incident.handledByStaffId || "");
                          }}
                        >
                          <UserRound size={15} />{" "}
                          {incident.handledByStaffId
                            ? "Chuyển giao"
                            : "Phân công"}
                        </button>
                      )}
                      {status === "inprogress" && incident.handledByStaffId && (
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => {
                            setResolveTarget(incident);
                            setResolutionNotes("");
                          }}
                        >
                          <CheckCircle2 size={15} /> Hoàn tất
                        </button>
                      )}
                      <button
                        className="btn btn-ghost btn-sm manager-incident-delete"
                        onClick={() => setDeleteTarget(incident)}
                      >
                        <Trash2 size={15} /> Xóa
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {selected && (
        <div
          className="modal-overlay"
          onClick={(event) =>
            event.target === event.currentTarget && setSelected(null)
          }
        >
          <div className="modal-panel manager-form-modal manager-incident-detail-modal">
            <div className="manager-modal-header">
              <div>
                <div className="manager-incident-detail-title-row">
                  <h3 className="modal-title">Chi tiết sự cố</h3>
                  <span
                    className={`manager-session-status status-${selectedStatus}`}
                  >
                    <i />
                    {statusLabel(selected.status)}
                  </span>
                </div>
                <p>
                  {issueLabel(selected.issueType)} · Mã{" "}
                  {selected.incidentId.slice(0, 8).toUpperCase()}
                </p>
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setSelected(null)}
                aria-label="Đóng"
              >
                <X size={20} />
              </button>
            </div>
            <section className="manager-incident-detail-section">
              <h4>Thông tin báo cáo</h4>
              <div className="manager-incident-detail-grid">
                <div>
                  <span>Loại sự cố</span>
                  <strong>{issueLabel(selected.issueType)}</strong>
                </div>
                <div>
                  <span>Người phụ trách</span>
                  <strong>
                    {selected.handledByStaffFullName || "Chưa phân công"}
                  </strong>
                </div>
                <div>
                  <span>Người báo cáo</span>
                  <strong>
                    {selected.reportedByUserFullName || "Chưa rõ"}
                  </strong>
                </div>
                <div>
                  <span>Số điện thoại</span>
                  <strong>
                    {selectedReporter?.phoneNumber || "Chưa cập nhật"}
                  </strong>
                </div>
                <div>
                  <span>Liên hệ người xử lý</span>
                  <strong>
                    {selectedHandler?.phoneNumber || "Chưa phân công"}
                  </strong>
                </div>
                <div className="form-field--full">
                  <span>Email người báo cáo</span>
                  <strong>{selectedReporter?.email || "Chưa cập nhật"}</strong>
                </div>
                <div className="form-field--full manager-incident-description-box">
                  <span>Mô tả</span>
                  <strong>{selected.description}</strong>
                </div>
              </div>
            </section>

            <section className="manager-incident-detail-section">
              <h4>Phiên gửi xe liên quan</h4>
              {selectedSession ? (
                <div className="manager-incident-detail-grid">
                  <div>
                    <span>Biển số vào</span>
                    <strong>{selectedSession.licensePlateIn}</strong>
                  </div>
                  <div>
                    <span>Loại phương tiện</span>
                    <strong>
                      {selectedSession.vehicleTypeName || "Chưa rõ"}
                    </strong>
                  </div>
                  <div>
                    <span>Khách gửi xe</span>
                    <strong>
                      {selectedSession.driverFullName || "Khách vãng lai"}
                    </strong>
                  </div>
                  <div>
                    <span>Trạng thái phiên</span>
                    <strong>{selectedSession.status}</strong>
                  </div>
                  <div>
                    <span>Thời gian vào</span>
                    <strong>
                      {formatUtcToVietnamDateTime(selectedSession.entryTime)}
                    </strong>
                  </div>
                  <div>
                    <span>Thời gian ra</span>
                    <strong>
                      {selectedSession.exitTime
                        ? formatUtcToVietnamDateTime(selectedSession.exitTime)
                        : "Xe chưa ra"}
                    </strong>
                  </div>
                  <div>
                    <span>Cổng vào</span>
                    <strong>
                      {selectedSession.entryGateName || "Chưa rõ"}
                    </strong>
                  </div>
                  <div>
                    <span>Vị trí đỗ</span>
                    <strong>
                      {selectedSession.actualSlotCode ||
                        selectedSession.assignedSlotCode ||
                        "Chưa gán"}
                    </strong>
                  </div>
                  {typeof selectedSession.paymentAmount === "number" && (
                    <div>
                      <span>Phí gửi xe</span>
                      <strong>
                        {selectedSession.paymentAmount.toLocaleString("vi-VN")}{" "}
                        đ
                      </strong>
                    </div>
                  )}
                  {selectedSession.paymentStatus && (
                    <div>
                      <span>Thanh toán</span>
                      <strong>{selectedSession.paymentStatus}</strong>
                    </div>
                  )}
                </div>
              ) : (
                <div className="manager-incident-no-session">
                  Báo cáo này không gắn với phiên gửi xe cụ thể.
                </div>
              )}
            </section>

            <section className="manager-incident-detail-section">
              <h4>Ảnh minh chứng và kết quả xử lý</h4>
              {selected.proofImageUrl ? (
                <a
                  className="manager-incident-proof"
                  href={selected.proofImageUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  <img
                    src={selected.proofImageUrl}
                    alt="Ảnh minh chứng sự cố"
                  />
                  <span>
                    <ExternalLink size={16} /> Mở ảnh đầy đủ
                  </span>
                </a>
              ) : (
                <div className="manager-incident-no-proof">
                  <ImageOff size={26} />
                  <div>
                    <strong>Chưa có ảnh minh chứng</strong>
                    <span>Người báo cáo không đính kèm ảnh cho sự cố này.</span>
                  </div>
                </div>
              )}
              {selected.resolutionNotes && (
                <div className="manager-incident-resolution-detail">
                  <CheckCircle2 size={18} />
                  <div>
                    <strong>Kết quả xử lý</strong>
                    <p>{selected.resolutionNotes}</p>
                    {selected.resolvedAt && (
                      <small>
                        Hoàn tất lúc{" "}
                        {formatUtcToVietnamDateTime(selected.resolvedAt)}
                      </small>
                    )}
                  </div>
                </div>
              )}
            </section>

            <div className="manager-incident-detail-actions">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setSelected(null)}
              >
                Đóng
              </button>
              {selectedStatus !== "resolved" && (
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => {
                    setAssignTarget(selected);
                    setAssigneeId(selected.handledByStaffId || "");
                    setSelected(null);
                  }}
                >
                  <UserRound size={16} />
                  {selected.handledByStaffId
                    ? "Chuyển người xử lý"
                    : "Phân công xử lý"}
                </button>
              )}
              {selectedStatus === "inprogress" && selected.handledByStaffId && (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    setResolveTarget(selected);
                    setResolutionNotes("");
                    setSelected(null);
                  }}
                >
                  <CheckCircle2 size={16} />
                  Hoàn tất sự cố
                </button>
              )}
            </div>
          </div>
        </div>
      )}
      {assignTarget && (
        <div className="modal-overlay">
          <div className="modal-panel manager-form-modal manager-incident-action-modal">
            <div className="manager-modal-header">
              <div>
                <h3 className="modal-title">
                  {assignTarget.handledByStaffId
                    ? "Chuyển người xử lý"
                    : "Phân công sự cố"}
                </h3>
                <p>{issueLabel(assignTarget.issueType)}</p>
              </div>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setAssignTarget(null)}
                disabled={saving}
              >
                <X size={20} />
              </button>
            </div>
            <div className="form-field">
              <label>Nhân viên phụ trách *</label>
              <select
                value={assigneeId}
                onChange={(event) => setAssigneeId(event.target.value)}
                disabled={saving || Boolean(staffError) || staff.length === 0}
              >
                <option value="">
                  {staffError
                    ? "Không tải được danh sách nhân viên"
                    : staff.length === 0
                      ? "Không có nhân viên đang hoạt động"
                      : "Chọn nhân viên"}
                </option>
                {staff.map((user) => (
                  <option key={user.userId} value={user.userId}>
                    {user.fullName} · {user.roleName}
                  </option>
                ))}
              </select>
            </div>
            {staffError && (
              <div className="manager-inline-error" role="alert">
                {staffError} Hãy làm mới trang sau khi kiểm tra kết nối.
              </div>
            )}
            <div className="form-actions">
              <button
                className="btn btn-ghost"
                onClick={() => setAssignTarget(null)}
                disabled={saving}
              >
                Hủy
              </button>
              <button
                className="btn btn-primary"
                onClick={() => void assignIncident()}
                disabled={saving || !assigneeId}
              >
                {saving && <Loader2 size={17} className="spin" />}
                {assignTarget.handledByStaffId
                  ? "Xác nhận chuyển giao"
                  : "Xác nhận phân công"}
              </button>
            </div>
          </div>
        </div>
      )}
      {resolveTarget && (
        <div className="modal-overlay">
          <div className="modal-panel manager-form-modal manager-incident-action-modal">
            <div className="manager-modal-header">
              <div>
                <h3 className="modal-title">Hoàn tất sự cố</h3>
                <p>{resolveTarget.handledByStaffFullName}</p>
              </div>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setResolveTarget(null)}
                disabled={saving}
              >
                <X size={20} />
              </button>
            </div>
            <div className="form-field">
              <label>Kết quả xử lý *</label>
              <textarea
                rows={5}
                value={resolutionNotes}
                onChange={(event) => setResolutionNotes(event.target.value)}
                placeholder="Ghi rõ cách xử lý và kết quả kiểm tra..."
              />
            </div>
            <div className="form-actions">
              <button
                className="btn btn-ghost"
                onClick={() => setResolveTarget(null)}
                disabled={saving}
              >
                Hủy
              </button>
              <button
                className="btn btn-primary"
                onClick={() => void resolveIncident()}
                disabled={saving || !resolutionNotes.trim()}
              >
                {saving && <Loader2 size={17} className="spin" />}Xác nhận hoàn
                tất
              </button>
            </div>
          </div>
        </div>
      )}
      {createOpen && (
        <div className="modal-overlay">
          <div className="modal-panel manager-form-modal manager-incident-action-modal">
            <div className="manager-modal-header">
              <div>
                <h3 className="modal-title">Tạo sự cố mới</h3>
                <p>Ghi nhận sự cố do manager phát hiện.</p>
              </div>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setCreateOpen(false)}
                disabled={saving}
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={createIncident}>
              <div className="form-field">
                <label>Phiên gửi xe</label>
                <select
                  value={createForm.sessionId}
                  onChange={(event) =>
                    setCreateForm({
                      ...createForm,
                      sessionId: event.target.value,
                    })
                  }
                >
                  <option value="">Không gắn phiên</option>
                  {sessions.map((session) => (
                    <option key={session.sessionId} value={session.sessionId}>
                      {session.licensePlateIn} ·{" "}
                      {formatUtcToVietnamDateTime(session.entryTime)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-field">
                <label>Loại sự cố *</label>
                <select
                  value={createForm.issueType}
                  onChange={(event) =>
                    setCreateForm({
                      ...createForm,
                      issueType: event.target.value,
                    })
                  }
                >
                  {ISSUE_TYPES.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-field">
                <label>Mô tả *</label>
                <textarea
                  rows={5}
                  value={createForm.description}
                  onChange={(event) =>
                    setCreateForm({
                      ...createForm,
                      description: event.target.value,
                    })
                  }
                />
              </div>
              <div className="form-field">
                <label>Ảnh minh chứng</label>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={chooseProof}
                />
              </div>
              <div className="form-actions">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setCreateOpen(false)}
                  disabled={saving}
                >
                  Hủy
                </button>
                <button
                  className="btn btn-primary"
                  disabled={saving || !createForm.description.trim()}
                >
                  {saving && <Loader2 size={17} className="spin" />}Tạo sự cố
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      <ManagerConfirmActionModal
        open={Boolean(deleteTarget)}
        title="Xóa báo cáo sự cố?"
        description="Dữ liệu báo cáo và kết quả xử lý sẽ bị xóa khỏi hệ thống."
        targetLabel={deleteTarget ? issueLabel(deleteTarget.issueType) : ""}
        confirmLabel="Xóa báo cáo"
        loadingLabel="Đang xóa..."
        onCancel={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (!deleteTarget) return;
          const response = await incidentReportApi.remove(
            deleteTarget.incidentId,
          );
          if (!response.isSuccess)
            throw new Error(response.message || "Không thể xóa sự cố.");
          setDeleteTarget(null);
          await loadData();
        }}
      />
    </ManagerPageShell>
  );
}
