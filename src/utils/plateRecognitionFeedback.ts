import { ApiRequestError } from '../config/api'
import type { PlateRecognitionResult } from './apiServices'

export interface PlateRecognitionFeedback {
  ok: boolean
  message: string
  detail?: string
}

const formatPercent = (value?: number) =>
  typeof value === 'number' ? `${Math.round(value * 1000) / 10}%` : undefined

const formatProviderResponse = (response?: string) => {
  if (!response?.trim()) return undefined

  try {
    return JSON.stringify(JSON.parse(response), null, 2)
  } catch {
    return response
  }
}

const formatCandidates = (result: PlateRecognitionResult) => {
  const candidates = result.candidates ?? []
  if (candidates.length === 0) return ''

  return [
    'Kết quả Plate Recognizer đọc được:',
    ...candidates.slice(0, 5).map((candidate, index) => {
      const confidence = formatPercent(candidate.confidence) ?? 'không rõ'
      const region = candidate.regionCode ? `, vùng ${candidate.regionCode}` : ''
      return `${index + 1}. ${candidate.licensePlate} (${confidence}${region})`
    }),
  ].join('\n')
}

export const buildPlateRecognitionFeedback = (
  result: PlateRecognitionResult,
): PlateRecognitionFeedback => {
  const confidence = formatPercent(result.confidence)
  const status = result.providerStatusCode ? `HTTP ${result.providerStatusCode}` : undefined
  const providerResponse = formatProviderResponse(result.providerResponse)
  const candidates = formatCandidates(result)

  if (result.licensePlate) {
    return {
      ok: true,
      message:
        result.message ||
        `Nhận diện biển số thành công: ${result.licensePlate}${confidence ? ` (${confidence})` : ''}.`,
      detail: [
        status ? `Plate Recognizer status: ${status}` : '',
        result.regionCode ? `Vùng nhận diện: ${result.regionCode}` : '',
        providerResponse ? `Phản hồi Plate Recognizer:\n${providerResponse}` : '',
      ].filter(Boolean).join('\n\n') || undefined,
    }
  }

  const reason = result.message || result.providerError || 'Không nhận diện được biển số.'
  return {
    ok: false,
    message: `Nhận diện biển số thất bại: ${reason}`,
    detail: [
      status ? `Plate Recognizer status: ${status}` : '',
      result.providerError ? `Lỗi provider: ${result.providerError}` : '',
      candidates,
      providerResponse ? `Phản hồi Plate Recognizer:\n${providerResponse}` : '',
    ].filter(Boolean).join('\n\n') || undefined,
  }
}

export const buildPlateRecognitionExceptionFeedback = (error: unknown): PlateRecognitionFeedback => {
  if (error instanceof ApiRequestError) {
    const data = error.data as Partial<PlateRecognitionResult> | null
    if (data && (data.providerResponse || data.providerError || data.message)) {
      return buildPlateRecognitionFeedback({
        imageUrl: typeof data.imageUrl === 'string' ? data.imageUrl : '',
        licensePlate: data.licensePlate,
        confidence: data.confidence,
        regionCode: data.regionCode,
        provider: data.provider,
        providerStatusCode: data.providerStatusCode ?? error.statusCode,
        providerError: data.providerError,
        providerResponse: data.providerResponse,
        minimumConfidence: data.minimumConfidence,
        message: data.message || error.message,
        candidates: data.candidates,
      })
    }

    return {
      ok: false,
      message: `Nhận diện biển số thất bại: ${error.message || `HTTP ${error.statusCode}`}`,
      detail: typeof error.data === 'string' ? error.data : JSON.stringify(error.data, null, 2),
    }
  }

  return {
    ok: false,
    message: error instanceof Error
      ? `Nhận diện biển số thất bại: ${error.message}`
      : 'Nhận diện biển số thất bại: Lỗi kết nối khi chụp biển số.',
  }
}
