import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  AlertCircle,
  Activity,
  CalendarClock,
  CalendarDays,
  Camera,
  Car,
  CarFront,
  CheckCircle2,
  Clock,
  Clock3,
  CreditCard,
  Eye,
  Fingerprint,
  Hash,
  ImageIcon,
  LogOut,
  MapPin,
  ParkingSquare,
  QrCode,
  RotateCcw,
  Search,
  Smartphone,
  UserCheck,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";
import StaffPageShell from "../../components/StaffPageShell";
import ParkingTicketModal from "../../components/ParkingTicketModal";
import PlateCameraCapture from "../../components/PlateCameraCapture";
import QrCameraScanner from "../../components/QrCameraScanner";
import { navigateStaffNav } from "../../config/staffNav";
import { useParkingFeePreviews } from "../../hooks/useParkingFeePreviews";
import {
  parkingOperationApi,
  parkingSessionApi,
  reservationApi,
  gateApi,
  type ParkingSessionTicket,
  type ParkingQrDecodeResult,
  type ParkingSessionDto,
  type ReservationDto,
  type GateDto,
} from "../../utils/apiServices";
import {
  formatNowInVietnamTime,
  formatUtcToVietnamDateTime,
  parseBackendUtcDate,
} from "../../utils/dateTime";
import { formatCurrency } from "../../utils/pricing";
import { normalizeLicensePlate } from "../../utils/licensePlate";
import {
  isCarVehicleTypeName,
  readStaffGateContext,
  staffGateSelectionPath,
} from "../../utils/staffGateContext";
import {
  buildPlateRecognitionExceptionFeedback,
  buildPlateRecognitionFeedback,
} from "../../utils/plateRecognitionFeedback";

type GatePanel = "scan" | "reservations" | "active-vehicles";

interface ScanPlateProps {
  initialPanel?: GatePanel;
}

type LooseParkingSessionTicket = ParkingSessionTicket & {
  QrPayload?: string;
  QrCodeDataUrl?: string;
};

type CheckInResult = Partial<ParkingSessionDto> & {
  licensePlate?: string;
  ticket?: LooseParkingSessionTicket;
  Ticket?: LooseParkingSessionTicket;
  SessionId?: string;
  LicensePlate?: string;
  LicensePlateIn?: string;
  VehicleTypeName?: string;
  ActualSlotCode?: string;
  AssignedSlotCode?: string;
  EntryTime?: string;
};

const panelCopy: Record<GatePanel, { title: string; desc: string }> = {
  scan: {
    title: "Quét xe vào bãi",
    desc: "Kiểm tra biển số và xác nhận xe vào bãi.",
  },
  reservations: {
    title: "Đơn đặt trước",
    desc: "Danh sách đơn đặt trước đang chờ xe đến cổng vào.",
  },
  "active-vehicles": {
    title: "Xe đang trong bãi",
    desc: "Danh sách xe đã check-in và chưa checkout.",
  },
};

function formatDateTime(value?: string) {
  if (!value) return "Chưa có";
  return formatUtcToVietnamDateTime(value);
}

function safeTime(value?: string | null) {
  if (!value) return 0;
  const time = parseBackendUtcDate(value).getTime();
  return Number.isNaN(time) ? 0 : time;
}

function parkingDuration(entryTime: string | undefined, now: number) {
  const entryTimestamp = safeTime(entryTime);
  if (!now || !entryTimestamp) return "Chưa xác định";
  const totalMinutes = Math.max(0, Math.floor((now - entryTimestamp) / 60_000));
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  return [
    days ? `${days} ngày` : "",
    hours ? `${hours} giờ` : "",
    `${minutes} phút`,
  ]
    .filter(Boolean)
    .join(" ");
}

function statusLabel(status?: string) {
  const normalized = status?.toLowerCase();
  if (normalized === "confirmed") return "Đã xác nhận";
  if (normalized === "modified") return "Đã đổi giờ";
  if (normalized === "pending") return "Chờ thanh toán";
  if (normalized === "checkedin") return "Đã check-in";
  if (normalized === "noshow") return "Không đến";
  if (normalized === "active") return "Đang trong bãi";
  if (normalized === "completed") return "Đã hoàn tất";
  if (normalized === "cancelled") return "Đã hủy";
  return status || "Không rõ";
}

function paymentStatusLabel(status?: string) {
  const normalized = status?.toLowerCase();
  if (normalized === "paid" || normalized === "success") return "Đã thanh toán";
  if (normalized === "pending") return "Chờ thanh toán";
  if (normalized === "failed") return "Thanh toán thất bại";
  return status || "Chưa có thanh toán";
}

function getReservationPlate(reservation: ReservationDto) {
  return (
    reservation.licensePlate ||
    reservation.parkingSessions?.[0]?.licensePlateIn ||
    "Chưa ghi nhận"
  );
}

function toParkingSessionFromCheckIn(
  result: CheckInResult | undefined,
  gateId: string,
  gateName?: string,
): ParkingSessionDto | null {
  const ticket = result?.ticket ?? result?.Ticket;
  const qrPayload = ticket?.qrPayload ?? ticket?.QrPayload;
  const qrCodeDataUrl = ticket?.qrCodeDataUrl ?? ticket?.QrCodeDataUrl;
  if (!qrCodeDataUrl || !qrPayload) return null;

  return {
    sessionId: result?.sessionId || result?.SessionId || qrPayload,
    licensePlateIn:
      result?.licensePlateIn ||
      result?.LicensePlateIn ||
      result?.licensePlate ||
      result?.LicensePlate ||
      "",
    vehicleTypeId:
      (result as { vehicleTypeId?: string }).vehicleTypeId ||
      (result as { VehicleTypeId?: string }).VehicleTypeId ||
      "",
    vehicleTypeName: result?.vehicleTypeName || result?.VehicleTypeName,
    entryTime: result?.entryTime || result?.EntryTime || new Date().toISOString(),
    entryGateId: gateId,
    entryGateName: gateName,
    assignedSlotCode:
      result?.assignedSlotCode || result?.AssignedSlotCode,
    actualSlotCode:
      result?.actualSlotCode || result?.ActualSlotCode,
    status: "active",
    ticket: { qrPayload, qrCodeDataUrl },
  };
}

function PlateVisual({
  plate,
  muted = false,
}: {
  plate?: string;
  muted?: boolean;
}) {
  return (
    <div
      className={`license-plate-visual${muted ? " license-plate-visual--muted" : ""}`}
    >
      <span>{plate || "NO PLATE"}</span>
    </div>
  );
}

export default function ScanPlate({ initialPanel = "scan" }: ScanPlateProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const operationState = location.state as {
    reservationId?: string;
    licensePlate?: string;
    checkInType?: "reservation";
    gateAccessGranted?: boolean;
  } | null;
  const [gateContext] = useState(() => readStaffGateContext("checkin"));
  const allowsReservationAtGate = Boolean(
    gateContext &&
      !gateContext.isResident &&
      isCarVehicleTypeName(gateContext.dedicatedVehicleTypeName),
  );
  const qrInputRef = useRef<HTMLInputElement>(null);

  const [activePanel, setActivePanel] = useState<GatePanel>(
    initialPanel,
  );
  const [imagePreviewUrl, setImagePreviewUrl] = useState("");
  const [entryImageUrl, setEntryImageUrl] = useState("");
  const [driverImagePreviewUrl, setDriverImagePreviewUrl] = useState("");
  const [driverEntryImageUrl, setDriverEntryImageUrl] = useState("");
  const [driverUploading, setDriverUploading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [licensePlate, setLicensePlate] = useState(
    normalizeLicensePlate(operationState?.licensePlate ?? ""),
  );
  const [entryTimePreview, setEntryTimePreview] = useState("");
  const vehicleTypeId = gateContext?.dedicatedVehicleTypeId ?? "";
  const gateId = gateContext?.gateId ?? "";
  const [checkInType, setCheckInType] = useState<
    "guest" | "resident" | "reservation"
  >(
    operationState?.checkInType === "reservation" && allowsReservationAtGate
      ? "reservation"
      : gateContext?.isResident
        ? "resident"
        : "guest",
  );
  const [reservationId, setReservationId] = useState(
    allowsReservationAtGate ? operationState?.reservationId ?? "" : "",
  );
  const [qrPayload, setQrPayload] = useState("");
  const [qrDecode, setQrDecode] = useState<ParkingQrDecodeResult | null>(null);
  const [qrUploading, setQrUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"success" | "error">("error");
  const [plateRecognitionNotice, setPlateRecognitionNotice] = useState("");
  const [plateRecognitionTone, setPlateRecognitionTone] = useState<
    "success" | "error"
  >("error");
  const [lastCheckInSession, setLastCheckInSession] =
    useState<ParkingSessionDto | null>(null);
  const [reservations, setReservations] = useState<ReservationDto[]>([]);
  const [activeSessions, setActiveSessions] = useState<ParkingSessionDto[]>([]);
  const [gates, setGates] = useState<GateDto[]>([]);
  const [activeVehicleQuery, setActiveVehicleQuery] = useState("");
  const [activeVehicleFloorFilter, setActiveVehicleFloorFilter] = useState("all");
  const [activeVehicleFilter, setActiveVehicleFilter] = useState<
    "all" | "reservation" | "walkin"
  >("all");
  const [activeDetailSession, setActiveDetailSession] =
    useState<ParkingSessionDto | null>(null);
  const [ticketSession, setTicketSession] = useState<ParkingSessionDto | null>(
    null,
  );
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState("");
  const [reservationQuery, setReservationQuery] = useState("");
  const [reservationFilter, setReservationFilter] = useState<
    "all" | "ready" | "upcoming" | "pending"
  >("all");
  const [currentTime, setCurrentTime] = useState(0);
  const {
    previews: feePreviews,
    errors: feePreviewErrors,
    refresh: refreshFeePreviews,
  } = useParkingFeePreviews(activeSessions);

  useEffect(() => {
    if (
      initialPanel === "scan" &&
      (!gateContext || !operationState?.gateAccessGranted)
    ) {
      navigate(
        `${staffGateSelectionPath("checkin")}?destination=${initialPanel}`,
        { replace: true },
      );
    }
  }, [gateContext, initialPanel, navigate, operationState?.gateAccessGranted]);

  useEffect(() => {
    const initialTimer = window.setTimeout(() => setCurrentTime(Date.now()), 0);
    const timer = window.setInterval(() => setCurrentTime(Date.now()), 30_000);
    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    queueMicrotask(() => setActivePanel(initialPanel));
  }, [initialPanel]);

  const loadGateLists = async () => {
    setListLoading(true);
    setListError("");
    try {
      const [reservationRes, sessionRes, gateRes] = await Promise.all([
        reservationApi.getAll(),
        parkingSessionApi.getAll(),
        gateApi.getAll(),
      ]);
      const floorGateIds = new Set(
        (gateRes.isSuccess ? gateRes.result ?? [] : [])
          .filter(
            (gate) =>
              initialPanel !== "scan" ||
              !gateContext ||
              gate.floorId === gateContext.floorId,
          )
          .map((gate) => gate.gateId),
      );
      setGates(gateRes.isSuccess ? gateRes.result ?? [] : []);

      if (reservationRes.isSuccess && reservationRes.result) {
        setReservations(
          reservationRes.result
            .filter((item) =>
              ["pending", "confirmed", "modified"].includes(
                item.status?.toLowerCase(),
              ),
            )
            .filter(
              (item) =>
                initialPanel !== "scan" ||
                !gateContext?.dedicatedVehicleTypeId ||
                item.vehicleTypeId === gateContext.dedicatedVehicleTypeId,
            )
            .sort(
              (left, right) =>
                parseBackendUtcDate(left.expectedEntryTime).getTime() -
                parseBackendUtcDate(right.expectedEntryTime).getTime(),
            ),
        );
      }

      if (sessionRes.isSuccess && sessionRes.result) {
        setActiveSessions(
          sessionRes.result
            .filter(
              (item) =>
                item.status?.toLowerCase() === "active" &&
                (initialPanel !== "scan" ||
                  !gateContext ||
                  floorGateIds.has(item.entryGateId)),
            )
            .sort(
              (left, right) =>
                parseBackendUtcDate(right.entryTime).getTime() -
                parseBackendUtcDate(left.entryTime).getTime(),
            ),
        );
      }
    } catch (err) {
      console.error(err);
      setListError(
        "Chưa tải được danh sách từ API. Vui lòng kiểm tra quyền staff hoặc backend.",
      );
    } finally {
      setListLoading(false);
    }
  };

  useEffect(() => {
    queueMicrotask(() => {
      void loadGateLists();
    });
  }, [gateContext]);

  const setPlateForConfirm = (plate: string) => {
    const nextPlate = normalizeLicensePlate(plate);
    setLicensePlate(nextPlate);
    setEntryTimePreview(nextPlate.trim() ? formatNowInVietnamTime() : "");
  };

  const resetScan = (options: { keepResult?: boolean } = {}) => {
    setImagePreviewUrl("");
    setEntryImageUrl("");
    setDriverImagePreviewUrl("");
    setDriverEntryImageUrl("");
    setReservationId("");
    setQrPayload("");
    setQrDecode(null);
    setMessageTone("error");
    setPlateRecognitionTone("error");
    setPlateRecognitionNotice("");
    setPlateForConfirm("");
    if (!options.keepResult) {
      setMessage("");
      setLastCheckInSession(null);
    }
    if (qrInputRef.current) qrInputRef.current.value = "";
  };

  const handlePlateCameraCapture = async (file: File, previewUrl: string) => {
    setImagePreviewUrl(previewUrl);
    setUploading(true);
    setMessage("");
    setMessageTone("error");
    setPlateRecognitionTone("error");
    setPlateRecognitionNotice("");
    setLastCheckInSession(null);
    setPlateForConfirm("");

    try {
      const res = await parkingOperationApi.uploadAndRecognizePlate(file);
      if (res?.imageUrl) {
        setEntryImageUrl(res.imageUrl);
        const feedback = buildPlateRecognitionFeedback(res);
        setPlateRecognitionTone(feedback.ok ? "success" : "error");
        setPlateRecognitionNotice(
          feedback.ok ? "Nhận diện biển số thành công." : feedback.message,
        );
        if (res.licensePlate) {
          setPlateForConfirm(res.licensePlate);
        }
      } else {
        setPlateRecognitionTone("error");
        setPlateRecognitionNotice("Không lưu được ảnh biển số.");
      }
    } catch (err) {
      console.error(err);
      const feedback = buildPlateRecognitionExceptionFeedback(err);
      setPlateRecognitionTone("error");
      setPlateRecognitionNotice(feedback.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDriverCameraCapture = async (file: File, previewUrl: string) => {
    setDriverImagePreviewUrl(previewUrl);
    setDriverUploading(true);
    try {
      const res = await parkingOperationApi.uploadImage(file);
      setDriverEntryImageUrl(res.imageUrl || "");
    } catch (err) {
      console.error(err);
      setMessageTone("error");
      setMessage("Không lưu được ảnh người lái.");
    } finally {
      setDriverUploading(false);
    }
  };

  const handleConfirmCheckIn = async () => {
    if (!licensePlate.trim()) {
      setPlateRecognitionTone("error");
      setPlateRecognitionNotice("Vui lòng nhập hoặc chụp biển số xe.");
      return;
    }
    if (!gateId) return;
    if (checkInType !== "reservation" && !vehicleTypeId) return;
    if (checkInType === "reservation" && !reservationId && !qrPayload.trim()) {
      setMessageTone("error");
      setMessage("Vui lòng upload ảnh QR đặt chỗ hoặc nhập mã QR đặt chỗ");
      return;
    }
    setLoading(true);
    setMessage("");
    setMessageTone("error");
    setPlateRecognitionNotice("");
    setPlateRecognitionTone("error");
    setLastCheckInSession(null);
    try {
      const payload = {
        customerType:
          checkInType === "resident"
            ? "Resident"
            : checkInType === "reservation"
              ? "Reservation"
              : "Guest",
        licensePlate: licensePlate.trim(),
        vehicleTypeId:
          checkInType === "reservation" ? undefined : vehicleTypeId,
        reservationId: reservationId || undefined,
        qrPayload: qrPayload.trim() || undefined,
        gateId,
        entryImageUrl: entryImageUrl || undefined,
        driverEntryImageUrl: driverEntryImageUrl || undefined,
      } as const;
      const res = await parkingOperationApi.checkIn(payload);

      if (res.isSuccess) {
        const session = toParkingSessionFromCheckIn(
          res.result,
          gateId,
          gateContext?.gateName,
        );
        resetScan({ keepResult: true });
        if (session) {
          setLastCheckInSession(session);
          setTicketSession(session);
        }
        setMessageTone("success");
        setPlateRecognitionNotice("");
        setPlateRecognitionTone("error");
        setMessage(res.message || "Check-in thành công");
        loadGateLists();
      } else {
        setMessageTone("error");
        setMessage(res.message || "Check-in thất bại");
      }
    } catch (err) {
      console.error(err);
      setMessageTone("error");
      setMessage(err instanceof Error ? err.message : "Lỗi kết nối API");
    } finally {
      setLoading(false);
    }
  };

  const handleQrUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setQrUploading(true);
    setMessage("");
    setMessageTone("error");
    setPlateRecognitionNotice("");
    setPlateRecognitionTone("error");
    setLastCheckInSession(null);
    setQrDecode(null);
    setReservationId("");
    setQrPayload("");

    try {
      const res = await parkingOperationApi.uploadAndDecodeQr(file);
      if (res.isSuccess && res.result) {
        setQrDecode(res.result);
        setQrPayload(res.result.qrPayload);
        setReservationId(res.result.reservationId || "");
        if (!res.result.reservationId) {
          setMessage(
            "QR đã đọc được nhưng không phải mã đặt chỗ. Vui lòng dùng QR đặt chỗ để check-in đặt trước.",
          );
        }
      } else {
        setMessage(res.message || "Không đọc được mã QR.");
      }
    } catch (err) {
      console.error(err);
      setMessage(
        err instanceof Error ? err.message : "Lỗi kết nối khi upload QR.",
      );
    } finally {
      setQrUploading(false);
    }
  };

  const handleQrCameraDecoded = async (payload: string) => {
    setQrUploading(true);
    setMessage("");
    setMessageTone("error");
    setPlateRecognitionNotice("");
    setPlateRecognitionTone("error");
    setLastCheckInSession(null);
    setQrDecode(null);
    setReservationId("");
    setQrPayload(payload.trim());

    try {
      const res = await parkingOperationApi.resolveQrPayload(payload);
      if (res.isSuccess && res.result) {
        setQrDecode(res.result);
        setQrPayload(res.result.qrPayload);
        setReservationId(res.result.reservationId || "");
        if (!res.result.reservationId) {
          setMessage(
            "QR đã đọc được nhưng không phải mã đặt chỗ. Vui lòng dùng QR đặt chỗ để check-in đặt trước.",
          );
        }
      } else {
        setMessageTone("error");
        setMessage(res.message || "Không đọc được mã QR.");
      }
    } catch (err) {
      console.error(err);
      setMessageTone("error");
      setMessage(err instanceof Error ? err.message : "Lỗi kết nối khi kiểm tra QR.");
    } finally {
      setQrUploading(false);
    }
  };

  const handleSelectSidebar = (id: string) => {
    if (id === "scan" || id === "reservations" || id === "active-vehicles") {
      setActivePanel(id);
      navigate(
        id === "reservations"
          ? "/staff/reservations"
          : id === "active-vehicles"
            ? "/staff/active-vehicles"
            : "/staff/scan-plate",
      );
      if (id !== "scan") loadGateLists();
    } else {
      navigateStaffNav(id, navigate);
    }
  };

  const selectCheckInType = (type: "guest" | "resident" | "reservation") => {
    if (gateContext?.isResident && type !== "resident") return;
    if (!gateContext?.isResident && type === "resident") return;
    if (type === "reservation" && !allowsReservationAtGate) return;
    setCheckInType(type);
    setMessage("");
    setLastCheckInSession(null);
    if (type !== "reservation") {
      setReservationId("");
      setQrPayload("");
      setQrDecode(null);
    }
  };

  const handleUseReservation = (reservation: ReservationDto) => {
    const plate = getReservationPlate(reservation);
    if (!gateContext) {
      navigate(`${staffGateSelectionPath("checkin")}?destination=scan`, {
        state: {
          reservationId: reservation.reservationId,
          licensePlate: plate !== "Chưa ghi nhận" ? plate : "",
          checkInType: "reservation",
        },
      });
      return;
    }
    if (!allowsReservationAtGate) {
      setMessage("Đặt trước chỉ áp dụng tại tầng ô tô vãng lai.");
      setActivePanel("scan");
      return;
    }
    resetScan();
    setCheckInType("reservation");
    setReservationId(reservation.reservationId);
    if (plate !== "Chưa ghi nhận") setPlateForConfirm(plate);
    setActivePanel("scan");
  };

  const hasReservationCode = Boolean(reservationId || qrPayload.trim());
  const reservationRows = useMemo(() => {
    const now = currentTime;
    const query = reservationQuery.trim().toLocaleLowerCase("vi-VN");

    return reservations.filter((reservation) => {
      const status = reservation.status?.toLowerCase();
      const expectedAt = parseBackendUtcDate(
        reservation.expectedEntryTime,
      ).getTime();
      const ready =
        ["confirmed", "modified"].includes(status) &&
        now >= expectedAt - 30 * 60_000 &&
        now <= expectedAt + 30 * 60_000;
      const upcoming =
        ["confirmed", "modified"].includes(status) &&
        now < expectedAt - 30 * 60_000;
      const matchesFilter =
        reservationFilter === "all" ||
        (reservationFilter === "ready" && ready) ||
        (reservationFilter === "upcoming" && upcoming) ||
        (reservationFilter === "pending" && status === "pending");
      const haystack = [
        reservation.reservationId,
        reservation.userFullName,
        reservation.user?.fullName,
        reservation.user?.phoneNumber,
        reservation.user?.email,
        reservation.vehicleTypeName,
        getReservationPlate(reservation),
      ]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase("vi-VN");

      return matchesFilter && (!query || haystack.includes(query));
    });
  }, [currentTime, reservationFilter, reservationQuery, reservations]);

  const reservationCounts = useMemo(() => {
    const now = currentTime;
    return reservations.reduce(
      (counts, reservation) => {
        const status = reservation.status?.toLowerCase();
        const expectedAt = parseBackendUtcDate(
          reservation.expectedEntryTime,
        ).getTime();
        if (status === "pending") counts.pending += 1;
        if (
          ["confirmed", "modified"].includes(status) &&
          now < expectedAt - 30 * 60_000
        )
          counts.upcoming += 1;
        if (
          ["confirmed", "modified"].includes(status) &&
          now >= expectedAt - 30 * 60_000 &&
          now <= expectedAt + 30 * 60_000
        )
          counts.ready += 1;
        return counts;
      },
      { ready: 0, upcoming: 0, pending: 0 },
    );
  }, [currentTime, reservations]);

  const gateFloorById = useMemo(
    () => new Map(gates.map((gate) => [gate.gateId, gate.floorId])),
    [gates],
  );

  const activeVehicleFloorOptions = useMemo(() => {
    const floors = new Map<string, string>();
    gates.forEach((gate) => {
      floors.set(gate.floorId, gate.floorName || "Tầng chưa đặt tên");
    });
    return Array.from(floors, ([floorId, floorName]) => ({
      floorId,
      floorName,
    })).sort((left, right) =>
      left.floorName.localeCompare(right.floorName, "vi"),
    );
  }, [gates]);

  const floorFilteredActiveSessions = useMemo(
    () =>
      activeVehicleFloorFilter === "all"
        ? activeSessions
        : activeSessions.filter(
            (session) =>
              gateFloorById.get(session.entryGateId) ===
              activeVehicleFloorFilter,
          ),
    [activeSessions, activeVehicleFloorFilter, gateFloorById],
  );

  const activeSessionCounts = useMemo(
    () => ({
      reservation: floorFilteredActiveSessions.filter((session) =>
        Boolean(session.reservationId),
      ).length,
      walkin: floorFilteredActiveSessions.filter(
        (session) => !session.reservationId,
      ).length,
    }),
    [floorFilteredActiveSessions],
  );

  const activeSessionRows = useMemo(() => {
    const query = activeVehicleQuery.trim().toLocaleLowerCase("vi-VN");
    return floorFilteredActiveSessions
      .filter((session) => {
        if (activeVehicleFilter === "reservation" && !session.reservationId)
          return false;
        if (activeVehicleFilter === "walkin" && session.reservationId)
          return false;
        if (!query) return true;
        return [
          session.licensePlateIn,
          session.driverFullName,
          session.vehicleTypeName,
          session.assignedSlotCode,
          session.actualSlotCode,
          session.sessionId,
        ]
          .filter(Boolean)
          .join(" ")
          .toLocaleLowerCase("vi-VN")
          .includes(query);
      })
      .sort(
        (left, right) => safeTime(left.entryTime) - safeTime(right.entryTime),
      );
  }, [activeVehicleFilter, activeVehicleQuery, floorFilteredActiveSessions]);

  const getReservationAction = (reservation: ReservationDto) => {
    const status = reservation.status?.toLowerCase();
    if (status === "pending")
      return { enabled: false, label: "Chưa thanh toán" };
    if (!["confirmed", "modified"].includes(status))
      return { enabled: false, label: "Không thể check-in" };
    const now = currentTime;
    const expectedAt = parseBackendUtcDate(
      reservation.expectedEntryTime,
    ).getTime();
    if (now < expectedAt - 30 * 60_000)
      return { enabled: false, label: "Chưa đến giờ check-in" };
    if (now > expectedAt + 30 * 60_000)
      return { enabled: false, label: "Đã quá giờ check-in" };
    return { enabled: true, label: "Check-in đơn này" };
  };

  const canConfirm = Boolean(
    !loading &&
    !uploading &&
    !qrUploading &&
    licensePlate.trim() &&
    gateId &&
    (checkInType === "reservation" ? hasReservationCode : vehicleTypeId),
  );
  const checkInMessageIsSuccess =
    messageTone === "success" || Boolean(lastCheckInSession);

  return (
    <StaffPageShell activeItem={activePanel} onSelectItem={handleSelectSidebar}>
      <div className="staff-content-wrapper staff-manager-page manager-resource-page">
        <div className="staff-section">
          <header className="manager-resource-header">
            <div className="manager-resource-title">
              <span className="manager-resource-icon manager-resource-icon--green">
                {activePanel === "scan" ? (
                  <Smartphone size={24} aria-hidden />
                ) : activePanel === "reservations" ? (
                  <CalendarClock size={24} aria-hidden />
                ) : (
                  <Car size={24} aria-hidden />
                )}
              </span>
              <div>
                <div className="staff-checkin-title-row">
                  <h2>{panelCopy[activePanel].title}</h2>
                  {gateContext && activePanel === "scan" && (
                    <span className="staff-gate-context-badge">
                      <MapPin size={14} aria-hidden />
                      {gateContext.floorName} · {gateContext.gateName}
                      <small>
                        ·{" "}
                        {gateContext.isResident
                          ? "Cư dân"
                          : allowsReservationAtGate
                            ? "Khách / đặt trước"
                            : "Vãng lai"}
                        · {gateContext.dedicatedVehicleTypeName || "Nhiều loại xe"}
                      </small>
                    </span>
                  )}
                </div>
                <p>{panelCopy[activePanel].desc}</p>
              </div>
            </div>
            {activePanel === "scan" && gateContext ? (
              <div className="manager-header-actions">
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => navigate(staffGateSelectionPath("checkin"))}
                >
                  Đổi tầng / cổng
                </button>
              </div>
            ) : activePanel !== "scan" ? (
              <div className="manager-header-actions">
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() =>
                    void Promise.all([loadGateLists(), refreshFeePreviews()])
                  }
                  disabled={listLoading}
                >
                  <RotateCcw
                    size={17}
                    className={listLoading ? "spin" : ""}
                    aria-hidden
                  />{" "}
                  {listLoading ? "Đang tải..." : "Làm mới"}
                </button>
              </div>
            ) : null}
          </header>

          {activePanel === "scan" && (
            <div className="scan-entry-layout">
              <div className="card-panel scan-entry-camera-card">
                <div className="scan-card-heading">
                  <span className="checkout-card-icon">
                    <Camera size={19} aria-hidden />
                  </span>
                  <div>
                    <h3>Chụp ảnh vào bãi</h3>
                    <p>
                      Chụp biển số xe và khuôn mặt người lái khi xe vào cổng.
                    </p>
                  </div>
                </div>

                <div className="checkout-photo-grid">
                  <article className="scan-entry-camera card-panel checkout-photo-card">
                    <div className="scan-card-heading">
                      <div>
                        <h3>Ảnh biển số vào</h3>
                        <p>
                          Ảnh dùng để nhận diện, có thể nhập biển số trực tiếp.
                        </p>
                      </div>
                    </div>
                    <PlateCameraCapture
                      busy={uploading}
                      previewUrl={imagePreviewUrl}
                      previewAlt="Ảnh biển số xe"
                      fileNamePrefix="checkin-plate"
                      onCapture={handlePlateCameraCapture}
                    />
                  </article>

                  <article className="scan-entry-camera card-panel checkout-photo-card">
                    <div className="scan-card-heading">
                      <div>
                        <h3>Ảnh người lái lúc vào</h3>
                        <p>Chụp rõ khuôn mặt người đang điều khiển xe.</p>
                      </div>
                    </div>
                    <PlateCameraCapture
                      busy={driverUploading}
                      previewUrl={driverImagePreviewUrl || driverEntryImageUrl}
                      previewAlt="Ảnh người lái lúc vào"
                      fileNamePrefix="checkin-driver"
                      captureLabel="Chụp khuôn mặt"
                      helperText="Căn rõ khuôn mặt người lái trong khung rồi bấm chụp."
                      processingLabel="Đang lưu ảnh người lái..."
                      facingMode="user"
                      onCapture={handleDriverCameraCapture}
                    />
                  </article>
                </div>
              </div>

              <div className="scan-entry-form card-panel">
                <div className="scan-card-heading">
                  <div>
                    <h3>Xác nhận thông tin xe</h3>
                    <p>
                      Kiểm tra biển số, loại khách và cổng trước khi cho xe vào.
                    </p>
                  </div>
                </div>
                <div className="scan-entry-grid">
                  <div className="form-field form-field--full">
                    <label htmlFor="license-plate">Biển số xe</label>
                    <input
                      id="license-plate"
                      type="text"
                      className="input-standalone"
                      placeholder="Nhập biển số"
                      value={licensePlate}
                      onChange={(event) => {
                        setPlateForConfirm(event.target.value)
                        setPlateRecognitionNotice("")
                        setPlateRecognitionTone("error")
                      }}
                    />
                    {plateRecognitionNotice && (
                      <p
                        className={`plate-recognition-inline ${
                          plateRecognitionTone === "success"
                            ? "is-success"
                            : "is-error"
                        }`}
                        role={
                          plateRecognitionTone === "success"
                            ? "status"
                            : "alert"
                        }
                      >
                        {plateRecognitionTone === "success" ? (
                          <CheckCircle2 size={15} aria-hidden />
                        ) : (
                          <AlertCircle size={15} aria-hidden />
                        )}
                        {plateRecognitionNotice}
                      </p>
                    )}
                  </div>

                  <div className="form-field">
                    <label>Loại phương tiện</label>
                    <div className="input-readonly">
                      {gateContext?.dedicatedVehicleTypeName ||
                        "Tầng chưa cấu hình loại phương tiện"}
                    </div>
                  </div>

                  <div className="form-field">
                    <label>Giờ hiện tại</label>
                    <div className="input-readonly">
                      {entryTimePreview || formatNowInVietnamTime()}
                    </div>
                  </div>

                  <div className="form-field form-field--full">
                    <label>Loại khách</label>
                    <div
                      className="checkin-type-selector"
                      role="group"
                      aria-label="Chọn loại khách check-in"
                    >
                      {!gateContext?.isResident && (
                        <button
                          type="button"
                          className={checkInType === "guest" ? "active" : ""}
                          aria-pressed={checkInType === "guest"}
                          onClick={() => selectCheckInType("guest")}
                        >
                          <UsersRound size={19} aria-hidden />
                          <span>
                            <strong>Vãng lai</strong>
                            <small>Khách gửi xe thông thường</small>
                          </span>
                        </button>
                      )}
                      {gateContext?.isResident && (
                        <button
                          type="button"
                          className={checkInType === "resident" ? "active" : ""}
                          aria-pressed={checkInType === "resident"}
                          onClick={() => selectCheckInType("resident")}
                        >
                          <UserCheck size={19} aria-hidden />
                          <span>
                            <strong>Khách tháng</strong>
                            <small>Đã có gói gửi xe</small>
                          </span>
                        </button>
                      )}
                      {allowsReservationAtGate && (
                        <button
                          type="button"
                          className={
                            checkInType === "reservation" ? "active" : ""
                          }
                          aria-pressed={checkInType === "reservation"}
                          onClick={() => selectCheckInType("reservation")}
                        >
                          <CalendarClock size={19} aria-hidden />
                          <span>
                            <strong>Đặt trước</strong>
                            <small>Có mã QR hoặc mã đơn</small>
                          </span>
                        </button>
                      )}
                    </div>
                  </div>

                  {checkInType === "reservation" && (
                    <div className="form-field form-field--full reservation-code-field">
                      <label>Mã QR đặt chỗ</label>
                      {reservationId && (
                        <div className="input-readonly input-readonly--success">
                          ReservationId: {reservationId}
                        </div>
                      )}
                      <input
                        type="text"
                        className="input-standalone"
                        placeholder="Dán QR payload / ReservationId"
                        value={qrPayload}
                        onChange={(event) => {
                          setQrPayload(event.target.value.trim());
                          setReservationId("");
                          setQrDecode(null);
                        }}
                      />
                      <QrCameraScanner
                        busy={qrUploading}
                        onDecoded={handleQrCameraDecoded}
                        actions={
                          <button
                            type="button"
                            className="btn btn-outline btn-sm"
                            disabled={qrUploading}
                            onClick={() => qrInputRef.current?.click()}
                          >
                            <QrCode size={16} aria-hidden />
                            {qrUploading ? "Đang đọc QR..." : "Tải ảnh QR"}
                          </button>
                        }
                      />
                      <div className="reservation-code-actions">
                        {hasReservationCode && (
                          <span className="scan-ready-label">
                            <CheckCircle2 size={16} aria-hidden /> Đã nhận mã
                            đặt chỗ
                          </span>
                        )}
                        {qrDecode && (
                          <span className="scan-ready-label">
                            <CheckCircle2 size={16} aria-hidden />
                            QR hợp lệ
                            {qrDecode.reservationId
                              ? ` · Mã đơn ${qrDecode.reservationId.slice(0, 8).toUpperCase()}`
                              : qrDecode.codeType
                                ? ` · ${qrDecode.codeType}`
                                : ""}
                          </span>
                        )}
                      </div>
                      <input
                        type="file"
                        ref={qrInputRef}
                        className="upload-input-hidden"
                        accept="image/*"
                        onChange={handleQrUpload}
                      />
                    </div>
                  )}

                </div>

                {message && (
                  <div
                    className={`alert-inline scan-entry-alert${checkInMessageIsSuccess ? " alert-success" : " alert-error"}`}
                    role={checkInMessageIsSuccess ? "status" : "alert"}
                  >
                    {checkInMessageIsSuccess ? (
                      <CheckCircle2 size={18} aria-hidden />
                    ) : (
                      <AlertCircle size={18} aria-hidden />
                    )}
                    <span>{message}</span>
                    {lastCheckInSession?.ticket && (
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        onClick={() => setTicketSession(lastCheckInSession)}
                      >
                        <QrCode size={16} aria-hidden />
                        Xem vé
                      </button>
                    )}
                  </div>
                )}

                <div className="scan-entry-actions">
                  <div
                    className={`scan-submit-status${canConfirm ? " ready" : ""}`}
                  >
                    {canConfirm ? (
                      <>
                        <CheckCircle2 size={17} aria-hidden /> Thông tin đã sẵn
                        sàng
                      </>
                    ) : (
                      <>
                        <AlertCircle size={17} aria-hidden /> Vui lòng nhập đủ
                        thông tin bắt buộc
                      </>
                    )}
                  </div>
                  <button
                    type="button"
                    className="btn btn-success"
                    disabled={!canConfirm}
                    onClick={handleConfirmCheckIn}
                  >
                    <CheckCircle2 size={18} aria-hidden />
                    {loading ? "Đang xử lý..." : "Xác nhận vào bãi"}
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => resetScan()}
                  >
                    <RotateCcw size={17} aria-hidden />
                    Làm lại
                  </button>
                </div>
              </div>
            </div>
          )}

          {activePanel !== "scan" && (
            <section className="staff-gate-board">
              {listError && (
                <p className="alert-inline alert-error">{listError}</p>
              )}

              <div className="staff-gate-grid staff-gate-grid--single">
                {activePanel === "reservations" && (
                  <div className="staff-gate-column card-panel staff-reservation-panel">
                    <div className="staff-gate-column-head">
                      <CalendarClock size={20} strokeWidth={2.2} aria-hidden />
                      <div>
                        <h4>Đơn đã đặt trước</h4>
                        <span>
                          {reservations.length} đơn đang chờ xử lý tại cổng
                        </span>
                      </div>
                    </div>

                    <div className="staff-reservation-summary">
                      <div className="staff-reservation-stat staff-reservation-stat--ready">
                        <span>Có thể check-in</span>
                        <strong>{reservationCounts.ready}</strong>
                      </div>
                      <div className="staff-reservation-stat">
                        <span>Sắp đến</span>
                        <strong>{reservationCounts.upcoming}</strong>
                      </div>
                      <div className="staff-reservation-stat staff-reservation-stat--pending">
                        <span>Chờ thanh toán</span>
                        <strong>{reservationCounts.pending}</strong>
                      </div>
                    </div>

                    <div className="staff-reservation-toolbar">
                      <label className="manager-search-field">
                        <Search size={18} aria-hidden />
                        <input
                          value={reservationQuery}
                          onChange={(event) =>
                            setReservationQuery(event.target.value)
                          }
                          placeholder="Tìm khách hàng, số điện thoại hoặc mã đơn..."
                        />
                        {reservationQuery && (
                          <button
                            type="button"
                            aria-label="Xóa tìm kiếm"
                            onClick={() => setReservationQuery("")}
                          >
                            <X size={16} aria-hidden />
                          </button>
                        )}
                      </label>
                      <div
                        className="manager-segmented-filter"
                        aria-label="Lọc đơn đặt trước"
                      >
                        {(
                          [
                            ["all", "Tất cả"],
                            ["ready", "Có thể check-in"],
                            ["upcoming", "Sắp đến"],
                            ["pending", "Chờ thanh toán"],
                          ] as const
                        ).map(([value, label]) => (
                          <button
                            key={value}
                            type="button"
                            className={
                              reservationFilter === value ? "active" : ""
                            }
                            onClick={() => setReservationFilter(value)}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="staff-vehicle-card-list">
                      {reservationRows.length === 0 ? (
                        <div className="staff-empty-state">
                          Không có đơn đặt trước phù hợp.
                        </div>
                      ) : (
                        reservationRows.map((reservation) => {
                          const reservationPlate =
                            getReservationPlate(reservation);
                          const action = getReservationAction(reservation);
                          return (
                            <article
                              key={reservation.reservationId}
                              className={`staff-vehicle-card staff-reservation-card${action.enabled ? " staff-reservation-card--ready" : ""}`}
                            >
                              <div className="staff-reservation-card-icon">
                                <CalendarClock size={23} aria-hidden />
                              </div>
                              <div className="staff-vehicle-info">
                                <div className="staff-vehicle-title">
                                  <strong>
                                    {reservation.userFullName ||
                                      reservation.user?.fullName ||
                                      "Khách đặt trước"}
                                  </strong>
                                  <span
                                    className={`staff-reservation-status status-${reservation.status?.toLowerCase()}`}
                                  >
                                    {statusLabel(reservation.status)}
                                  </span>
                                </div>
                                <p>
                                  <UserRound size={15} aria-hidden />
                                  {reservation.user?.phoneNumber ||
                                    reservation.user?.email ||
                                    "Chưa có thông tin liên hệ"}
                                </p>
                                <p>
                                  <Clock size={15} aria-hidden />
                                  Giờ dự kiến vào:{" "}
                                  {formatDateTime(
                                    reservation.expectedEntryTime,
                                  )}
                                </p>
                                <div className="staff-reservation-meta">
                                  <span>
                                    {reservation.vehicleTypeName ||
                                      reservation.vehicleType?.typeName ||
                                      "Chưa rõ loại xe"}
                                  </span>
                                  <span>
                                    Mã:{" "}
                                    {reservation.reservationId
                                      .slice(0, 8)
                                      .toUpperCase()}
                                  </span>
                                  {reservationPlate !== "Chưa ghi nhận" && (
                                    <span>Biển số: {reservationPlate}</span>
                                  )}
                                </div>
                                <button
                                  type="button"
                                  className={`btn btn-sm staff-reservation-checkin-btn ${action.enabled ? "btn-primary" : "btn-outline"}`}
                                  onClick={() =>
                                    handleUseReservation(reservation)
                                  }
                                  disabled={!action.enabled}
                                >
                                  <CheckCircle2 size={16} aria-hidden />
                                  {action.label}
                                </button>
                              </div>
                            </article>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}

                {activePanel === "active-vehicles" && (
                  <div className="staff-active-vehicle-panel">
                    <div className="staff-active-summary">
                      <article>
                        <span>Tổng xe trong bãi</span>
                        <strong>{floorFilteredActiveSessions.length}</strong>
                        <small>Chưa checkout</small>
                      </article>
                      <article>
                        <span>Xe đặt trước</span>
                        <strong>{activeSessionCounts.reservation}</strong>
                        <small>Có mã đặt chỗ</small>
                      </article>
                      <article>
                        <span>Xe vào trực tiếp</span>
                        <strong>{activeSessionCounts.walkin}</strong>
                        <small>Khách lượt hoặc khách tháng</small>
                      </article>
                    </div>

                    <div className="card-panel staff-active-list-panel">
                      <div className="staff-active-toolbar">
                        <label className="manager-search-field">
                          <Search size={18} aria-hidden />
                          <input
                            value={activeVehicleQuery}
                            onChange={(event) =>
                              setActiveVehicleQuery(event.target.value)
                            }
                            placeholder="Tìm biển số, khách hàng, loại xe hoặc vị trí..."
                          />
                          {activeVehicleQuery && (
                            <button
                              type="button"
                              aria-label="Xóa tìm kiếm"
                              onClick={() => setActiveVehicleQuery("")}
                            >
                              <X size={16} />
                            </button>
                          )}
                        </label>
                        <select
                          className="staff-active-floor-filter"
                          aria-label="Lọc xe theo tầng"
                          value={activeVehicleFloorFilter}
                          onChange={(event) =>
                            setActiveVehicleFloorFilter(event.target.value)
                          }
                        >
                          <option value="all">Tất cả tầng</option>
                          {activeVehicleFloorOptions.map((floor) => (
                            <option key={floor.floorId} value={floor.floorId}>
                              {floor.floorName}
                            </option>
                          ))}
                        </select>
                        <div
                          className="manager-segmented-filter"
                          aria-label="Lọc xe trong bãi"
                        >
                          {(
                            [
                              ["all", "Tất cả"],
                              ["reservation", "Đặt trước"],
                              ["walkin", "Vào trực tiếp"],
                            ] as const
                          ).map(([value, label]) => (
                            <button
                              key={value}
                              type="button"
                              className={
                                activeVehicleFilter === value ? "active" : ""
                              }
                              onClick={() => setActiveVehicleFilter(value)}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="staff-active-list-heading">
                        <div>
                          <Car size={19} />
                          <span>
                            <strong>Danh sách phương tiện</strong>
                            <small>Ưu tiên xe đã đỗ lâu ở đầu danh sách</small>
                          </span>
                        </div>
                        <strong>{activeSessionRows.length} xe</strong>
                      </div>

                      <div className="staff-vehicle-card-list staff-active-vehicle-list">
                        {activeSessionRows.length === 0 ? (
                          <div className="staff-empty-state">
                            {activeSessions.length === 0
                              ? "Chưa có xe đang trong bãi."
                              : floorFilteredActiveSessions.length === 0
                                ? "Tầng đã chọn chưa có xe đang trong bãi."
                              : "Không tìm thấy xe phù hợp."}
                          </div>
                        ) : (
                          activeSessionRows.map((session) => (
                            <article
                              key={session.sessionId}
                              className="staff-vehicle-card staff-active-vehicle-card"
                            >
                              <div className="staff-active-vehicle-identity">
                                <PlateVisual plate={session.licensePlateIn} />
                                <span>
                                  {session.reservationId
                                    ? "Xe đặt trước"
                                    : "Vào trực tiếp"}
                                </span>
                              </div>
                              <div className="staff-vehicle-info">
                                <div className="staff-vehicle-title">
                                  <strong>
                                    {session.driverFullName || "Khách vãng lai"}
                                  </strong>
                                  <span>{statusLabel(session.status)}</span>
                                </div>
                                <div className="staff-active-vehicle-meta">
                                  <span>
                                    <Car size={15} />
                                    {session.vehicleTypeName ||
                                      "Chưa rõ loại xe"}
                                  </span>
                                  <span>
                                    <MapPin size={15} />Ô{" "}
                                    {session.actualSlotCode ||
                                      session.assignedSlotCode ||
                                      "chưa xếp"}
                                  </span>
                                  <span>
                                    <Clock size={15} />
                                    Vào {formatDateTime(session.entryTime)}
                                  </span>
                                  <span className="staff-active-duration">
                                    <Clock size={15} />
                                    Đã gửi{" "}
                                    {parkingDuration(
                                      session.entryTime,
                                      currentTime,
                                    )}
                                  </span>
                                  <span>
                                    <CreditCard size={15} />
                                    {feePreviews[session.sessionId]
                                      ?.isCoveredBySubscription
                                      ? "Đã gồm trong gói tháng"
                                      : feePreviews[session.sessionId]
                                        ? `Tạm tính ${formatCurrency(feePreviews[session.sessionId].amount)}${(feePreviews[session.sessionId].depositAmount ?? 0) > 0 ? ` · Đã trừ ${formatCurrency(feePreviews[session.sessionId].depositAmount ?? 0)} tiền cọc` : ""}`
                                        : feePreviewErrors[session.sessionId] ||
                                          "Đang tính phí..."}
                                  </span>
                                </div>
                                <div className="staff-vehicle-actions staff-active-vehicle-actions">
                                  <button
                                    type="button"
                                    className="btn btn-outline btn-sm"
                                    onClick={() =>
                                      setActiveDetailSession(session)
                                    }
                                  >
                                    <Eye size={16} />
                                    Chi tiết
                                  </button>
                                  {session.ticket?.qrCodeDataUrl && (
                                    <button
                                      type="button"
                                      className="btn btn-outline btn-sm staff-ticket-button"
                                      onClick={() => setTicketSession(session)}
                                    >
                                      <QrCode size={16} aria-hidden /> Xem mã vé
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    className="btn btn-primary btn-sm"
                                    onClick={() =>
                                      navigate(staffGateSelectionPath("checkout"), {
                                        state: {
                                          sessionId: session.sessionId,
                                          licensePlate: session.licensePlateIn,
                                          qrPayload:
                                            session.ticket?.qrPayload || "",
                                        },
                                      })
                                    }
                                  >
                                    <LogOut size={16} />
                                    Checkout
                                  </button>
                                </div>
                              </div>
                            </article>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </section>
          )}

          {activeDetailSession && (
            <div
              className="modal-overlay"
              onClick={(event) =>
                event.target === event.currentTarget &&
                setActiveDetailSession(null)
              }
            >
              <div
                className="modal-panel manager-session-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="staff-active-detail-title"
              >
                <div className="manager-modal-header">
                  <div>
                    <h3 id="staff-active-detail-title" className="modal-title">
                      Chi tiết phiên gửi xe
                    </h3>
                    <p>Toàn bộ thông tin phiên được trả về từ hệ thống.</p>
                  </div>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    aria-label="Đóng"
                    onClick={() => setActiveDetailSession(null)}
                  >
                    <X size={20} />
                  </button>
                </div>
                <div className="manager-session-modal-hero">
                  <div className="manager-session-plate">
                    <small>VIỆT NAM</small>
                    <strong>{activeDetailSession.licensePlateIn}</strong>
                    {activeDetailSession.licensePlateOut &&
                      activeDetailSession.licensePlateOut !==
                        activeDetailSession.licensePlateIn && (
                        <span>Ra: {activeDetailSession.licensePlateOut}</span>
                      )}
                  </div>
                  <div>
                    <strong>
                      {activeDetailSession.driverFullName || "Khách vãng lai"}
                    </strong>
                    <span>
                      {activeDetailSession.vehicleTypeName || "Chưa rõ loại xe"}{" "}
                      ·{" "}
                      {activeDetailSession.reservationId
                        ? "Khách đặt trước"
                        : activeDetailSession.driverUserId
                          ? "Khách thành viên"
                          : "Khách vãng lai"}
                    </span>
                    <span
                      className={`manager-session-status status-${activeDetailSession.status.toLowerCase()}`}
                    >
                      <i />
                      {statusLabel(activeDetailSession.status)}
                    </span>
                  </div>
                </div>
                <section className="manager-session-detail-section">
                  <div className="manager-session-section-heading">
                    <Hash size={17} aria-hidden />
                    <div>
                      <h4>Thông tin định danh</h4>
                      <p>Các mã liên kết của phiên trong backend.</p>
                    </div>
                  </div>
                  <div className="manager-session-detail-grid manager-session-detail-grid--ids">
                    <div>
                      <Fingerprint size={17} aria-hidden />
                      <span>Mã phiên</span>
                      <code>{activeDetailSession.sessionId}</code>
                    </div>
                    <div>
                      <QrCode size={17} aria-hidden />
                      <span>Mã đặt chỗ</span>
                      <code>
                        {activeDetailSession.reservationId || "Không có"}
                      </code>
                    </div>
                    <div>
                      <UserRound size={17} aria-hidden />
                      <span>Mã người lái</span>
                      <code>
                        {activeDetailSession.driverUserId || "Khách vãng lai"}
                      </code>
                    </div>
                    <div>
                      <CarFront size={17} aria-hidden />
                      <span>Mã loại phương tiện</span>
                      <code>{activeDetailSession.vehicleTypeId || "—"}</code>
                    </div>
                  </div>
                </section>

                <section className="manager-session-detail-section">
                  <div className="manager-session-section-heading">
                    <CalendarDays size={17} aria-hidden />
                    <div>
                      <h4>Thời gian và biển số</h4>
                      <p>Thông tin check-in, checkout và thời lượng gửi xe.</p>
                    </div>
                  </div>
                  <div className="manager-session-detail-grid">
                    <div>
                      <CalendarDays size={17} aria-hidden />
                      <span>Thời gian vào</span>
                      <strong>
                        {formatDateTime(activeDetailSession.entryTime)}
                      </strong>
                    </div>
                    <div>
                      <CalendarDays size={17} aria-hidden />
                      <span>Thời gian ra</span>
                      <strong>
                        {activeDetailSession.exitTime
                          ? formatDateTime(activeDetailSession.exitTime)
                          : "Chưa checkout"}
                      </strong>
                    </div>
                    <div>
                      <Clock3 size={17} aria-hidden />
                      <span>Tổng thời lượng</span>
                      <strong>
                        {parkingDuration(
                          activeDetailSession.entryTime,
                          currentTime,
                        )}
                      </strong>
                    </div>
                    <div>
                      <CarFront size={17} aria-hidden />
                      <span>Biển số vào → ra</span>
                      <strong>
                        {activeDetailSession.licensePlateIn || "—"} →{" "}
                        {activeDetailSession.licensePlateOut || "Chưa ghi nhận"}
                      </strong>
                    </div>
                  </div>
                </section>

                <section className="manager-session-detail-section">
                  <div className="manager-session-section-heading">
                    <MapPin size={17} aria-hidden />
                    <div>
                      <h4>Cổng và vị trí đỗ</h4>
                      <p>
                        Đối chiếu vị trí được phân bổ với dữ liệu vận hành thực
                        tế.
                      </p>
                    </div>
                  </div>
                  <div className="manager-session-detail-grid manager-session-detail-grid--route">
                    <div>
                      <MapPin size={17} aria-hidden />
                      <span>Cổng vào</span>
                      <strong>
                        {activeDetailSession.entryGateName || "Chưa xác định"}
                      </strong>
                      <code>{activeDetailSession.entryGateId}</code>
                    </div>
                    <div>
                      <MapPin size={17} aria-hidden />
                      <span>Cổng ra</span>
                      <strong>
                        {activeDetailSession.exitGateName || "Chưa checkout"}
                      </strong>
                      <code>{activeDetailSession.exitGateId || "Chưa có"}</code>
                    </div>
                    <div>
                      <ParkingSquare size={17} aria-hidden />
                      <span>Slot được xếp</span>
                      <strong>
                        {activeDetailSession.assignedSlotCode ||
                          "Chưa xếp slot"}
                      </strong>
                      <code>
                        {activeDetailSession.assignedSlotId || "Chưa có"}
                      </code>
                    </div>
                    <div>
                      <ParkingSquare size={17} aria-hidden />
                      <span>Slot thực tế</span>
                      <strong>
                        {activeDetailSession.actualSlotCode || "Chưa ghi nhận"}
                      </strong>
                      <code>
                        {activeDetailSession.actualSlotId || "Chưa có"}
                      </code>
                    </div>
                  </div>
                </section>

                <section className="manager-session-detail-section">
                  <div className="manager-session-section-heading">
                    <CreditCard size={17} aria-hidden />
                    <div>
                      <h4>Thanh toán</h4>
                      <p>Khoản phí checkout được liên kết với phiên gửi xe.</p>
                    </div>
                  </div>
                  <div className="manager-session-detail-grid">
                    <div>
                      <CreditCard size={17} aria-hidden />
                      <span>Phí gửi xe</span>
                      <strong>
                        {feePreviews[activeDetailSession.sessionId]
                          ?.isCoveredBySubscription
                          ? "Đã gồm trong gói tháng · 0 ₫"
                          : feePreviews[activeDetailSession.sessionId]
                            ? `${formatCurrency(feePreviews[activeDetailSession.sessionId].amount)} (tạm tính)${(feePreviews[activeDetailSession.sessionId].depositAmount ?? 0) > 0 ? ` · Đã trừ ${formatCurrency(feePreviews[activeDetailSession.sessionId].depositAmount ?? 0)} tiền cọc` : ""}`
                        : typeof activeDetailSession.paymentAmount === "number"
                          ? formatCurrency(activeDetailSession.paymentAmount)
                          : feePreviewErrors[activeDetailSession.sessionId] ||
                            "Đang tính phí..."}
                      </strong>
                    </div>
                    {feePreviews[activeDetailSession.sessionId] &&
                      !feePreviews[activeDetailSession.sessionId]
                        .isCoveredBySubscription && (
                        <>
                          <div>
                            <Clock3 size={17} aria-hidden />
                            <span>Số giờ tính phí</span>
                            <strong>
                              {
                                feePreviews[activeDetailSession.sessionId]
                                  .billedHours
                              }{" "}
                              giờ
                            </strong>
                          </div>
                          <div>
                            <CreditCard size={17} aria-hidden />
                            <span>Chính sách áp dụng</span>
                            <strong>
                              {formatCurrency(
                                feePreviews[activeDetailSession.sessionId]
                                  .basePrice ?? 0,
                              )}{" "}
                              /{" "}
                              {feePreviews[activeDetailSession.sessionId]
                                .baseHours ?? 0}{" "}
                              giờ · thêm{" "}
                              {formatCurrency(
                                feePreviews[activeDetailSession.sessionId]
                                  .extraHourPrice ?? 0,
                              )}
                              /giờ
                              {feePreviews[activeDetailSession.sessionId]
                                .hasNightSurcharge
                                ? ` · ${
                                    feePreviews[activeDetailSession.sessionId]
                                      .nightSurchargeCount
                                  } đêm × ${formatCurrency(
                                    feePreviews[activeDetailSession.sessionId]
                                      .nightSurcharge ?? 0,
                                  )}`
                                : ""}
                            </strong>
                          </div>
                        </>
                      )}
                    <div>
                      <Activity size={17} aria-hidden />
                      <span>Trạng thái</span>
                      <strong>
                        {paymentStatusLabel(activeDetailSession.paymentStatus)}
                      </strong>
                    </div>
                    <div>
                      <CreditCard size={17} aria-hidden />
                      <span>Phương thức</span>
                      <strong>
                        {activeDetailSession.paymentMethod || "Chưa ghi nhận"}
                      </strong>
                    </div>
                    <div>
                      <CalendarDays size={17} aria-hidden />
                      <span>Thời gian thanh toán</span>
                      <strong>
                        {activeDetailSession.paymentTime
                          ? formatDateTime(activeDetailSession.paymentTime)
                          : "Chưa ghi nhận"}
                      </strong>
                    </div>
                  </div>
                </section>

                <section className="manager-session-detail-section">
                  <div className="manager-session-section-heading">
                    <ImageIcon size={17} aria-hidden />
                    <div>
                      <h4>Ảnh phương tiện vào / ra</h4>
                      <p>
                        Ảnh được nhân viên ghi nhận tại thời điểm check-in và
                        checkout.
                      </p>
                    </div>
                  </div>
                  <div className="manager-session-image-grid">
                    <article>
                      <div>
                        {activeDetailSession.entryImageUrl ? (
                          <a
                            href={activeDetailSession.entryImageUrl}
                            target="_blank"
                            rel="noreferrer"
                            aria-label="Mở ảnh xe lúc vào"
                          >
                            <img
                              src={activeDetailSession.entryImageUrl}
                              alt={`Xe ${activeDetailSession.licensePlateIn} lúc vào`}
                              loading="lazy"
                            />
                          </a>
                        ) : (
                          <span className="manager-session-image-empty">
                            <ImageIcon size={28} aria-hidden />
                            Chưa có ảnh lúc vào
                          </span>
                        )}
                      </div>
                      <strong>Ảnh lúc vào</strong>
                      <small>
                        {formatDateTime(activeDetailSession.entryTime)}
                      </small>
                    </article>
                    <article>
                      <div>
                        {activeDetailSession.exitImageUrl ? (
                          <a
                            href={activeDetailSession.exitImageUrl}
                            target="_blank"
                            rel="noreferrer"
                            aria-label="Mở ảnh xe lúc ra"
                          >
                            <img
                              src={activeDetailSession.exitImageUrl}
                              alt={`Xe ${activeDetailSession.licensePlateOut || activeDetailSession.licensePlateIn} lúc ra`}
                              loading="lazy"
                            />
                          </a>
                        ) : (
                          <span className="manager-session-image-empty">
                            <ImageIcon size={28} aria-hidden />
                            Chưa có ảnh lúc ra
                          </span>
                        )}
                      </div>
                      <strong>Ảnh lúc ra</strong>
                      <small>
                        {activeDetailSession.exitTime
                          ? formatDateTime(activeDetailSession.exitTime)
                          : "Xe chưa checkout"}
                      </small>
                    </article>
                  </div>
                </section>

                {activeDetailSession.ticket?.qrCodeDataUrl && (
                  <div className="manager-session-ticket">
                    <QrCode size={21} aria-hidden />
                    <div>
                      <strong>Mã vé phiên đang hoạt động</strong>
                      <code>{activeDetailSession.ticket.qrPayload}</code>
                    </div>
                    <img
                      src={activeDetailSession.ticket.qrCodeDataUrl}
                      alt={`QR vé xe ${activeDetailSession.licensePlateIn}`}
                    />
                  </div>
                )}
                <div className="form-actions manager-session-modal-actions">
                  {activeDetailSession.ticket?.qrCodeDataUrl && (
                    <button
                      type="button"
                      className="btn manager-session-modal-edit"
                      onClick={() => {
                        setTicketSession(activeDetailSession);
                        setActiveDetailSession(null);
                      }}
                    >
                      <QrCode size={16} />
                      Xem mã vé
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() =>
                      navigate(staffGateSelectionPath("checkout"), {
                        state: {
                          sessionId: activeDetailSession.sessionId,
                          licensePlate: activeDetailSession.licensePlateIn,
                          qrPayload:
                            activeDetailSession.ticket?.qrPayload || "",
                        },
                      })
                    }
                  >
                    <LogOut size={16} />
                    Làm checkout
                  </button>
                </div>
              </div>
            </div>
          )}

          <ParkingTicketModal
            session={ticketSession}
            floorName={gateContext?.floorName}
            onClose={() => setTicketSession(null)}
          />
        </div>
      </div>
    </StaffPageShell>
  );
}
