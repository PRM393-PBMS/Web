import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  AlertCircle,
  Camera,
  CarFront,
  CheckCircle2,
  Clock3,
  CreditCard,
  ExternalLink,
  ImageIcon,
  LogOut,
  MapPin,
  QrCode,
  ReceiptText,
  ShieldCheck,
  XCircle,
} from 'lucide-react'
import StaffPageShell from '../../components/StaffPageShell'
import PlateCameraCapture from '../../components/PlateCameraCapture'
import QrCameraScanner from '../../components/QrCameraScanner'
import {
  parkingOperationApi,
  parkingSessionApi,
  parkingSlotApi,
  gateApi,
  type ParkingCheckoutPayment,
  type GateDto,
  type ParkingCheckOutResponse,
  type ParkingFeePreview,
  type ParkingOnlinePayment,
  type ParkingQrDecodeResult,
  type ParkingSessionDto,
} from '../../utils/apiServices'
import { formatNowInVietnamTime } from '../../utils/dateTime'
import { formatCurrency } from '../../utils/pricing'
import { normalizeLicensePlate } from '../../utils/licensePlate'
import { readStaffGateContext, staffGateSelectionPath } from '../../utils/staffGateContext'
import { savePaymentReturnContext } from '../../utils/paymentReturnContext'
import {
  buildPlateRecognitionExceptionFeedback,
  buildPlateRecognitionFeedback,
} from '../../utils/plateRecognitionFeedback'

function getOnlinePaymentUrl(payment: ParkingOnlinePayment | null) {
  return payment?.paymentUrl || payment?.PaymentUrl || ''
}

function getOnlinePaymentOrderCode(payment: ParkingOnlinePayment | null) {
  return payment?.orderCode || payment?.OrderCode || ''
}

function getOnlinePaymentLinkId(payment: ParkingOnlinePayment | null) {
  return payment?.paymentLinkId || payment?.PaymentLinkId || ''
}

function getOnlinePaymentQr(payment: ParkingOnlinePayment | null) {
  return payment?.paymentQrCodeDataUrl || payment?.PaymentQrCodeDataUrl || ''
}

function getCheckoutPayment(result: ParkingCheckOutResponse | null) {
  return result?.payment || result?.Payment || null
}

export default function Checkout() {
  const navigate = useNavigate()
  const location = useLocation()
  const [gateContext] = useState(() => readStaffGateContext('checkout'))
  const initialState = location.state as {
    sessionId?: string
    licensePlate?: string
    qrPayload?: string
    exitImageUrl?: string
    paymentMethod?: string
    gateAccessGranted?: boolean
  } | null
  const qrInputRef = useRef<HTMLInputElement>(null)

  const [checkOutType, setCheckOutType] = useState<'auto' | 'guest' | 'resident' | 'reservation'>(
    gateContext?.isResident ? 'resident' : 'auto',
  )
  const [imagePreviewUrl, setImagePreviewUrl] = useState('')
  const [exitImageUrl, setExitImageUrl] = useState(initialState?.exitImageUrl ?? '')
  const [driverImagePreviewUrl, setDriverImagePreviewUrl] = useState('')
  const [driverExitImageUrl, setDriverExitImageUrl] = useState('')
  const [driverUploading, setDriverUploading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [qrUploading, setQrUploading] = useState(false)
  const [qrDecode, setQrDecode] = useState<ParkingQrDecodeResult | null>(null)
  const [qrPayload, setQrPayload] = useState(initialState?.qrPayload ?? '')
  const [sessionId, setSessionId] = useState(initialState?.sessionId ?? '')
  const [licensePlate, setLicensePlate] = useState(
    normalizeLicensePlate(initialState?.licensePlate ?? ''),
  )
  const [exitTimePreview, setExitTimePreview] = useState(() => initialState?.licensePlate ? formatNowInVietnamTime() : '')
  const [gateId, setGateId] = useState(gateContext?.gateId ?? '')
  const exitGates: GateDto[] = gateContext
    ? [{
        gateId: gateContext.gateId,
        gateName: gateContext.gateName,
        gateType: gateContext.gateType,
        floorId: gateContext.floorId,
        floorName: gateContext.floorName,
      }]
    : []
  const [paymentMethod, setPaymentMethod] = useState(initialState?.paymentMethod ?? 'Cash')
  const [loading, setLoading] = useState(false)
  const [validatingFloor, setValidatingFloor] = useState(false)
  const [floorValidationError, setFloorValidationError] = useState('')
  const [sessionForCheckout, setSessionForCheckout] = useState<ParkingSessionDto | null>(null)
  const [feePreview, setFeePreview] = useState<ParkingFeePreview | null>(null)
  const [feePreviewError, setFeePreviewError] = useState('')
  const [message, setMessage] = useState('')
  const [messageTone, setMessageTone] = useState<'success' | 'error'>('error')
  const [plateRecognitionNotice, setPlateRecognitionNotice] = useState('')
  const [plateRecognitionTone, setPlateRecognitionTone] = useState<'success' | 'error'>('error')
  const [onlinePayment, setOnlinePayment] = useState<ParkingOnlinePayment | null>(null)
  const [checkoutResult, setCheckoutResult] = useState<ParkingCheckOutResponse | null>(null)
  const [checkoutPayment, setCheckoutPayment] = useState<ParkingCheckoutPayment | null>(null)
  const checkoutPaymentId = checkoutPayment?.paymentId
  const checkoutPaymentMethod = checkoutPayment?.paymentMethod
  const checkoutPaymentStatus = checkoutPayment?.paymentStatus

  const showMessage = (text: string, tone: 'success' | 'error' = 'error') => {
    setMessageTone(tone)
    setMessage(text)
  }

  useEffect(() => {
    if (!sessionForCheckout || !licensePlate.trim()) {
      return
    }

    if (
      normalizeLicensePlate(licensePlate) !==
      normalizeLicensePlate(sessionForCheckout.licensePlateIn)
    ) {
      setPlateRecognitionTone('error')
      setPlateRecognitionNotice('Biển số xe ra không khớp biển số xe vào.')
    }
  }, [licensePlate, sessionForCheckout])

  useEffect(() => {
    if (!gateContext || !initialState?.gateAccessGranted) {
      navigate(staffGateSelectionPath('checkout'), { replace: true })
    }
  }, [gateContext, initialState?.gateAccessGranted, navigate])

  useEffect(() => {
    const pastedSessionId =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(qrPayload.trim())
        ? qrPayload.trim()
        : ''
    const sessionIdToValidate = sessionId || pastedSessionId

    if (!gateContext || !sessionIdToValidate) {
      return
    }

    let stopped = false
    queueMicrotask(() => {
      if (stopped) return
      setValidatingFloor(true)
      setFloorValidationError('')
      setSessionForCheckout(null)
      setFeePreview(null)
      setFeePreviewError('')

      Promise.all([
        parkingSessionApi.getAll(),
        parkingSlotApi.getAll(),
        gateApi.getAll(),
      ])
        .then(async ([sessionResponse, slotResponse, gateResponse]) => {
          if (stopped) return

          const session = sessionResponse.result?.find(
            (item) => item.sessionId.toLowerCase() === sessionIdToValidate.toLowerCase(),
          )
          if (!session) {
            setFeePreviewError('Không tìm thấy phiên gửi xe đang hoạt động để đối chiếu.')
            return
          }
          setSessionForCheckout(session)
          setCheckOutType(
            gateContext.isResident
              ? 'resident'
              : session.reservationId
                ? 'reservation'
                : 'guest',
          )

          const feeRequest = parkingOperationApi.getFeePreview(session.sessionId)

          const slotId = session.actualSlotId || session.assignedSlotId
          const slot = slotId
            ? slotResponse.result?.find((item) => item.slotId === slotId)
            : undefined
          const entryGate = gateResponse.result?.find(
            (item) => item.gateId === session.entryGateId,
          )
          const sessionFloorId = slot?.floorId || entryGate?.floorId

          if (sessionFloorId && sessionFloorId !== gateContext.floorId) {
            const currentFloorName =
              slot?.floorName ||
              entryGate?.floorName ||
              'tầng đang gửi'
            setFloorValidationError(
              `Xe đang gửi tại ${currentFloorName}. Vui lòng checkout tại cổng ra thuộc đúng tầng này.`,
            )
          }

          if (
            gateContext.dedicatedVehicleTypeId &&
            gateContext.dedicatedVehicleTypeId !== session.vehicleTypeId
          ) {
            setFloorValidationError(
              `${gateContext.floorName} chỉ dành cho ${gateContext.dedicatedVehicleTypeName || 'loại xe đã cấu hình'}. Không thể checkout ${session.vehicleTypeName || 'loại xe của phiên'} tại tầng này.`,
            )
          }

          const feeResponse = await feeRequest
          if (stopped) return
          if (feeResponse.isSuccess && feeResponse.result) {
            setFeePreview(feeResponse.result)
          } else {
            setFeePreviewError(feeResponse.message || 'Không thể tính phí gửi xe tạm tính.')
          }
        })
        .catch((error) => {
          console.error('Không thể đối chiếu tầng checkout:', error)
          if (!stopped) {
            setFeePreviewError(
              error instanceof Error ? error.message : 'Không thể tải thông tin đối chiếu và phí tạm tính.',
            )
          }
        })
        .finally(() => {
          if (!stopped) setValidatingFloor(false)
        })
    })

    return () => {
      stopped = true
    }
  }, [gateContext, qrPayload, sessionId])

  useEffect(() => {
    if (
      !checkoutPaymentId ||
      checkoutPaymentMethod?.toLowerCase() !== 'payos' ||
      checkoutPaymentStatus?.toLowerCase() !== 'pending'
    ) return

    let stopped = false
    const refreshStatus = async () => {
      try {
        const res = await parkingOperationApi.getCheckoutPaymentStatus(checkoutPaymentId)
        if (stopped || !res.isSuccess || !res.result) return

        const nextPayment = getCheckoutPayment(res.result)
        if (!nextPayment) return
        setCheckoutPayment(nextPayment)
        setCheckoutResult((current) => ({ ...current, ...res.result }))

        const status = nextPayment.paymentStatus.toLowerCase()
        if (status === 'success') {
          setOnlinePayment(null)
          setPlateRecognitionNotice('')
          setPlateRecognitionTone('error')
          showMessage('Thanh toán PayOS thành công. Checkout đã hoàn tất và xe có thể rời bãi.', 'success')
        } else if (status === 'failed') {
          setOnlinePayment(null)
          showMessage('Thanh toán PayOS thất bại hoặc đã bị hủy. Phiên gửi xe vẫn đang hoạt động.')
        }
      } catch {
        // Webhook có thể đến chậm; lần kiểm tra kế tiếp sẽ thử lại.
      }
    }

    void refreshStatus()
    const timer = window.setInterval(() => void refreshStatus(), 2_000)
    return () => {
      stopped = true
      window.clearInterval(timer)
    }
  }, [checkoutPaymentId, checkoutPaymentMethod, checkoutPaymentStatus])

  const setPlateForCheckout = (plate: string) => {
    const nextPlate = normalizeLicensePlate(plate)
    setLicensePlate(nextPlate)
    setExitTimePreview(nextPlate.trim() ? formatNowInVietnamTime() : '')
  }

  const preparePlateForCheckout = (plate: string) => {
    setPlateForCheckout(plate)
  }

  const handlePlateCameraCapture = async (file: File, previewUrl: string) => {
    setImagePreviewUrl(previewUrl)
    setUploading(true)
    setMessage('')
    setMessageTone('error')
    setPlateRecognitionNotice('')
    setPlateRecognitionTone('error')
    setOnlinePayment(null)
    setCheckoutResult(null)
    setCheckoutPayment(null)
    setPlateForCheckout('')

    try {
      const res = await parkingOperationApi.uploadAndRecognizePlate(file)
      if (res?.imageUrl) {
        setExitImageUrl(res.imageUrl)
        const feedback = buildPlateRecognitionFeedback(res)
        setPlateRecognitionTone(feedback.ok ? 'success' : 'error')
        setPlateRecognitionNotice(
          feedback.ok ? 'Nhận diện biển số thành công.' : feedback.message,
        )
        if (res.licensePlate) {
          const recognizedPlate = normalizeLicensePlate(res.licensePlate)
          preparePlateForCheckout(recognizedPlate)
          if (
            sessionForCheckout &&
            normalizeLicensePlate(recognizedPlate) !==
              normalizeLicensePlate(sessionForCheckout.licensePlateIn)
          ) {
            setPlateRecognitionTone('error')
            setPlateRecognitionNotice('Biển số xe ra không khớp biển số xe vào.')
          } else {
            setPlateRecognitionTone(feedback.ok ? 'success' : 'error')
            setPlateRecognitionNotice(
              feedback.ok ? 'Nhận diện biển số thành công.' : feedback.message,
            )
          }
        }
      } else {
        setPlateRecognitionTone('error')
        setPlateRecognitionNotice('Không lưu được ảnh biển số.')
      }
    } catch (err) {
      console.error(err)
      const feedback = buildPlateRecognitionExceptionFeedback(err)
      setPlateRecognitionTone('error')
      setPlateRecognitionNotice(feedback.message)
    } finally {
      setUploading(false)
    }
  }

  const handleDriverCameraCapture = async (file: File, previewUrl: string) => {
    setDriverImagePreviewUrl(previewUrl)
    setDriverUploading(true)
    try {
      const res = await parkingOperationApi.uploadImage(file)
      setDriverExitImageUrl(res.imageUrl || '')
    } catch (err) {
      console.error(err)
      showMessage('Không lưu được ảnh người lái.')
    } finally {
      setDriverUploading(false)
    }
  }

  const handleQrUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setQrUploading(true)
    setMessage('')
    setMessageTone('error')
    setPlateRecognitionNotice('')
    setPlateRecognitionTone('error')
    setOnlinePayment(null)
    setCheckoutResult(null)
    setCheckoutPayment(null)
    setQrDecode(null)
    setFloorValidationError('')
    setValidatingFloor(false)
    setSessionForCheckout(null)
    setFeePreview(null)
    setFeePreviewError('')
    setQrPayload('')
    setSessionId('')

    try {
      const res = await parkingOperationApi.uploadAndDecodeQr(file)
      if (res.isSuccess && res.result) {
        setQrDecode(res.result)
        setQrPayload(res.result.qrPayload)
        setSessionId(res.result.sessionId || '')
        if (!res.result.sessionId) {
          showMessage('QR đã đọc được nhưng không phải mã vé xe/session. Vui lòng dùng QR vé gửi xe để checkout.')
        }
      } else {
        showMessage(res.message || 'Không đọc được mã QR.')
      }
    } catch (err) {
      console.error(err)
      showMessage(err instanceof Error ? err.message : 'Lỗi kết nối khi upload QR.')
    } finally {
      setQrUploading(false)
    }
  }

  const handleQrCameraDecoded = async (payload: string) => {
    setQrUploading(true)
    setMessage('')
    setMessageTone('error')
    setPlateRecognitionNotice('')
    setPlateRecognitionTone('error')
    setOnlinePayment(null)
    setCheckoutResult(null)
    setCheckoutPayment(null)
    setQrDecode(null)
    setFloorValidationError('')
    setValidatingFloor(false)
    setSessionForCheckout(null)
    setFeePreview(null)
    setFeePreviewError('')
    setQrPayload(payload.trim())
    setSessionId('')

    try {
      const res = await parkingOperationApi.resolveQrPayload(payload)
      if (res.isSuccess && res.result) {
        setQrDecode(res.result)
        setQrPayload(res.result.qrPayload)
        setSessionId(res.result.sessionId || '')
        if (!res.result.sessionId) {
          showMessage('QR đã đọc được nhưng không phải mã vé xe/session. Vui lòng dùng QR vé gửi xe để checkout.')
        }
      } else {
        showMessage(res.message || 'Không đọc được mã QR.')
      }
    } catch (err) {
      console.error(err)
      showMessage(err instanceof Error ? err.message : 'Lỗi kết nối khi kiểm tra QR.')
    } finally {
      setQrUploading(false)
    }
  }

  const handleCheckout = async () => {
    if (validatingFloor) {
      showMessage('Đang kiểm tra tầng và cổng checkout, vui lòng chờ.')
      return
    }
    if (floorValidationError) {
      showMessage(floorValidationError)
      return
    }
    if (!sessionForCheckout || !feePreview) {
      showMessage(feePreviewError || 'Vui lòng chờ tải thông tin xe và phí tạm tính trước khi checkout.')
      return
    }
    if (!licensePlate.trim()) {
      setPlateRecognitionTone('error')
      setPlateRecognitionNotice('Vui lòng nhập hoặc chụp biển số xe ra.')
      return
    }
    if (
      normalizeLicensePlate(licensePlate) !==
      normalizeLicensePlate(sessionForCheckout.licensePlateIn)
    ) {
      setPlateRecognitionTone('error')
      setPlateRecognitionNotice('Biển số xe ra không khớp biển số xe vào.')
      return
    }
    if (!sessionId && !qrPayload.trim()) {
      showMessage('Vui lòng upload ảnh QR vé xe hoặc nhập SessionId/QR payload')
      return
    }
    if (!gateId) {
      showMessage('Vui lòng chọn cổng ra')
      return
    }

    setLoading(true)
    setMessage('')
    setMessageTone('error')
    setPlateRecognitionNotice('')
    setPlateRecognitionTone('error')
    setOnlinePayment(null)
    setCheckoutResult(null)
    setCheckoutPayment(null)
    try {
      const customerType =
        checkOutType === 'auto'
          ? undefined
          : checkOutType === 'resident'
            ? 'Resident'
            : checkOutType === 'reservation'
              ? 'Reservation'
              : 'Guest'

      const res = await parkingOperationApi.checkOut({
        customerType,
        sessionId: sessionId || undefined,
        qrPayload: qrPayload.trim() || undefined,
        licensePlate: licensePlate.trim() || undefined,
        licensePlateOut: licensePlate.trim() || undefined,
        gateId,
        paymentMethod,
        exitImageUrl: exitImageUrl || undefined,
        driverExitImageUrl: driverExitImageUrl || undefined,
      })
      if (res.isSuccess) {
        setCheckoutResult(res.result ?? null)
        const payment = res.result?.onlinePayment ?? res.result?.OnlinePayment ?? null
        const createdPayment = getCheckoutPayment(res.result ?? null)
        setOnlinePayment(payment)
        setCheckoutPayment(createdPayment)
        showMessage(res.message || (createdPayment ? 'Đã tạo yêu cầu thanh toán' : 'Checkout thành công'), 'success')
        if (!createdPayment) {
          setPlateForCheckout('')
          setImagePreviewUrl('')
          setExitImageUrl('')
          setDriverImagePreviewUrl('')
          setDriverExitImageUrl('')
          setQrPayload('')
          setSessionId('')
          setQrDecode(null)
          setFloorValidationError('')
          setValidatingFloor(false)
          setSessionForCheckout(null)
          setFeePreview(null)
          setFeePreviewError('')
          if (qrInputRef.current) qrInputRef.current.value = ''
        }
      } else {
        showMessage(res.message || 'Checkout thất bại')
      }
    } catch (err) {
      console.error(err)
      showMessage(err instanceof Error ? err.message : 'Lỗi kết nối API')
    } finally {
      setLoading(false)
    }
  }

  const handleConfirmCash = async () => {
    if (!checkoutPayment) return
    setLoading(true)
    setMessage('')
    setMessageTone('error')
    setPlateRecognitionNotice('')
    setPlateRecognitionTone('error')
    try {
      const res = await parkingOperationApi.confirmCashCheckout(checkoutPayment.paymentId)
      if (!res.isSuccess || !res.result) {
        showMessage(res.message || 'Không thể xác nhận thanh toán tiền mặt')
        return
      }
      setCheckoutResult((current) => ({ ...current, ...res.result }))
      setCheckoutPayment(getCheckoutPayment(res.result))
      showMessage(res.message || 'Đã nhận tiền và checkout thành công', 'success')
    } catch (err) {
      showMessage(err instanceof Error ? err.message : 'Lỗi kết nối khi xác nhận thanh toán')
    } finally {
      setLoading(false)
    }
  }

  const handleCancelCheckout = async () => {
    if (!checkoutPayment) return
    setLoading(true)
    setMessage('')
    setMessageTone('error')
    setPlateRecognitionNotice('')
    setPlateRecognitionTone('error')
    try {
      const res = await parkingOperationApi.cancelCheckout(checkoutPayment.paymentId)
      if (!res.isSuccess) {
        showMessage(res.message || 'Không thể hủy checkout')
        return
      }
      setCheckoutResult((current) => ({ ...current, ...res.result }))
      setCheckoutPayment(getCheckoutPayment(res.result ?? null))
      setOnlinePayment(null)
      showMessage(res.message || 'Đã hủy checkout', 'success')
    } catch (err) {
      showMessage(err instanceof Error ? err.message : 'Lỗi kết nối khi hủy checkout')
    } finally {
      setLoading(false)
    }
  }

  const checkoutStatus = checkoutPaymentStatus?.toLowerCase() ?? ''
  const hasPendingCheckout = checkoutStatus === 'pending'
  const checkoutSucceeded = checkoutStatus === 'success'
  const checkoutFailed = checkoutStatus === 'failed'
  const checkoutMessageIsSuccess = messageTone === 'success'
  const plateMismatch = Boolean(
    sessionForCheckout &&
    licensePlate.trim() &&
    normalizeLicensePlate(licensePlate) !==
      normalizeLicensePlate(sessionForCheckout.licensePlateIn),
  )
  const plateMatched = Boolean(sessionForCheckout && licensePlate.trim() && !plateMismatch)
  const displayedFee = checkoutResult?.fee || checkoutResult?.Fee || feePreview
  const canCreateCheckout = Boolean(
    !loading &&
    !uploading &&
    !qrUploading &&
    !validatingFloor &&
    !floorValidationError &&
    !feePreviewError &&
    sessionForCheckout &&
    feePreview &&
    plateMatched &&
    gateId,
  )

  const resetCheckout = (keepVehicleData = false) => {
    setCheckoutPayment(null)
    setCheckoutResult(null)
    setOnlinePayment(null)
    setMessage('')
    setMessageTone('error')
    setPlateRecognitionNotice('')
    setPlateRecognitionTone('error')
    if (keepVehicleData) return

    setPlateForCheckout('')
    setImagePreviewUrl('')
    setExitImageUrl('')
    setDriverImagePreviewUrl('')
    setDriverExitImageUrl('')
    setQrPayload('')
    setSessionId('')
    setQrDecode(null)
    setFloorValidationError('')
    setValidatingFloor(false)
    setSessionForCheckout(null)
    setFeePreview(null)
    setFeePreviewError('')
    if (qrInputRef.current) qrInputRef.current.value = ''
  }

  return (
      <StaffPageShell activeItem="checkout">
        <div className="staff-content-wrapper staff-manager-page manager-resource-page">
          <div className="staff-section">
            <header className="manager-resource-header">
              <div className="manager-resource-title"><span className="manager-resource-icon manager-resource-icon--orange"><LogOut size={24} aria-hidden /></span><div><h2>Checkout tại cổng ra</h2><p>Đọc vé QR, đối chiếu biển số, tính phí và xác nhận xe rời bãi.</p></div></div>
            </header>

            {gateContext && (
              <div className="staff-operation-context">
                <div>
                  <MapPin size={18} aria-hidden />
                  <span>
                    <strong>{gateContext.floorName} · {gateContext.gateName}</strong>
                    <small>
                      {gateContext.isResident ? 'Tầng cư dân' : 'Tầng khách / đặt trước'}
                      {' · '}
                      {gateContext.dedicatedVehicleTypeName || 'Nhiều loại xe'}
                    </small>
                  </span>
                </div>
                <button type="button" className="btn btn-outline btn-sm" onClick={() => navigate(staffGateSelectionPath('checkout'))}>
                  Đổi tầng / cổng
                </button>
              </div>
            )}

            <div className="checkout-progress" aria-label="Tiến trình checkout">
              <div className={sessionForCheckout ? 'is-complete' : 'is-current'}>
                <span>{sessionForCheckout ? <CheckCircle2 size={17} /> : '1'}</span>
                <div><strong>Đọc vé xe</strong><small>Xác định phiên gửi xe</small></div>
              </div>
              <i />
              <div className={licensePlate.trim() ? 'is-complete' : sessionForCheckout ? 'is-current' : ''}>
                <span>{licensePlate.trim() ? <CheckCircle2 size={17} /> : '2'}</span>
                <div><strong>Biển số xe ra</strong><small>Nhập trực tiếp hoặc nhận diện từ ảnh</small></div>
              </div>
              <i />
              <div className={plateMatched ? 'is-complete' : licensePlate.trim() ? 'is-current' : ''}>
                <span>{plateMatched ? <CheckCircle2 size={17} /> : '3'}</span>
                <div><strong>Đối chiếu</strong><small>Biển số và tầng</small></div>
              </div>
              <i />
              <div className={checkoutSucceeded ? 'is-complete' : plateMatched && feePreview ? 'is-current' : ''}>
                <span>{checkoutSucceeded ? <CheckCircle2 size={17} /> : '4'}</span>
                <div><strong>Thanh toán</strong><small>Xác nhận xe rời bãi</small></div>
              </div>
            </div>

            <div className="scan-container staff-checkout-layout">
              <div className={`card-panel staff-checkout-camera-card${sessionForCheckout ? ' has-comparison' : ''}`}>
                <div className="scan-card-heading">
                  <span className="checkout-card-icon"><Camera size={19} /></span>
                  <div>
                    <h3>{sessionForCheckout ? 'Đối chiếu ảnh ra/vào' : 'Chụp ảnh checkout'}</h3>
                    <p>{sessionForCheckout ? 'So sánh ảnh lúc vào và lúc ra để xác thực checkout.' : 'Chụp biển số và khuôn mặt người lái khi xe ra.'}</p>
                  </div>
                </div>

                <div className="checkout-photo-grid">
                  <article className="scan-entry-camera card-panel checkout-photo-card">
                    <div className="scan-card-heading">
                      <div>
                        <h3>Ảnh biển số ra</h3>
                        <p>Dùng để nhận diện biển số và đối chiếu với vé.</p>
                      </div>
                    </div>
                    <PlateCameraCapture
                      disabled={hasPendingCheckout}
                      busy={uploading}
                      previewUrl={imagePreviewUrl || exitImageUrl}
                      previewAlt="Ảnh biển số ra"
                      fileNamePrefix="checkout-plate"
                      onCapture={handlePlateCameraCapture}
                    />
                  </article>

                  <article className="scan-entry-camera card-panel checkout-photo-card">
                    <div className="scan-card-heading">
                      <div>
                        <h3>Ảnh người lái lúc ra</h3>
                        <p>Chụp rõ mặt người lái để đối chiếu với ảnh lúc vào.</p>
                      </div>
                    </div>
                    <PlateCameraCapture
                      disabled={hasPendingCheckout}
                      busy={driverUploading}
                      previewUrl={driverImagePreviewUrl || driverExitImageUrl}
                      previewAlt="Ảnh người lái lúc ra"
                      fileNamePrefix="checkout-driver"
                      captureLabel="Chụp khuôn mặt"
                      helperText="Căn rõ khuôn mặt người lái trong khung rồi bấm chụp."
                      processingLabel="Đang lưu ảnh người lái..."
                      facingMode="user"
                      onCapture={handleDriverCameraCapture}
                    />
                  </article>

                  <article className="scan-entry-camera card-panel checkout-photo-card">
                    <div className="scan-card-heading">
                      <div>
                        <h3>Ảnh biển số vào</h3>
                        <p>Ảnh xe lúc vào bãi để so sánh với ảnh ra.</p>
                      </div>
                    </div>
                    <div className="camera-preview">
                      {sessionForCheckout?.entryImageUrl ? (
                        <a href={sessionForCheckout.entryImageUrl} target="_blank" rel="noreferrer">
                          <img src={sessionForCheckout.entryImageUrl} alt={`Xe ${sessionForCheckout.licensePlateIn} lúc vào`} />
                        </a>
                      ) : (
                        <span className="manager-session-image-empty">
                          <ImageIcon size={27} aria-hidden />
                          Chưa có ảnh lúc vào
                        </span>
                      )}
                    </div>
                    <small className="checkout-image-plate">
                      Biển số: <b>{sessionForCheckout?.licensePlateIn || 'Chưa có'}</b>
                    </small>
                  </article>

                  <article className="scan-entry-camera card-panel checkout-photo-card">
                    <div className="scan-card-heading">
                      <div>
                        <h3>Ảnh người lái lúc vào</h3>
                        <p>Ảnh người lái lúc vào để đối chiếu khi checkout.</p>
                      </div>
                    </div>
                    <div className="camera-preview">
                      {sessionForCheckout?.driverEntryImageUrl ? (
                        <a href={sessionForCheckout.driverEntryImageUrl} target="_blank" rel="noreferrer">
                          <img src={sessionForCheckout.driverEntryImageUrl} alt="Ảnh người lái lúc vào" />
                        </a>
                      ) : (
                        <span className="manager-session-image-empty">
                          <ImageIcon size={27} aria-hidden />
                          Chưa có ảnh người lái lúc vào
                        </span>
                      )}
                    </div>
                    <small className="checkout-image-plate">Dùng để xác thực ngay cả khi không có QR.</small>
                  </article>
                </div>
              </div>

              <div className="scan-form card-panel staff-checkout-form-card">
                <div className="scan-card-heading">
                  <span className="checkout-card-icon checkout-card-icon--blue"><QrCode size={19} /></span>
                  <div><h3>Thông tin checkout</h3><p>Đọc vé, kiểm tra dữ liệu và xem phí trước khi xác nhận.</p></div>
                </div>

                {sessionForCheckout && (
                  <div className="checkout-session-banner">
                    <span><CarFront size={21} aria-hidden /></span>
                    <div>
                      <strong>{sessionForCheckout.licensePlateIn}</strong>
                      <small>
                        {sessionForCheckout.vehicleTypeName || 'Chưa rõ loại xe'}
                        {' · '}
                        {sessionForCheckout.actualSlotCode || sessionForCheckout.assignedSlotCode || 'Chưa rõ vị trí'}
                      </small>
                    </div>
                    <em><CheckCircle2 size={15} /> Đã nhận vé</em>
                  </div>
                )}

                <div className="checkout-priority-fields">
                  <div className="form-field checkout-license-field">
                    <label htmlFor="license-plate-checkout">Biển số xe</label>
                    <input
                      id="license-plate-checkout"
                      type="text"
                      className="input-standalone"
                      placeholder="Nhập biển số"
                      value={licensePlate}
                      disabled={hasPendingCheckout}
                      onChange={(event) => {
                        setPlateForCheckout(event.target.value)
                        setMessageTone('error')
                        setPlateRecognitionNotice('')
                        setPlateRecognitionTone('error')
                        setOnlinePayment(null)
                        setCheckoutResult(null)
                      }}
                      onBlur={() => preparePlateForCheckout(licensePlate)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') preparePlateForCheckout(licensePlate)
                      }}
                    />
                    {plateRecognitionNotice && (
                      <p
                        className={`plate-recognition-inline ${
                          plateRecognitionTone === 'success' ? 'is-success' : 'is-error'
                        }`}
                        role={plateRecognitionTone === 'success' ? 'status' : 'alert'}
                      >
                        {plateRecognitionTone === 'success' ? (
                          <CheckCircle2 size={15} aria-hidden />
                        ) : (
                          <AlertCircle size={15} aria-hidden />
                        )}
                        {plateRecognitionNotice}
                      </p>
                    )}
                  </div>

                  <div className="form-field">
                    <label>Cổng ra</label>
                    <select
                      className="input-standalone select"
                      value={gateId}
                      disabled
                      onChange={(event) => {
                        setGateId(event.target.value)
                        setOnlinePayment(null)
                        setCheckoutResult(null)
                      }}
                    >
                      {exitGates.length === 0 && <option value="">Chưa có cổng ra</option>}
                      {exitGates.map((gate) => (
                        <option key={gate.gateId} value={gate.gateId}>
                          {gate.gateName}
                          {gate.floorName ? ` · ${gate.floorName}` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-field">
                    <label>Loại checkout</label>
                    <select
                      className="input-standalone select"
                      value={checkOutType}
                      disabled={hasPendingCheckout || Boolean(sessionForCheckout)}
                      onChange={(event) => {
                        setCheckOutType(event.target.value as 'auto' | 'guest' | 'resident' | 'reservation')
                        setMessage('')
                        setMessageTone('error')
                        setPlateRecognitionNotice('')
                        setPlateRecognitionTone('error')
                        setOnlinePayment(null)
                        setCheckoutResult(null)
                      }}
                    >
                      <option value="auto" disabled={Boolean(gateContext?.isResident)}>Tự nhận diện từ vé QR</option>
                      <option value="guest" disabled={Boolean(gateContext?.isResident)}>Khách vãng lai</option>
                      <option value="resident" disabled={!gateContext?.isResident}>Cư dân (Khách tháng)</option>
                      <option value="reservation" disabled={Boolean(gateContext?.isResident)}>Xe đặt trước</option>
                    </select>
                    <small className="field-hint">
                      {sessionForCheckout
                        ? 'Đã tự xác định từ phiên gửi xe, không thể thay đổi.'
                        : 'Loại checkout sẽ được tự xác định sau khi đọc vé.'}
                    </small>
                  </div>
                </div>

                {checkOutType !== 'resident' && (
                  <div className="form-field checkout-payment-field">
                    <label>Thanh toán</label>
                    <select
                      className="input-standalone select"
                      value={paymentMethod}
                      disabled={hasPendingCheckout}
                      onChange={(event) => {
                        setPaymentMethod(event.target.value)
                        setMessageTone('error')
                        setPlateRecognitionNotice('')
                        setPlateRecognitionTone('error')
                        setOnlinePayment(null)
                        setCheckoutResult(null)
                      }}
                    >
                      <option value="Cash">Tiền mặt</option>
                      <option value="PayOS">PayOS</option>
                    </select>
                  </div>
                )}

                <div className="form-field checkout-field-ticket">
                  <label>Mã vé xe / SessionId</label>
                  {sessionId && <div className="input-readonly">SessionId: {sessionId}</div>}
                  <input
                    type="text"
                    className="input-standalone"
                    placeholder="Dán QR payload / SessionId"
                    value={qrPayload}
                    disabled={hasPendingCheckout}
                    onChange={(event) => {
                      setQrPayload(event.target.value.trim())
                      setMessageTone('error')
                      setPlateRecognitionNotice('')
                      setPlateRecognitionTone('error')
                      setSessionId('')
                      setQrDecode(null)
                      setFloorValidationError('')
                      setValidatingFloor(false)
                      setSessionForCheckout(null)
                      setFeePreview(null)
                      setFeePreviewError('')
                      setOnlinePayment(null)
                      setCheckoutResult(null)
                    }}
                  />
                  <QrCameraScanner
                    disabled={hasPendingCheckout}
                    busy={qrUploading}
                    onDecoded={handleQrCameraDecoded}
                    actions={
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        disabled={qrUploading || hasPendingCheckout}
                        onClick={() => qrInputRef.current?.click()}
                      >
                        <QrCode size={16} aria-hidden />
                        {qrUploading ? 'Đang đọc QR...' : 'Tải ảnh QR vé'}
                      </button>
                    }
                  />
                  <input
                    type="file"
                    ref={qrInputRef}
                    className="upload-input-hidden"
                    accept="image/*"
                    onChange={handleQrUpload}
                  />
                </div>

                {validatingFloor && <p className="alert-inline">Đang kiểm tra tầng và cổng checkout...</p>}
                {floorValidationError && (
                  <p className="alert-inline alert-error" role="alert">
                    <AlertCircle size={18} aria-hidden />
                    {floorValidationError}
                  </p>
                )}
                {feePreviewError && (
                  <p className="alert-inline alert-error" role="alert">
                    <AlertCircle size={18} aria-hidden />
                    {feePreviewError}
                  </p>
                )}
                {message &&
                  message !== floorValidationError &&
                  message !== feePreviewError && (
                  <p
                    className={`alert-inline ${checkoutMessageIsSuccess ? 'alert-success' : 'alert-error'}`}
                    role={checkoutMessageIsSuccess ? 'status' : 'alert'}
                  >
                    {checkoutMessageIsSuccess ? (
                      <CheckCircle2 size={18} aria-hidden />
                    ) : (
                      <AlertCircle size={18} aria-hidden />
                    )}
                    {message}
                  </p>
                  )}

                {getOnlinePaymentUrl(onlinePayment) && (
                  <div className="scan-result checkout-online-payment">
                    <h3>Thanh toán PayOS</h3>
                    {getOnlinePaymentQr(onlinePayment) && (
                      <img
                        className="checkout-payment-qr"
                        src={getOnlinePaymentQr(onlinePayment)}
                        alt="Mã QR thanh toán PayOS"
                      />
                    )}
                    <div className="scan-info">
                      <p><strong>Trạng thái:</strong> {checkoutPayment?.paymentStatus || 'Pending'}</p>
                      <p><strong>OrderCode:</strong> {getOnlinePaymentOrderCode(onlinePayment) || 'Chưa có'}</p>
                      <p><strong>PaymentLinkId:</strong> {getOnlinePaymentLinkId(onlinePayment) || 'Chưa có'}</p>
                    </div>
                    <div className="checkout-actions">
                      <a
                        className="btn btn-primary btn-block"
                        href={getOnlinePaymentUrl(onlinePayment)}
                        onClick={() => {
                          const returnState = {
                            sessionId: sessionForCheckout?.sessionId || sessionId,
                            licensePlate,
                            qrPayload,
                            exitImageUrl,
                            paymentMethod: 'PayOS',
                            gateAccessGranted: true,
                          }
                          savePaymentReturnContext({
                            type: 'checkout-fee',
                            successPath: '/staff/checkout',
                            cancelPath: '/staff/checkout',
                            successState: returnState,
                            cancelState: returnState,
                          }, getOnlinePaymentOrderCode(onlinePayment))
                        }}
                      >
                        <ExternalLink size={16} aria-hidden />
                        Mở trang thanh toán PayOS
                      </a>
                    </div>
                  </div>
                  )}

                <div className="scan-result">
                  <div className="checkout-summary-heading">
                    <span><ReceiptText size={19} aria-hidden /></span>
                    <div><h3>Tóm tắt thanh toán</h3><small>Kiểm tra lần cuối trước khi xác nhận</small></div>
                  </div>
                  <div className="scan-info">
                    <p><strong>Biển số ra:</strong> {checkoutResult?.session?.licensePlateOut || checkoutResult?.Session?.licensePlateOut || licensePlate || 'Chưa nhập'}</p>
                    <p><strong>Giờ hiện tại:</strong> {exitTimePreview || formatNowInVietnamTime()}</p>
                    <p><strong>SessionId:</strong> {checkoutResult?.session?.sessionId || checkoutResult?.Session?.sessionId || sessionId || 'Chưa có'}</p>
                    <p><strong>Loại mã QR:</strong> {qrDecode?.codeType || 'Chưa đọc QR'}</p>
                    {displayedFee ? (
                      <>
                        <div className="checkout-fee-hero">
                          <span>{(displayedFee.depositAmount ?? 0) > 0 ? 'Còn phải thanh toán' : 'Phí tạm tính'}</span>
                          <strong>{formatCurrency(displayedFee.amount)}</strong>
                          <small>
                            <Clock3 size={14} />
                            {displayedFee.billedHours} giờ tính phí
                          </small>
                        </div>
                        <p>
                          <strong>Thời gian tính phí:</strong>{' '}
                          {displayedFee.billedHours} giờ
                        </p>
                        {(displayedFee.depositAmount ?? 0) > 0 && (
                          <>
                            <p>
                              <strong>Tổng phí gửi xe:</strong>{' '}
                              {formatCurrency(displayedFee.grossAmount ?? displayedFee.amount + (displayedFee.depositAmount ?? 0))}
                            </p>
                            <p>
                              <strong>Tiền cọc đã khấu trừ:</strong>{' '}
                              -{formatCurrency(displayedFee.depositAmount ?? 0)}
                            </p>
                          </>
                        )}
                        {displayedFee.isCoveredBySubscription && (
                          <p><strong>Gói tháng:</strong> Đã bao gồm phí gửi xe</p>
                        )}
                      </>
                    ) : validatingFloor ? (
                      <p><strong>Phí tạm tính:</strong> Đang tính...</p>
                    ) : (
                      <p><strong>Phí tạm tính:</strong> Quét vé để xem phí trước khi thanh toán</p>
                    )}
                    <p><strong>Phương thức thanh toán:</strong> {checkOutType === 'resident' ? 'Gói tháng' : paymentMethod}</p>
                    {checkoutPayment && (
                      <p>
                        <strong>Trạng thái thanh toán:</strong> {checkoutPayment.paymentStatus}
                      </p>
                    )}
                  </div>
                  <div className="checkout-readiness">
                    <span className={sessionForCheckout ? 'done' : ''}>
                      {sessionForCheckout ? <CheckCircle2 size={15} /> : <QrCode size={15} />} Vé xe
                    </span>
                    <span className={exitImageUrl ? 'done' : ''}>
                      {exitImageUrl ? <CheckCircle2 size={15} /> : <Camera size={15} />} Ảnh ra vào
                    </span>
                    <span className={plateMatched && !floorValidationError ? 'done' : ''}>
                      {plateMatched && !floorValidationError ? <CheckCircle2 size={15} /> : <ShieldCheck size={15} />} Đối chiếu
                    </span>
                    <span className={feePreview ? 'done' : ''}>
                      {feePreview ? <CheckCircle2 size={15} /> : <CreditCard size={15} />} Phí
                    </span>
                  </div>
                  <div className="checkout-actions">
                    {!checkoutPayment && (
                      <button
                        type="button"
                        className="btn btn-success btn-block"
                        disabled={!canCreateCheckout}
                        onClick={handleCheckout}
                      >
                        {loading
                          ? 'Đang xử lý...'
                          : checkOutType === 'resident'
                            ? 'Xác nhận checkout'
                            : 'Xác nhận và tạo thanh toán'}
                      </button>
                    )}
                    {hasPendingCheckout && checkoutPayment?.paymentMethod.toLowerCase() === 'cash' && (
                      <button
                        type="button"
                        className="btn btn-success btn-block"
                        disabled={loading}
                        onClick={handleConfirmCash}
                      >
                        <CheckCircle2 size={17} aria-hidden />
                        {loading ? 'Đang xác nhận...' : 'Đã nhận đủ tiền — xác nhận checkout'}
                      </button>
                    )}
                    {hasPendingCheckout && (
                      <button
                        type="button"
                        className="btn btn-outline btn-block checkout-cancel-button"
                        disabled={loading}
                        onClick={handleCancelCheckout}
                      >
                        <XCircle size={17} aria-hidden />
                        Hủy checkout
                      </button>
                    )}
                    {checkoutSucceeded && (
                      <button type="button" className="btn btn-primary btn-block" onClick={() => resetCheckout()}>
                        Checkout xe tiếp theo
                      </button>
                    )}
                    {checkoutFailed && (
                      <button type="button" className="btn btn-outline btn-block" onClick={() => resetCheckout(true)}>
                        Làm lại checkout
                      </button>
                    )}
                  </div>
                </div>

                {qrDecode && (
                  <div className="scan-result">
                    <h3>QR đã đọc</h3>
                    <div className="scan-info">
                      <p><strong>Payload:</strong> {qrDecode.qrPayload}</p>
                      <p><strong>SessionId:</strong> {qrDecode.sessionId || 'Không có'}</p>
                      <p><strong>ReservationId:</strong> {qrDecode.reservationId || 'Không có'}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </StaffPageShell>
  )
}
