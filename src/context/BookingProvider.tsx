import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  useEffect,
  type ReactNode,
} from "react";
import type {
  BookingDraft,
  BookingRecord,
  PaymentMethod,
} from "../types/booking";
import { addHours } from "../utils/pricing";
import { useAuth } from "./AuthContext";
import { apiClient } from "../config/api";
import { parseBackendUtcDate } from "../utils/dateTime";
import { normalizeLicensePlate } from "../utils/licensePlate";

interface PricingPolicyRaw {
  policyId: string;
  vehicleTypeName: string;
  basePrice: number;
  baseHours: number;
  extraHourPrice: number;
  nightSurcharge: number;
  status: string;
}

interface PricingPolicyDetails {
  basePrice: number;
  baseHours: number;
  nightSurcharge: number;
  extraHourPrice: number;
}

const BOOKINGS_KEY = "pbms_bookings";

function loadAllBookings(): BookingRecord[] {
  try {
    const raw = localStorage.getItem(BOOKINGS_KEY);
    return raw
      ? (JSON.parse(raw) as BookingRecord[]).map((booking) => ({
          ...booking,
          vehiclePlate: normalizeLicensePlate(booking.vehiclePlate),
        }))
      : [];
  } catch {
    return [];
  }
}

function saveAllBookings(list: BookingRecord[]) {
  localStorage.setItem(BOOKINGS_KEY, JSON.stringify(list));
}

interface BookingContextValue {
  draft: BookingDraft | null;
  setDraft: (draft: BookingDraft | null) => void;
  bookings: BookingRecord[];
  getAllBookings: () => BookingRecord[];
  getMyBookings: () => BookingRecord[];
  completePayment: (method: PaymentMethod) => BookingRecord | null;
  cancelBooking: (id: string) => void;
  updateBookingStatus: (id: string, status: BookingRecord["status"]) => void;
  getPolicy: (vehicle: "car" | "bike") => PricingPolicyDetails | null;
  getAllPolicies: () => PricingPolicyRaw[];
  pricingLoading: boolean;
}

const BookingContext = createContext<BookingContextValue | null>(null);

export function BookingProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [draft, setDraft] = useState<BookingDraft | null>(null);
  const [bookings, setBookings] = useState<BookingRecord[]>(() =>
    loadAllBookings(),
  );
  const [policies, setPolicies] = useState<PricingPolicyRaw[]>([]);
  const [pricingLoading, setPricingLoading] = useState(true);

  useEffect(() => {
    apiClient
      .get<{ isSuccess: boolean; result: PricingPolicyRaw[] }>("/PricingPolicy")
      .then((res) => {
        if (res && res.isSuccess && Array.isArray(res.result)) {
          setPolicies(res.result);
        }
      })
      .catch((err) => console.error("Failed to fetch pricing policies:", err))
      .finally(() => setPricingLoading(false));
  }, []);

  const getPolicy = useCallback(
    (vehicle: "car" | "bike") => {
      const targetName = vehicle === "car" ? "ô tô" : "xe máy";
      const found = policies.find(
        (p) =>
          p.vehicleTypeName.toLowerCase() === targetName &&
          p.status === "Active",
      );
      if (found) {
        return {
          basePrice: found.basePrice,
          baseHours: found.baseHours,
          nightSurcharge: found.nightSurcharge,
          extraHourPrice: found.extraHourPrice,
        };
      }
      return null;
    },
    [policies],
  );

  const getMyBookings = useCallback(() => {
    if (!user) return [];
    return bookings
      .filter((b) => b.userEmail === user.email)
      .sort(
        (a, b) =>
          parseBackendUtcDate(b.createdAt).getTime() -
          parseBackendUtcDate(a.createdAt).getTime(),
      );
  }, [bookings, user]);

  const getAllBookings = useCallback(() => {
    return [...bookings].sort(
      (a, b) =>
        parseBackendUtcDate(b.createdAt).getTime() -
        parseBackendUtcDate(a.createdAt).getTime(),
    );
  }, [bookings]);

  const completePayment = useCallback(
    (method: PaymentMethod): BookingRecord | null => {
      if (!user || !draft || draft.spots.length === 0) return null;

      const isPreRegistered = draft.isPreRegistered;
      const isMonthly = draft.isMonthlyCustomer;
      const policy = getPolicy(draft.vehicleType ?? "car");
      if (!isMonthly && !policy) return null;
      const hourlyRate = policy?.basePrice ?? 0;
      const total = isPreRegistered
        ? (draft.depositAmount ?? hourlyRate)
        : isMonthly
          ? 0
          : draft.spots.length * draft.hours * hourlyRate;
      const endTime = isPreRegistered
        ? addHours(draft.startTime, 1)
        : addHours(draft.startTime, draft.hours);
      const now = new Date().toISOString();

      const record: BookingRecord = {
        id: `BK-${Date.now()}`,
        userEmail: user.email,
        floorId: draft.floorId,
        floorName: draft.floorName,
        spots: draft.spots,
        startTime: draft.startTime,
        endTime,
        hours: draft.hours,
        pricePerHour: isPreRegistered ? total : hourlyRate,
        totalAmount: total,
        vehiclePlate: normalizeLicensePlate(draft.vehiclePlate),
        status: "paid",
        paymentMethod: method,
        createdAt: now,
        paidAt: now,
        isPreRegistered,
        vehicleType: draft.vehicleType,
        isMonthlyCustomer: draft.isMonthlyCustomer,
      };

      const next = [record, ...bookings];
      setBookings(next);
      saveAllBookings(next);
      setDraft(null);
      return record;
    },
    [user, draft, bookings, getPolicy],
  );

  const cancelBooking = useCallback((id: string) => {
    setBookings((prev) => {
      const next = prev.map((b) =>
        b.id === id ? { ...b, status: "cancelled" as const } : b,
      );
      saveAllBookings(next);
      return next;
    });
  }, []);

  const updateBookingStatus = useCallback(
    (id: string, status: BookingRecord["status"]) => {
      setBookings((prev) => {
        const next = prev.map((b) => (b.id === id ? { ...b, status } : b));
        saveAllBookings(next);
        return next;
      });
    },
    [],
  );

  const getAllPolicies = useCallback(() => {
    return policies;
  }, [policies]);

  const value = useMemo(
    () => ({
      draft,
      setDraft,
      bookings,
      getAllBookings,
      getMyBookings,
      completePayment,
      cancelBooking,
      updateBookingStatus,
      getPolicy,
      getAllPolicies,
      pricingLoading,
    }),
    [
      draft,
      bookings,
      getAllBookings,
      getMyBookings,
      completePayment,
      cancelBooking,
      updateBookingStatus,
      getPolicy,
      getAllPolicies,
      pricingLoading,
    ],
  );

  return (
    <BookingContext.Provider value={value}>{children}</BookingContext.Provider>
  );
}

export function useBooking() {
  const ctx = useContext(BookingContext);
  if (!ctx) throw new Error("useBooking must be used within BookingProvider");
  return ctx;
}
