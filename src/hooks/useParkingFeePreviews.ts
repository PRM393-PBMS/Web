import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import {
  parkingOperationApi,
  parkingSessionApi,
  type ParkingFeePreview,
  type ParkingSessionDto,
} from '../utils/apiServices'

export function useParkingFeePreviews(sessions: ParkingSessionDto[]) {
  const { user } = useAuth()
  const [previews, setPreviews] = useState<Record<string, ParkingFeePreview>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const canManageParkingSessions = user?.role === 'manager' || user?.role === 'staff'
  const activeSessionIdsKey = useMemo(
    () =>
      sessions
        .filter((session) => session.status?.toLowerCase() === 'active')
        .map((session) => session.sessionId)
        .sort()
        .join(','),
    [sessions],
  )

  const refresh = useCallback(async () => {
    const sessionIds = activeSessionIdsKey ? activeSessionIdsKey.split(',') : []
    if (sessionIds.length === 0) {
      setPreviews({})
      setErrors({})
      return
    }

    const responses = await Promise.allSettled(
      sessionIds.map(async (sessionId) => ({
        sessionId,
        response: await (canManageParkingSessions
          ? parkingOperationApi.getFeePreview(sessionId)
          : parkingSessionApi.getMyFeePreview(sessionId)),
      })),
    )

    const nextPreviews: Record<string, ParkingFeePreview> = {}
    const nextErrors: Record<string, string> = {}
    responses.forEach((result, index) => {
      if (result.status === 'rejected') {
        nextErrors[sessionIds[index]] = 'Không thể tải phí tạm tính'
        return
      }
      const { sessionId, response } = result.value
      if (response.isSuccess && response.result) {
        nextPreviews[sessionId] = response.result
      } else {
        nextErrors[sessionId] = response.message || 'Chưa tính được phí tạm tính'
      }
    })
    setPreviews(nextPreviews)
    setErrors(nextErrors)
  }, [activeSessionIdsKey, canManageParkingSessions])

  useEffect(() => {
    const initialTimer = window.setTimeout(() => void refresh(), 0)
    return () => window.clearTimeout(initialTimer)
  }, [activeSessionIdsKey, refresh])

  return { previews, errors, refresh }
}
