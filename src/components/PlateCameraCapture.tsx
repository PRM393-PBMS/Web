import { useCallback, useEffect, useRef, useState } from 'react'
import { Camera, RefreshCw } from 'lucide-react'

interface PlateCameraCaptureProps {
  disabled?: boolean
  busy?: boolean
  previewUrl?: string
  previewAlt?: string
  fileNamePrefix?: string
  captureLabel?: string
  helperText?: string
  processingLabel?: string
  facingMode?: 'environment' | 'user'
  onCapture: (file: File, previewUrl: string) => Promise<void> | void
}

const describeCameraError = (error: unknown) => {
  if (error instanceof DOMException) {
    const reason =
      error.name === 'NotAllowedError'
        ? 'trình duyệt đang chặn quyền camera'
        : error.name === 'NotFoundError'
          ? 'không tìm thấy camera trên thiết bị'
          : error.name === 'NotReadableError'
            ? 'camera đang bận hoặc bị ứng dụng khác sử dụng'
            : error.name === 'OverconstrainedError'
              ? 'camera không đáp ứng được cấu hình độ phân giải yêu cầu'
              : 'trình duyệt không mở được camera'
    const detail = error.message ? ` Chi tiết: ${error.message}` : ''
    return `Không mở được camera (${error.name}): ${reason}.${detail}`
  }

  if (error instanceof Error) {
    return `Không mở được camera: ${error.message}`
  }

  return 'Không mở được camera. Hãy cấp quyền camera rồi thử lại.'
}

export default function PlateCameraCapture({
  disabled = false,
  busy = false,
  previewUrl = '',
  previewAlt = 'Plate capture preview',
  fileNamePrefix = 'plate-capture',
  captureLabel = 'Capture plate',
  helperText = 'Position the plate clearly in the frame, then capture it.',
  processingLabel = 'Processing image...',
  facingMode = 'environment',
  onCapture,
}: PlateCameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [cameraOn, setCameraOn] = useState(false)
  const [cameraError, setCameraError] = useState('')

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    setCameraOn(false)
  }, [])

  useEffect(() => stopCamera, [stopCamera])

  const startCamera = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError('Trình duyệt không hỗ trợ camera.')
      return
    }

    setCameraError('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      })

      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      setCameraOn(true)
    } catch (error) {
      console.error('Camera start failed:', error)
      setCameraError(describeCameraError(error))
      stopCamera()
    }
  }

  const captureFrame = async () => {
    const video = videoRef.current
    if (!video || !cameraOn) {
      setCameraError('Hãy mở camera trước khi chụp.')
      return
    }

    const width = video.videoWidth
    const height = video.videoHeight
    if (!width || !height) {
      setCameraError('Camera chưa sẵn sàng, vui lòng thử lại.')
      return
    }

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) {
      setCameraError('Không tạo được ảnh chụp từ camera.')
      return
    }

    context.drawImage(video, 0, 0, width, height)
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', 0.92),
    )

    if (!blob) {
      setCameraError('Không lưu được ảnh chụp từ camera.')
      return
    }

    const file = new File([blob], `${fileNamePrefix}-${Date.now()}.jpg`, {
      type: 'image/jpeg',
    })
    stopCamera()
    await onCapture(file, URL.createObjectURL(blob))
  }

  const hasPreview = Boolean(previewUrl)

  return (
    <div
      className="camera-capture-tool"
      aria-label={captureLabel}
      data-helper-text={helperText}
      data-processing-label={processingLabel}
    >
      <div className={`camera-frame camera-live-frame${cameraOn ? ' is-live' : ''}`}>
        <video
          ref={videoRef}
          className={`camera-live-video${cameraOn ? '' : ' is-hidden'}`}
          autoPlay
          muted
          playsInline
        />
        {!cameraOn && previewUrl ? (
          <img src={previewUrl} className="camera-preview-img" alt={previewAlt} />
        ) : !cameraOn ? (
          <div className="camera-placeholder">
            <Camera size={52} aria-hidden />
            <p>Mở camera để chụp</p>
            <small>Căn rõ trong khung rồi bấm chụp.</small>
          </div>
        ) : null}
        {busy && (
          <>
            <div className="ocr-scanning-line" />
            <div className="ocr-loading-overlay">
              <span>Đang nhận diện biển số...</span>
            </div>
          </>
        )}
      </div>
      {cameraError && <p className="camera-tool-error">{cameraError}</p>}
      <div className="camera-tool-actions">
        {cameraOn ? (
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={disabled || busy}
            onClick={captureFrame}
          >
            <Camera size={16} aria-hidden />
            Chụp biển số
          </button>
        ) : hasPreview ? (
          <button
            type="button"
            className="btn btn-outline btn-sm"
            disabled={disabled || busy}
            onClick={startCamera}
          >
            <RefreshCw size={16} aria-hidden />
            Chụp lại ảnh
          </button>
        ) : (
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={disabled || busy}
            onClick={startCamera}
          >
            <Camera size={16} aria-hidden />
            Mở camera
          </button>
        )}
      </div>
    </div>
  )
}
