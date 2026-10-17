import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  ExternalLink,
  Eye,
  ImageOff,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  UserCheck,
  X,
} from "lucide-react";
import StaffPageShell from "../../components/StaffPageShell";
import { useAuth } from "../../context/AuthContext";
import { ApiRequestError } from "../../config/api";
import {
  incidentReportApi,
  parkingSlotApi,
  parkingSessionApi,
  type IncidentReportDto,
  type ParkingSessionDto,
} from "../../utils/apiServices";
import {
  formatUtcToVietnamDateTime,
  parseBackendUtcDate,
} from "../../utils/dateTime";

const ISSUE_TYPES = [
  { value: "LostTicket", label: "Mất vé / mất mã QR" },
  { value: "PlateMismatch", label: "Biển số không khớp" },
  { value: "PaymentIssue", label: "Vấn đề thanh toán" },
  { value: "SlotIssue", label: "Vấn đề vị trí đỗ xe" },
  { value: "VehicleDamage", label: "Xe hư hỏng hoặc va quẹt" },
  { value: "OverdueVehicle", label: "Xe gửi quá hạn" },
  { value: "WrongZone", label: "Xe gửi sai khu vực" },
  { value: "Other", label: "Sự cố khác" },
];

const STATUS_LABELS: Record<string, string> = {
  open: "Chờ tiếp nhận",
  inprogress: "Đang xử lý",
  resolved: "Đã hoàn tất",
  cancelled: "Đã hủy",
};

function normalize(value?: string) {
  return (value || "").replace(/[\s_-]/g, "").toLowerCase();
}

function statusLabel(value?: string) {
  return STATUS_LABELS[normalize(value)] ?? value ?? "Không rõ";
}

function issueLabel(value?: string) {
  return (
    ISSUE_TYPES.find((item) => normalize(item.value) === normalize(value))
      ?.label ??
    value ??
    "Sự cố khác"
  );
}

export default function Exception() {
  const { user } = useAuth();
  const [incidents, setIncidents] = useState<IncidentReportDto[]>([]);
  const [sessions, setSessions] = useState<ParkingSessionDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selected, setSelected] = useState<IncidentReportDto | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({
    sessionId: "",
    issueType: "LostTicket",
    description: "",
  });
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [resolveTarget, setResolveTarget] = useState<IncidentReportDto | null>(
    null,
  );
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [slotStatus, setSlotStatus] = useState("");

  const resolveSession = resolveTarget?.sessionId
    ? sessions.find((session) => session.sessionId === resolveTarget.sessionId)
    : undefined;
  const resolveSlotId =
    resolveSession?.actualSlotId || resolveSession?.assignedSlotId;
  const resolveSlotCode =
    resolveSession?.actualSlotCode || resolveSession?.assignedSlotCode;

  const openResolve = (incident: IncidentReportDto) => {
    setSlotStatus("");
    setResolveTarget(incident);
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    const [incidentResult, sessionResult] = await Promise.allSettled([
      incidentReportApi.getAll(),
      parkingSessionApi.getAll(),
    ]);

    if (
      incidentResult.status === "fulfilled" &&
      incidentResult.value.isSuccess
    ) {
      setIncidents(incidentResult.value.result ?? []);
    } else if (
      incidentResult.status === "rejected" &&
      !(
        incidentResult.reason instanceof ApiRequestError &&
        incidentResult.reason.statusCode === 404
      )
    ) {
      setError(
        incidentResult.reason instanceof Error
          ? incidentResult.reason.message
          : "Không thể tải danh sách sự cố.",
      );
      setIncidents([]);
    } else {
      setIncidents([]);
    }

    if (sessionResult.status === "fulfilled" && sessionResult.value.isSuccess) {
      setSessions(sessionResult.value.result ?? []);
    } else {
      setSessions([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    queueMicrotask(() => void loadData());
  }, [loadData]);

  const filteredIncidents = useMemo(() => {
    const term = query.trim().toLowerCase();
    return incidents
      .filter((incident) => {
        if (
          statusFilter !== "all" &&
          normalize(incident.status) !== statusFilter
        )
          return false;
        if (!term) return true;
        return [
          incident.issueType,
          incident.description,
          incident.reportedByUserFullName,
          incident.handledByStaffFullName,
          incident.incidentId,
          incident.sessionId,
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
        const statusDifference =
          (rank[normalize(left.status)] ?? 4) -
          (rank[normalize(right.status)] ?? 4);
        if (statusDifference !== 0) return statusDifference;
        const leftTime = left.resolvedAt
          ? parseBackendUtcDate(left.resolvedAt).getTime()
          : 0;
        const rightTime = right.resolvedAt
          ? parseBackendUtcDate(right.resolvedAt).getTime()
          : 0;
        return rightTime - leftTime;
      });
  }, [incidents, query, statusFilter]);

  const createIncident = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user?.userId) {
      setActionError("Không xác định được tài khoản staff từ phiên đăng nhập.");
      return;
    }
    setSaving(true);
    setActionError("");
    try {
      let proofImageUrl: string | undefined;
      if (proofFile)
        proofImageUrl = (await incidentReportApi.uploadProof(proofFile))
          .imageUrl;
      const response = await incidentReportApi.create({
        sessionId: form.sessionId || undefined,
        reportedByUserId: user.userId,
        issueType: form.issueType,
        description: form.description.trim(),
        proofImageUrl,
        status: "Open",
      });
      if (!response.isSuccess)
        throw new Error(response.message || "Không thể tạo báo cáo sự cố.");
      setCreateOpen(false);
      setForm({ sessionId: "", issueType: "LostTicket", description: "" });
      setProofFile(null);
      await loadData();
    } catch (requestError) {
      setActionError(
        requestError instanceof Error
          ? requestError.message
          : "Không thể tạo báo cáo sự cố.",
      );
    } finally {
      setSaving(false);
    }
  };

  const assignToMe = async (incident: IncidentReportDto) => {
    if (!user?.userId) return;
    setSaving(true);
    setActionError("");
    try {
      const response = await incidentReportApi.assign(
        incident.incidentId,
        user.userId,
      );
      if (!response.isSuccess)
        throw new Error(response.message || "Không thể tiếp nhận sự cố.");
      await loadData();
    } catch (requestError) {
      setActionError(
        requestError instanceof Error
          ? requestError.message
          : "Không thể tiếp nhận sự cố.",
      );
    } finally {
      setSaving(false);
    }
  };

  const resolveIncident = async () => {
    if (!resolveTarget || !user?.userId) return;
    setSaving(true);
    setActionError("");
    try {
      if (resolveSlotId && slotStatus) {
        const slotResponse = await parkingSlotApi.updateStatus(
          resolveSlotId,
          slotStatus,
        );
        if (!slotResponse.isSuccess)
          throw new Error(
            slotResponse.message || "Không thể cập nhật trạng thái slot.",
          );
      }
      const response = await incidentReportApi.resolve(
        resolveTarget.incidentId,
        user.userId,
        resolutionNotes.trim(),
      );
      if (!response.isSuccess)
        throw new Error(response.message || "Không thể hoàn tất sự cố.");
      setResolveTarget(null);
      setResolutionNotes("");
      setSlotStatus("");
      await loadData();
    } catch (requestError) {
      setActionError(
        requestError instanceof Error
          ? requestError.message
          : "Không thể hoàn tất sự cố.",
      );
    } finally {
      setSaving(false);
    }
  };

  const openCount = incidents.filter(
    (item) => normalize(item.status) === "open",
  ).length;
  const inProgressCount = incidents.filter(
    (item) => normalize(item.status) === "inprogress",
  ).length;
  const myCount = incidents.filter(
    (item) =>
      item.handledByStaffId === user?.userId &&
      normalize(item.status) !== "resolved",
  ).length;

  return (
    <StaffPageShell activeItem="exception">
      <div className="staff-content-wrapper staff-manager-page manager-resource-page staff-incident-page">
        <header className="manager-resource-header">
          <div className="manager-resource-title">
            <span className="manager-resource-icon manager-resource-icon--orange">
              <AlertTriangle size={24} aria-hidden />
            </span>
            <div>
              <h2>Xử lý sự cố vận hành</h2>
              <p>
                Tạo báo cáo, tiếp nhận và ghi nhận kết quả xử lý các ngoại lệ
                tại bãi xe.
              </p>
            </div>
          </div>
          <div className="manager-header-actions">
            <button
              type="button"
              className="btn btn-outline"
              onClick={loadData}
              disabled={loading}
            >
              <RefreshCw
                size={17}
                className={loading ? "spin" : ""}
                aria-hidden
              />{" "}
              Làm mới
            </button>
            <button
              type="button"
              className="btn btn-primary manager-add-button"
              onClick={() => {
                setActionError("");
                setCreateOpen(true);
              }}
            >
              <Plus size={17} aria-hidden /> Báo cáo sự cố
            </button>
          </div>
        </header>

        <section className="manager-summary-grid manager-summary-grid--four">
          <article className="manager-summary-card">
            <span>Tổng sự cố</span>
            <strong>{incidents.length}</strong>
            <small>Tất cả báo cáo hệ thống</small>
          </article>
          <article className="manager-summary-card manager-summary-card--orange">
            <span>Chờ tiếp nhận</span>
            <strong>{openCount}</strong>
            <small>Chưa có người phụ trách</small>
          </article>
          <article className="manager-summary-card manager-summary-card--accent">
            <span>Đang xử lý</span>
            <strong>{inProgressCount}</strong>
            <small>Đã có staff tiếp nhận</small>
          </article>
          <article className="manager-summary-card manager-summary-card--green">
            <span>Việc của tôi</span>
            <strong>{myCount}</strong>
            <small>Sự cố tôi đang phụ trách</small>
          </article>
        </section>

        <section className="card-panel manager-resource-panel">
          <div className="manager-resource-toolbar manager-resource-toolbar--wrap">
            <label className="manager-search-field">
              <Search size={18} aria-hidden />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Tìm loại sự cố, mô tả, người báo cáo hoặc mã phiên..."
              />
              {query && (
                <button
                  type="button"
                  aria-label="Xóa tìm kiếm"
                  onClick={() => setQuery("")}
                >
                  <X size={16} aria-hidden />
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
            </div>
          </div>
          {error && (
            <div className="manager-inline-error" role="alert">
              {error}
            </div>
          )}
          {actionError && !createOpen && !resolveTarget && (
            <div className="manager-inline-error" role="alert">
              {actionError}
            </div>
          )}

          {loading && incidents.length === 0 ? (
            <div className="manager-empty-state">
              Đang tải danh sách sự cố...
            </div>
          ) : filteredIncidents.length === 0 ? (
            <div className="manager-empty-state">
              <ShieldCheck size={35} aria-hidden />
              <strong>Không có sự cố phù hợp</strong>
              <span>Ca trực hiện không có báo cáo cần hiển thị.</span>
            </div>
          ) : (
            <div className="staff-incident-list">
              {filteredIncidents.map((incident) => {
                const status = normalize(incident.status);
                const assignedToMe = incident.handledByStaffId === user?.userId;
                const session = sessions.find(
                  (item) => item.sessionId === incident.sessionId,
                );
                return (
                  <article
                    key={incident.incidentId}
                    className={`staff-incident-card status-${status}`}
                  >
                    <div className="staff-incident-icon">
                      <AlertTriangle size={21} aria-hidden />
                    </div>
                    <div className="staff-incident-main">
                      <div className="staff-incident-title">
                        <div>
                          <strong>{issueLabel(incident.issueType)}</strong>
                          <small>
                            {session
                              ? `${session.licensePlateIn} · ${session.vehicleTypeName || "Chưa rõ loại xe"}`
                              : incident.sessionId
                                ? `Phiên ${incident.sessionId.slice(0, 8)}…`
                                : "Không gắn phiên gửi xe"}
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
                              "Chưa tiếp nhận"}
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
                          <CheckCircle2 size={15} aria-hidden />{" "}
                          {incident.resolutionNotes}
                        </div>
                      )}
                    </div>
                    <div className="staff-incident-actions">
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        onClick={() => setSelected(incident)}
                      >
                        <Eye size={15} aria-hidden /> Chi tiết
                      </button>
                      {status === "open" && (
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          onClick={() => void assignToMe(incident)}
                          disabled={saving || !user?.userId}
                        >
                          <UserCheck size={15} aria-hidden /> Tiếp nhận
                        </button>
                      )}
                      {status === "inprogress" && assignedToMe && (
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          onClick={() => {
                            setActionError("");
                            setResolutionNotes("");
                            openResolve(incident);
                          }}
                        >
                          <CheckCircle2 size={15} aria-hidden /> Hoàn tất
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {selected &&
        (() => {
          const status = normalize(selected.status);
          const assignedToMe = selected.handledByStaffId === user?.userId;
          const session = sessions.find(
            (item) => item.sessionId === selected.sessionId,
          );
          return (
            <div
              className="modal-overlay"
              onClick={(event) =>
                event.target === event.currentTarget && setSelected(null)
              }
            >
              <div
                className="modal-panel manager-form-modal manager-incident-detail-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="staff-incident-detail-title"
              >
                <div className="manager-modal-header">
                  <div>
                    <div className="manager-incident-detail-title-row">
                      <h3
                        id="staff-incident-detail-title"
                        className="modal-title"
                      >
                        Chi tiết sự cố
                      </h3>
                      <span
                        className={`manager-session-status status-${status}`}
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
                    aria-label="Đóng"
                    onClick={() => setSelected(null)}
                  >
                    <X size={20} aria-hidden />
                  </button>
                </div>

                <section className="manager-incident-detail-section">
                  <h4>Thông tin báo cáo</h4>
                  <div className="manager-incident-detail-grid">
                    <div>
                      <span>Mã sự cố</span>
                      <strong>{selected.incidentId}</strong>
                    </div>
                    <div>
                      <span>Loại sự cố</span>
                      <strong>{issueLabel(selected.issueType)}</strong>
                    </div>
                    <div>
                      <span>Người báo cáo</span>
                      <strong>
                        {selected.reportedByUserFullName || "Chưa rõ"}
                      </strong>
                    </div>
                    <div>
                      <span>Người phụ trách</span>
                      <strong>
                        {selected.handledByStaffFullName || "Chưa tiếp nhận"}
                      </strong>
                    </div>
                    <div className="form-field--full manager-incident-description-box">
                      <span>Mô tả chi tiết</span>
                      <strong>{selected.description}</strong>
                    </div>
                  </div>
                </section>

                <section className="manager-incident-detail-section">
                  <h4>Phiên gửi xe liên quan</h4>
                  {session ? (
                    <div className="manager-incident-detail-grid">
                      <div>
                        <span>Biển số vào</span>
                        <strong>{session.licensePlateIn}</strong>
                      </div>
                      <div>
                        <span>Biển số ra</span>
                        <strong>
                          {session.licensePlateOut || "Xe chưa ra"}
                        </strong>
                      </div>
                      <div>
                        <span>Loại phương tiện</span>
                        <strong>{session.vehicleTypeName || "Chưa rõ"}</strong>
                      </div>
                      <div>
                        <span>Khách gửi xe</span>
                        <strong>
                          {session.driverFullName || "Khách vãng lai"}
                        </strong>
                      </div>
                      <div>
                        <span>Thời gian vào</span>
                        <strong>
                          {formatUtcToVietnamDateTime(session.entryTime)}
                        </strong>
                      </div>
                      <div>
                        <span>Thời gian ra</span>
                        <strong>
                          {session.exitTime
                            ? formatUtcToVietnamDateTime(session.exitTime)
                            : "Xe chưa ra"}
                        </strong>
                      </div>
                      <div>
                        <span>Cổng vào</span>
                        <strong>{session.entryGateName || "Chưa rõ"}</strong>
                      </div>
                      <div>
                        <span>Cổng ra</span>
                        <strong>{session.exitGateName || "Chưa có"}</strong>
                      </div>
                      <div>
                        <span>Vị trí đỗ</span>
                        <strong>
                          {session.actualSlotCode ||
                            session.assignedSlotCode ||
                            "Chưa gán"}
                        </strong>
                      </div>
                      <div>
                        <span>Trạng thái phiên</span>
                        <strong>{session.status}</strong>
                      </div>
                      {typeof session.paymentAmount === "number" && (
                        <div>
                          <span>Phí gửi xe</span>
                          <strong>
                            {session.paymentAmount.toLocaleString("vi-VN")} đ
                          </strong>
                        </div>
                      )}
                      {session.paymentStatus && (
                        <div>
                          <span>Thanh toán</span>
                          <strong>{session.paymentStatus}</strong>
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
                      <ImageOff size={26} aria-hidden />
                      <div>
                        <strong>Chưa có ảnh minh chứng</strong>
                        <span>
                          Người báo cáo không đính kèm ảnh cho sự cố này.
                        </span>
                      </div>
                    </div>
                  )}
                  {selected.resolutionNotes && (
                    <div className="manager-incident-resolution-detail">
                      <CheckCircle2 size={18} aria-hidden />
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
                  {status === "open" && (
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => {
                        setSelected(null);
                        void assignToMe(selected);
                      }}
                      disabled={saving || !user?.userId}
                    >
                      <UserCheck size={16} />
                      Tiếp nhận xử lý
                    </button>
                  )}
                  {status === "inprogress" && assignedToMe && (
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => {
                        setSelected(null);
                        setActionError("");
                        setResolutionNotes("");
                        openResolve(selected);
                      }}
                    >
                      <CheckCircle2 size={16} />
                      Hoàn tất sự cố
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })()}

      {createOpen && (
        <div
          className="modal-overlay"
          onClick={(event) =>
            event.target === event.currentTarget &&
            !saving &&
            setCreateOpen(false)
          }
        >
          <div
            className="modal-panel manager-form-modal staff-incident-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="incident-create-title"
          >
            <div className="manager-modal-header">
              <div>
                <h3 id="incident-create-title" className="modal-title">
                  Báo cáo sự cố mới
                </h3>
                <p>
                  Gắn với phiên gửi xe nếu sự cố liên quan đến một xe cụ thể.
                </p>
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                aria-label="Đóng"
                onClick={() => setCreateOpen(false)}
                disabled={saving}
              >
                <X size={20} aria-hidden />
              </button>
            </div>
            <form onSubmit={createIncident}>
              <div className="form-grid-2">
                <div className="form-field">
                  <label htmlFor="incident-type">Loại sự cố *</label>
                  <select
                    id="incident-type"
                    autoFocus
                    required
                    value={form.issueType}
                    onChange={(event) =>
                      setForm({ ...form, issueType: event.target.value })
                    }
                  >
                    {ISSUE_TYPES.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-field">
                  <label htmlFor="incident-session">
                    Phiên gửi xe liên quan
                  </label>
                  <select
                    id="incident-session"
                    value={form.sessionId}
                    onChange={(event) =>
                      setForm({ ...form, sessionId: event.target.value })
                    }
                  >
                    <option value="">Không gắn phiên</option>
                    {sessions.map((session) => (
                      <option key={session.sessionId} value={session.sessionId}>
                        {session.licensePlateIn} ·{" "}
                        {session.vehicleTypeName || "Chưa rõ loại xe"} ·{" "}
                        {formatUtcToVietnamDateTime(session.entryTime)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-field form-field--full">
                  <label htmlFor="incident-description">Mô tả chi tiết *</label>
                  <textarea
                    id="incident-description"
                    rows={4}
                    required
                    maxLength={1000}
                    value={form.description}
                    onChange={(event) =>
                      setForm({ ...form, description: event.target.value })
                    }
                    placeholder="Mô tả tình huống, thông tin đã kiểm tra và hỗ trợ cần thiết..."
                  />
                  <small className="field-hint">
                    {form.description.length}/1000 ký tự
                  </small>
                </div>
                <div className="form-field form-field--full">
                  <label htmlFor="incident-proof">Ảnh minh chứng</label>
                  <label
                    className="user-incident-upload"
                    htmlFor="incident-proof"
                  >
                    <Camera size={20} aria-hidden />
                    <span>
                      {proofFile?.name ||
                        "Chọn ảnh JPG, PNG hoặc WEBP (tối đa 5 MB)"}
                    </span>
                  </label>
                  <input
                    id="incident-proof"
                    className="sr-only"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(event) => {
                      const file = event.target.files?.[0] || null;
                      if (file && file.size > 5 * 1024 * 1024) {
                        setActionError(
                          "Ảnh minh chứng không được vượt quá 5 MB.",
                        );
                        event.target.value = "";
                        setProofFile(null);
                        return;
                      }
                      setActionError("");
                      setProofFile(file);
                    }}
                  />
                </div>
              </div>
              {actionError && (
                <div className="manager-inline-error" role="alert">
                  {actionError}
                </div>
              )}
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
                  type="submit"
                  className="btn btn-primary"
                  disabled={saving || !form.description.trim() || !user?.userId}
                >
                  {saving ? (
                    <Loader2 size={17} className="spin" aria-hidden />
                  ) : (
                    <Plus size={17} aria-hidden />
                  )}
                  {saving ? "Đang gửi..." : "Tạo báo cáo"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {resolveTarget && (
        <div
          className="modal-overlay"
          onClick={(event) =>
            event.target === event.currentTarget &&
            !saving &&
            setResolveTarget(null)
          }
        >
          <div
            className="modal-panel manager-form-modal staff-incident-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="incident-resolve-title"
          >
            <div className="manager-modal-header">
              <div>
                <h3 id="incident-resolve-title" className="modal-title">
                  Hoàn tất xử lý sự cố
                </h3>
                <p>{issueLabel(resolveTarget.issueType)}</p>
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                aria-label="Đóng"
                onClick={() => setResolveTarget(null)}
                disabled={saving}
              >
                <X size={20} aria-hidden />
              </button>
            </div>
            <div className="staff-incident-resolve-summary">
              {resolveTarget.description}
            </div>
            {resolveSlotId && (
              <div className="form-field">
                <label htmlFor="incident-slot-status">
                  Trạng thái slot {resolveSlotCode || ""}
                </label>
                <select
                  id="incident-slot-status"
                  value={slotStatus}
                  onChange={(event) => setSlotStatus(event.target.value)}
                >
                  <option value="">Giữ nguyên trạng thái hiện tại</option>
                  <option value="Available">Còn trống</option>
                  <option value="Maintenance">Bảo trì</option>
                  <option value="Locked">Tạm khóa</option>
                </select>
                <small className="field-hint">
                  Chỉ cập nhật khi sự cố có ảnh hưởng đến vị trí đỗ xe.
                </small>
              </div>
            )}
            <div className="form-field">
              <label htmlFor="resolution-notes">Kết quả xử lý *</label>
              <textarea
                id="resolution-notes"
                autoFocus
                rows={4}
                maxLength={1000}
                value={resolutionNotes}
                onChange={(event) => setResolutionNotes(event.target.value)}
                placeholder="Ghi rõ cách xử lý, kết quả đối chiếu và bàn giao..."
              />
              <small className="field-hint">
                {resolutionNotes.length}/1000 ký tự
              </small>
            </div>
            {actionError && (
              <div className="manager-inline-error" role="alert">
                {actionError}
              </div>
            )}
            <div className="form-actions">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setResolveTarget(null)}
                disabled={saving}
              >
                Hủy
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => void resolveIncident()}
                disabled={saving || !resolutionNotes.trim()}
              >
                {saving ? (
                  <Loader2 size={17} className="spin" aria-hidden />
                ) : (
                  <CheckCircle2 size={17} aria-hidden />
                )}
                {saving ? "Đang cập nhật..." : "Xác nhận hoàn tất"}
              </button>
            </div>
          </div>
        </div>
      )}
    </StaffPageShell>
  );
}
