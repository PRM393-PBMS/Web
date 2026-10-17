import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'

import Layout from './components/Layout'

import { AuthProvider, useAuth } from './context/AuthContext'

import { BookingProvider } from './context/BookingProvider'

import Login from './pages/Login'

import StaffDashboard from './pages/staff/Dashboard'

import StaffScanPlate from './pages/staff/ScanPlate'

import StaffCheckout from './pages/staff/Checkout'
import StaffGateSelection from './pages/staff/GateSelection'

import StaffException from './pages/staff/Exception'

import AdminDashboard from './pages/admin/Dashboard'

import AdminUsers from './pages/admin/Users'

import AdminRoles from './pages/admin/Roles'

import ManagerDashboard from './pages/manager/Dashboard'

import ManagerVehicleTypes from './pages/manager/VehicleTypes'

import ManagerFloorAssignment from './pages/manager/FloorAssignment'

import ManagerSlots from './pages/manager/Slots'

import ManagerPricing from './pages/manager/Pricing'

import ManagerReports from './pages/manager/Reports'

import ManagerGates from './pages/manager/Gates'

import ManagerSubscriptionPackages from './pages/manager/SubscriptionPackages'
import ManagerMonthlySubscriptions from './pages/manager/MonthlySubscriptions'

import ManagerParkingSessions from './pages/manager/ParkingSessions'
import ManagerReservations from './pages/manager/Reservations'
import ManagerPayments from './pages/manager/Payments'
import ManagerVehicleChangeRequests from './pages/manager/VehicleChangeRequests'
import ManagerIncidents from './pages/manager/Incidents'

function RoleAwareHome() {
  const { user } = useAuth()

  if (user?.role === 'staff') return <Navigate to="/staff/dashboard" replace />
  if (user?.role === 'manager') return <Navigate to="/manager/dashboard" replace />
  if (user?.role === 'admin') return <Navigate to="/admin/dashboard" replace />

  return <Login />
}

export default function App() {

  return (

    <AuthProvider>

      <BookingProvider>

        <BrowserRouter>

          <Routes>

            <Route element={<Layout />}>

              <Route index element={<RoleAwareHome />} />

              <Route path="dang-nhap" element={<Login />} />

              <Route path="staff/dashboard" element={<StaffDashboard />} />

              <Route path="staff/scan-plate" element={<StaffScanPlate />} />

              <Route path="staff/reservations" element={<StaffScanPlate initialPanel="reservations" />} />

              <Route path="staff/active-vehicles" element={<StaffScanPlate initialPanel="active-vehicles" />} />

              <Route path="staff/checkout" element={<StaffCheckout />} />

              <Route path="staff/chon-cong/:operation" element={<StaffGateSelection />} />

              <Route path="staff/exception" element={<StaffException />} />

              <Route path="admin/dashboard" element={<AdminDashboard />} />

              <Route path="admin/users" element={<AdminUsers />} />

              <Route path="admin/roles" element={<AdminRoles />} />

              <Route path="admin/system-config" element={<Navigate to="/admin/roles" replace />} />

              <Route path="manager/dashboard" element={<ManagerDashboard />} />

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

              <Route path="*" element={<Navigate to="/" replace />} />

            </Route>

          </Routes>

        </BrowserRouter>

      </BookingProvider>

    </AuthProvider>

  )

}


