import { apiClient } from '../config/api'

export interface ApiResponse<T = unknown> {
  statusCode: number
  message: string
  isSuccess: boolean
  result?: T
}

export interface UserDto {
  userId: string
  userName: string
  email: string
  fullName: string
  phoneNumber: string
  status: string
  roleName: string
  createdAt: string
  updatedAt: string
}

export interface VehicleTypeDto {
  vehicleTypeId: string
  typeName: string
}

export interface ParkingSlotDto {
  slotId: string
  floorId: string
  floorName?: string
  slotCode: string
  vehicleTypeId: string
  vehicleTypeName?: string
  status: string
  isResident: boolean
}

export interface GateDto {
  gateId: string
  gateName: string
  gateType: 'Entry' | 'Exit' | string
  floorId: string
  floorName?: string
}

export interface ParkingSessionTicket {
  qrPayload: string
  qrCodeDataUrl: string
}

export interface CreateReservationResponse {
  reservationId: string
  paymentId: string
  depositAmount: number
  paymentLinkId: string
  paymentUrl: string
  orderCode: string
  ticket?: ParkingSessionTicket
}

export interface ReservationPaymentStatusResponse {
  paymentStatus?: string
  reservationStatus?: string
  reservationId?: string
  ticket?: ParkingSessionTicket
}

export interface ReservationDto {
  reservationId: string
  userId: string
  userFullName?: string
  vehicleTypeId: string
  vehicleTypeName?: string
  expectedEntryTime: string
  status: string
  createdAt?: string
  licensePlate?: string
  user?: {
    fullName?: string
    email?: string
    phoneNumber?: string
  }
  vehicleType?: { typeName: string }
  payments?: Array<{ amount: number; paymentStatus: string }>
  parkingSessions?: ParkingSessionDto[]
  ticket?: ParkingSessionTicket
}

export interface MonthlySubscriptionDto {
  subscriptionId: string
  userId: string
  fullName?: string
  licensePlate: string
  vehicleType?: string
  packageName?: string
  startDate: string
  endDate: string
  price: number
  status: string
  fixedSlot?: string
}

export interface SubscriptionPackageDto {
  packageId: string
  packageName: string
  vehicleTypeId: string
  vehicleTypeName?: string
  durationMonths: number
  price: number
  requireFixedSlot: boolean
  description?: string
  status: string
}

export interface RegisterMonthlySubscriptionPaymentDto {
  subscriptionId: string
  paymentId: string
  orderCode: string
  amount: number
  paymentLinkId: string
  paymentUrl: string
}

export interface ParkingFeePreview {
  sessionId: string
  licensePlate: string
  entryTime: string
  exitTime: string
  totalHours: number
  amount: number
}

export interface SubscriptionRenewalDto {
  renewalId: string
  subscriptionId: string
  oldEndDate: string
  newEndDate: string
  amount: number
  renewalDate?: string
}

export interface FloorDto {
  floorId: string
  floorName: string
  dedicatedVehicleTypeId?: string | null
  dedicatedVehicleTypeName?: string | null
  totalCapacity: number
  isResident: boolean
}

export interface VehicleChangeRequestDto {
  requestId: string
  subscriptionId: string
  oldLicensePlate?: string
  newLicensePlate?: string
  reason?: string
  rejectionReason?: string
  status?: string
  createdAt?: string
  processedAt?: string
  userFullName?: string
  packageName?: string
  handledByStaffId?: string
  handledByFullName?: string
}

export interface ParkingSessionDto {
  sessionId: string
  reservationId?: string
  driverUserId?: string
  driverFullName?: string
  licensePlateIn: string
  licensePlateOut?: string
  entryImageUrl?: string
  driverEntryImageUrl?: string
  exitImageUrl?: string
  driverExitImageUrl?: string
  vehicleTypeId: string
  vehicleTypeName?: string
  entryTime: string
  exitTime?: string
  entryGateId: string
  entryGateName?: string
  exitGateId?: string
  exitGateName?: string
  assignedSlotId?: string
  assignedSlotCode?: string
  actualSlotId?: string
  actualSlotCode?: string
  status: string
  paymentAmount?: number
  paymentStatus?: string
  paymentMethod?: string
  paymentTime?: string
  ticket?: ParkingSessionTicket
}

export interface ParkingAvailabilityDto {
  floorId: string
  floorName: string
  vehicleTypeId?: string
  vehicleTypeName?: string
  totalSlots: number
  availableSlots: number
  occupiedSlots: number
  assignedSlots: number
}

export interface ParkingQrDecodeResult {
  qrPayload: string
  codeType: 'Session' | 'Reservation' | 'SessionAndReservation' | string
  reservationId?: string
  sessionId?: string
  imageUrl?: string
}

export interface PlateRecognitionCandidate {
  licensePlate: string
  confidence: number
  regionCode?: string
}

export interface PlateRecognitionResult {
  imageUrl: string
  licensePlate?: string
  confidence?: number
  regionCode?: string
  provider?: string
  providerStatusCode?: number
  providerError?: string
  providerResponse?: string
  minimumConfidence?: number
  message?: string
  candidates?: PlateRecognitionCandidate[]
}

export interface ParkingFeePreview {
  sessionId: string
  licensePlate: string
  entryTime: string
  exitTime: string
  totalHours: number
  billedHours: number
  grossAmount?: number
  depositAmount?: number
  amount: number
  pricingPolicyId?: string
  basePrice?: number
  baseHours?: number
  extraHourPrice?: number
  nightSurcharge?: number
  nightSurchargeCount: number
  hasNightSurcharge: boolean
  isCoveredBySubscription: boolean
}

export interface ParkingCheckInRequest {
  customerType: 'Guest' | 'Resident' | 'Reservation'
  qrPayload?: string
  reservationId?: string
  licensePlate?: string
  vehicleTypeId?: string
  gateId: string
  entryImageUrl?: string
  driverEntryImageUrl?: string
}

export interface ParkingCheckInResponse extends Partial<ParkingSessionDto> {
  licensePlate?: string
  gateName?: string
  ticket?: ParkingSessionTicket
}

export interface ParkingCheckOutRequest {
  customerType?: 'Guest' | 'Resident' | 'Reservation'
  qrPayload?: string
  sessionId?: string
  licensePlate?: string
  licensePlateOut?: string
  gateId: string
  paymentMethod?: 'Cash' | 'PayOS' | string
  exitImageUrl?: string
  driverExitImageUrl?: string
}

export interface ParkingOnlinePayment {
  paymentUrl?: string
  paymentQrCodeDataUrl?: string
  paymentLinkId?: string
  orderCode?: string
  PaymentUrl?: string
  PaymentQrCodeDataUrl?: string
  PaymentLinkId?: string
  OrderCode?: string
}

export interface ParkingCheckoutPayment {
  paymentId: string
  sessionId?: string
  amount: number
  paymentMethod: string
  paymentType: string
  paymentTime: string
  paymentStatus: 'Pending' | 'Success' | 'Failed' | string
  transactionReference?: string
}

export interface ParkingCheckOutResponse {
  session?: ParkingSessionDto
  payment?: ParkingCheckoutPayment
  fee?: ParkingFeePreview
  onlinePayment?: ParkingOnlinePayment
  Session?: ParkingSessionDto
  Payment?: ParkingCheckoutPayment
  Fee?: ParkingFeePreview
  OnlinePayment?: ParkingOnlinePayment
}

export const profileApi = {
  get: () => apiClient.get<ApiResponse<UserDto>>('/profile'),
  update: (data: { fullName?: string; phoneNumber?: string; password?: string }) =>
    apiClient.put<ApiResponse<UserDto>>('/profile', data),
}

export const reservationApi = {
  create: (data: {
    expectedEntryTime: string
    vehicleTypeName: string
    licensePlate: string
  }) => apiClient.post<ApiResponse<CreateReservationResponse>>('/reservations', data),

  getMy: () => apiClient.get<ApiResponse<ReservationDto[]>>('/reservations/my-reservations'),

  getAll: (params?: { status?: string; date?: string }) => {
    const query = new URLSearchParams()
    if (params?.status) query.set('status', params.status)
    if (params?.date) query.set('date', params.date)
    const q = query.toString()
    return apiClient.get<ApiResponse<ReservationDto[]>>(`/reservations${q ? `?${q}` : ''}`)
  },

  getById: (id: string) => apiClient.get<ApiResponse<ReservationDto>>(`/reservations/${id}`),

  updateStatus: (id: string, status: string) =>
    apiClient.put<ApiResponse>(`/reservations/${id}/status`, { status }),

  cancel: (id: string) => apiClient.put<ApiResponse>(`/reservations/${id}/cancel`),

  changeTime: (id: string, newExpectedTime: string) =>
    apiClient.put<ApiResponse>(`/reservations/${id}/change-time`, newExpectedTime),

  recreatePayment: (id: string) =>
    apiClient.post<ApiResponse<CreateReservationResponse>>(`/reservations/${id}/recreate-payment`),

  checkPayment: (orderCode: string) =>
    apiClient.get<ApiResponse<ReservationPaymentStatusResponse>>(`/reservations/check-payment-status/${orderCode}`),
}

export const subscriptionApi = {
  getPackages: () => apiClient.get<ApiResponse<SubscriptionPackageDto[]>>('/SubscriptionPackage'),

  register: (data: { packageId: string; licensePlate: string; fixedSlotId?: string }) =>
    apiClient.post<ApiResponse<RegisterMonthlySubscriptionPaymentDto>>('/MonthlySubscription/register', data),

  createPayment: (subscriptionId: string) =>
    apiClient.post<ApiResponse<RegisterMonthlySubscriptionPaymentDto>>(
      `/MonthlySubscription/payment/${subscriptionId}`,
    ),

  getMy: () => apiClient.get<ApiResponse<MonthlySubscriptionDto[]>>('/MonthlySubscription/my'),

  cancel: (subscriptionId: string) =>
    apiClient.put<ApiResponse>(`/MonthlySubscription/${subscriptionId}/cancel`),
}

export const vehicleTypeApi = {
  getAll: () => apiClient.get<ApiResponse<VehicleTypeDto[]>>('/VehicleType'),
}

export const parkingSlotApi = {
  getAll: () => apiClient.get<ApiResponse<ParkingSlotDto[]>>('/ParkingSlot'),
  updateStatus: (slotId: string, status: string) =>
    apiClient.patch<ApiResponse<ParkingSlotDto>>(`/ParkingSlot/${slotId}/status`, { status }),
}

export const subscriptionRenewalApi = {
  renew: (subscriptionId: string, packageId: string) =>
    apiClient.post<ApiResponse<RegisterMonthlySubscriptionPaymentDto>>(
      `/SubscriptionRenewal/${subscriptionId}/renew`,
      { packageId },
    ),

  getHistory: (subscriptionId: string) =>
    apiClient.get<ApiResponse<SubscriptionRenewalDto[]>>(
      `/SubscriptionRenewal/${subscriptionId}/renewals`,
    ),
}

export interface IncidentReportDto {
  incidentId: string
  sessionId?: string
  reportedByUserId: string
  reportedByUserFullName?: string
  issueType: string
  description: string
  proofImageUrl?: string
  status: string
  handledByStaffId?: string
  handledByStaffFullName?: string
  resolvedAt?: string
  resolutionNotes?: string
}

export const vehicleChangeRequestApi = {
  getMy: () =>
    apiClient.get<ApiResponse<VehicleChangeRequestDto[]>>('/VehicleChangeRequest/my-requests'),

  create: (data: { subscriptionId: string; newLicensePlate: string; reason: string }) =>
    apiClient.post<ApiResponse<VehicleChangeRequestDto>>('/VehicleChangeRequest/change-vehicle', data),

  update: (requestId: string, data: { newLicensePlate: string; reason: string }) =>
    apiClient.put<ApiResponse<VehicleChangeRequestDto>>(
      `/VehicleChangeRequest/change-vehicle/${requestId}`,
      data,
    ),

  remove: (requestId: string) =>
    apiClient.delete<ApiResponse>(`/VehicleChangeRequest/change-vehicle/${requestId}`),
}

export const gateApi = {
  getAll: () => apiClient.get<ApiResponse<GateDto[]>>('/Gate'),
}

export const floorApi = {
  getAll: () => apiClient.get<ApiResponse<FloorDto[]>>('/Floor'),
}

export const parkingOperationApi = {
  uploadAndRecognizePlate: (file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    return apiClient.post<PlateRecognitionResult>(
      '/ParkingOperation/upload-and-recognize-plate',
      formData
    )
  },

  uploadImage: (file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    return apiClient.post<{ imageUrl: string }>('/ParkingOperation/upload-image', formData)
  },

  uploadAndDecodeQr: (file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    return apiClient.post<ApiResponse<ParkingQrDecodeResult>>(
      '/ParkingOperation/upload-and-decode-qr',
      formData,
    )
  },

  resolveQrPayload: (qrPayload: string) =>
    apiClient.post<ApiResponse<ParkingQrDecodeResult>>(
      '/ParkingOperation/resolve-qr-payload',
      { qrPayload },
    ),

  checkIn: (data: ParkingCheckInRequest) =>
    apiClient.post<ApiResponse<ParkingCheckInResponse>>('/ParkingOperation/check-in', data),

  checkOut: (data: ParkingCheckOutRequest) =>
    apiClient.post<ApiResponse<ParkingCheckOutResponse>>('/ParkingOperation/check-out', data),

  getCheckoutPaymentStatus: (paymentId: string) =>
    apiClient.get<ApiResponse<ParkingCheckOutResponse>>(
      `/ParkingOperation/check-out/payment/${paymentId}`,
    ),

  confirmCashCheckout: (paymentId: string) =>
    apiClient.post<ApiResponse<ParkingCheckOutResponse>>(
      `/ParkingOperation/check-out/payment/${paymentId}/confirm-cash`,
    ),

  cancelCheckout: (paymentId: string) =>
    apiClient.post<ApiResponse<ParkingCheckOutResponse>>(
      `/ParkingOperation/check-out/payment/${paymentId}/cancel`,
    ),

  getFeePreview: (sessionId: string) =>
    apiClient.get<ApiResponse<ParkingFeePreview>>(
      `/ParkingOperation/fee-preview/${sessionId}`,
    ),

  getAvailability: (vehicleTypeId?: string, floorKeyword?: string) => {
    const params = new URLSearchParams()
    if (vehicleTypeId) params.set('vehicleTypeId', vehicleTypeId)
    if (floorKeyword) params.set('floorKeyword', floorKeyword)
    const q = params.toString()
    return apiClient.get<ApiResponse<ParkingAvailabilityDto[]>>(
      `/ParkingOperation/availability${q ? `?${q}` : ''}`,
    )
  },
}

export const parkingSessionApi = {
  getAll: () => apiClient.get<ApiResponse<ParkingSessionDto[]>>('/ParkingSession'),
  getMy: () => apiClient.get<ApiResponse<ParkingSessionDto[]>>('/ParkingSession/my'),
  getMyFeePreview: (sessionId: string) =>
    apiClient.get<ApiResponse<ParkingFeePreview>>(
      `/ParkingSession/my/${sessionId}/fee-preview`,
    ),
  getMyCheckoutPayment: (sessionId: string) =>
    apiClient.get<ApiResponse<ParkingCheckOutResponse>>(
      `/ParkingSession/my/${sessionId}/checkout-payment`,
    ),
}

export const incidentReportApi = {
  getAll: () => apiClient.get<ApiResponse<IncidentReportDto[]>>('/IncidentReport'),
  getAssignees: () =>
    apiClient.get<ApiResponse<UserDto[]>>('/IncidentReport/assignees'),
  getById: (id: string) => apiClient.get<ApiResponse<IncidentReportDto>>(`/IncidentReport/${id}`),
  getMy: () => apiClient.get<ApiResponse<IncidentReportDto[]>>('/IncidentReport/my-reports'),
  uploadProof: (file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    return apiClient.post<{ imageUrl: string }>('/IncidentReport/upload-proof', formData)
  },
  create: (data: {
    sessionId?: string
    reportedByUserId?: string
    issueType: string
    description: string
    proofImageUrl?: string
    status?: string
    handledByStaffId?: string
  }) => apiClient.post<ApiResponse<IncidentReportDto>>('/IncidentReport', data),
  update: (data: {
    incidentId: string
    sessionId?: string
    reportedByUserId: string
    issueType: string
    description: string
    proofImageUrl?: string
    status: string
    handledByStaffId?: string
    resolvedAt?: string
    resolutionNotes?: string
  }) => apiClient.put<ApiResponse<IncidentReportDto>>('/IncidentReport', data),
  remove: (id: string) => apiClient.delete<ApiResponse>(`/IncidentReport/${id}`),
  assign: (id: string, staffId: string) =>
    apiClient.put<ApiResponse<IncidentReportDto>>(`/IncidentReport/${id}/assign/${staffId}`, {}),
  resolve: (id: string, staffId: string, resolutionNotes: string) =>
    apiClient.put<ApiResponse<IncidentReportDto>>(`/IncidentReport/${id}/resolve/${staffId}`, { resolutionNotes }),
}
