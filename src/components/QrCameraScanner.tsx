import { useCallback, useEffect, useRef, useState } from 'react'
import { BrowserQRCodeReader, type IScannerControls } from '@zxing/browser'
import { Camera, CameraOff, QrCode } from 'lucide-react'
import type { ReactNode } from 'react'

interface QrCameraScannerProps {
  disabled?: boolean
  busy?: boolean
  actions?: ReactNode
  onDecoded: (payload: string) => Promise<void> | void
}

export default function QrCameraScanner({
  disabled = false,
  busy = false,
  actions,
  onDecoded,
}: QrCameraScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const controlsRef = useRef<IScannerControls | null>(null)
  const decodedRef = useRef(false)
  const [scannerOn, setScannerOn] = useState(false)
  const [scannerError, setScannerError] = useState('')

  const stopScanner = useCallback(() => {
    controlsRef.current?.stop()
    controlsRef.current = null
    decodedRef.current = false
    setScannerOn(false)
  }, [])

  useEffect(() => stopScanner, [stopScanner])

  const startScanner = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setScannerError('Trình duyệt không hỗ trợ camera.')
      return
    }

    const video = videoRef.current
    if (!video) return

    setScannerError('')
    decodedRef.current = false

    try {
      const reader = new BrowserQRCodeReader()
      controlsRef.current = await reader.decodeFromConstraints(
        {
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 960 },
            height: { ideal: 720 },
          },
          audio: false,
        },
        video,
        (result, _error, controls) => {
          if (!result || decodedRef.current) return
          decodedRef.current = true
          controls.stop()
          controlsRef.current = null
          setScannerOn(false)
          void Promise.resolve(onDecoded(result.getText())).catch((error: unknown) => {
            console.error('QR resolve failed:', error)
            decodedRef.current = false
          })
        },
      )
      setScannerOn(true)
    } catch (error) {
      console.error('QR scanner start failed:', error)
      setScannerError('Không mở được camera quét QR. Hãy cấp quyền camera hoặc upload ảnh QR.')
      stopScanner()
    }
  }

  return (
    <div className="qr-camera-tool">
      <div className={`qr-camera-frame${scannerOn ? ' is-live' : ''}`}>
        <video ref={videoRef} className="camera-live-video" muted playsInline />
        {!scannerOn && (
          <div className="camera-placeholder">
            <QrCode size={42} aria-hidden />
            <p>Mở camera để quét QR</p>
            <small>Đưa mã QR vào giữa khung.</small>
          </div>
        )}
      </div>
      {scannerError && <p className="camera-tool-error">{scannerError}</p>}
      <div className="camera-tool-actions">
        {scannerOn ? (
          <button
            type="button"
            className="btn btn-outline btn-sm"
            disabled={busy}
            onClick={stopScanner}
          >
            <CameraOff size={16} aria-hidden />
            Tắt QR camera
          </button>
        ) : (
          <button
            type="button"
            className="btn btn-outline btn-sm"
            disabled={disabled || busy}
            onClick={startScanner}
          >
            <Camera size={16} aria-hidden />
            Quét QR bằng camera
          </button>
        )}
        {actions}
      </div>
    </div>
  )
}
