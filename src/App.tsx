import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import ErrorBoundary from "./components/ErrorBoundary";
import Layout from "./components/Layout";

import { AuthProvider } from "./context/AuthContext";

import Login from "./pages/Login";

// Mỗi khu (staff, manager, admin) tải riêng để lần mở đầu không phải tải cả ứng dụng.
const StaffDashboard = lazy(() => import("./pages/staff/Dashboard"));
const StaffScanPlate = lazy(() => import("./pages/staff/ScanPlate"));
const StaffCheckout = lazy(() => import("./pages/staff/Checkout"));
const StaffGateSelection = lazy(() => import("./pages/staff/GateSelection"));
const StaffException = lazy(() => import("./pages/staff/Exception"));

const AdminDashboard = lazy(() => import("./pages/admin/Dashboard"));
const AdminUsers = lazy(() => import("./pages/admin/Users"));
const AdminRoles = lazy(() => import("./pages/admin/Roles"));
const AdminReports = lazy(() => import("./pages/admin/Reports"));
const AdminWallets = lazy(() => import("./pages/admin/Wallets"));
const AdminLotDesigner = lazy(() => import("./pages/admin/LotDesigner"));
const AdminParkings = lazy(() => import("./pages/admin/Parkings"));
const AdminFloors = lazy(() => import("./pages/admin/Floors"));

const ManagerDashboard = lazy(() => import("./pages/manager/Dashboard"));
const ManagerParkings = lazy(() => import("./pages/manager/Parkings"));
const ManagerVehicleTypes = lazy(() => import("./pages/manager/VehicleTypes"));
const ManagerFloorAssignment = lazy(() => import("./pages/manager/FloorAssignment"));
const ManagerSlots = lazy(() => import("./pages/manager/Slots"));
const ManagerPricing = lazy(() => import("./pages/manager/Pricing"));
const ManagerReports = lazy(() => import("./pages/manager/Reports"));
const ManagerGates = lazy(() => import("./pages/manager/Gates"));
const ManagerSubscriptionPackages = lazy(() => import("./pages/manager/SubscriptionPackages"));
const ManagerMonthlySubscriptions = lazy(() => import("./pages/manager/MonthlySubscriptions"));
const ManagerParkingSessions = lazy(() => import("./pages/manager/ParkingSessions"));
const ManagerReservations = lazy(() => import("./pages/manager/Reservations"));
const ManagerPayments = lazy(() => import("./pages/manager/Payments"));
const ManagerVehicleChangeRequests = lazy(() => import("./pages/manager/VehicleChangeRequests"));
const ManagerIncidents = lazy(() => import("./pages/manager/Incidents"));
const ManagerWallets = lazy(() => import("./pages/manager/Wallets"));
const ManagerPromoCodes = lazy(() => import("./pages/manager/PromoCodes"));
const ManagerInvoiceRequests = lazy(() => import("./pages/manager/InvoiceRequests"));

function PageLoading() {
  return (
    <div className="page-loading" role="status">
      Đang tải trang…
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <ErrorBoundary>
        <Suspense fallback={<PageLoading />}>
          <Routes>
            <Route element={<Layout />}>
              <Route index element={<Navigate to="/dang-nhap" replace />} />
              <Route path="dang-nhap" element={<Login />} />

              <Route path="staff/dashboard" element={<StaffDashboard />} />
              <Route path="staff/scan-plate" element={<StaffScanPlate />} />
              <Route
                path="staff/reservations"
                element={<StaffScanPlate initialPanel="reservations" />}
              />
              <Route
                path="staff/active-vehicles"
                element={<StaffScanPlate initialPanel="active-vehicles" />}
              />
              <Route path="staff/checkout" element={<StaffCheckout />} />
              <Route path="staff/chon-cong/:operation" element={<StaffGateSelection />} />
              <Route path="staff/exception" element={<StaffException />} />

              <Route path="admin/dashboard" element={<AdminDashboard />} />
              <Route path="admin/users" element={<AdminUsers />} />
              <Route path="admin/roles" element={<AdminRoles />} />
              <Route path="admin/reports" element={<AdminReports />} />
              <Route path="admin/wallets" element={<AdminWallets />} />
              <Route path="admin/lot-designer" element={<AdminLotDesigner />} />
              <Route path="admin/parkings" element={<AdminParkings />} />
              <Route path="admin/floors" element={<AdminFloors />} />

              <Route path="manager/dashboard" element={<ManagerDashboard />} />
              <Route path="manager/parkings" element={<ManagerParkings />} />
              <Route path="manager/vehicle-types" element={<ManagerVehicleTypes />} />
              <Route path="manager/floor-assignment" element={<ManagerFloorAssignment />} />
              <Route path="manager/slots" element={<ManagerSlots />} />
              <Route path="manager/pricing" element={<ManagerPricing />} />
              <Route path="manager/reports" element={<ManagerReports />} />
              <Route path="manager/gates" element={<ManagerGates />} />
              <Route path="manager/subscriptions" element={<ManagerSubscriptionPackages />} />
              <Route path="manager/monthly-subscriptions" element={<ManagerMonthlySubscriptions />} />
              <Route path="manager/sessions" element={<ManagerParkingSessions />} />
              <Route path="manager/reservations" element={<ManagerReservations />} />
              <Route path="manager/payments" element={<ManagerPayments />} />
              <Route path="manager/vehicle-change-requests" element={<ManagerVehicleChangeRequests />} />
              <Route path="manager/incidents" element={<ManagerIncidents />} />
              <Route path="manager/wallets" element={<ManagerWallets />} />
              <Route path="manager/promo-codes" element={<ManagerPromoCodes />} />
              <Route path="manager/invoice-requests" element={<ManagerInvoiceRequests />} />

              <Route path="*" element={<Navigate to="/dang-nhap" replace />} />
            </Route>
          </Routes>
        </Suspense>
        </ErrorBoundary>
      </BrowserRouter>
    </AuthProvider>
  );
}
