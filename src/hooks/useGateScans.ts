import { useCallback, useEffect, useState } from 'react'
import { apiClient, ApiRequestError } from '../config/api'
import {
  gateScanApi,
  mergeGateScans,
  readGateScanStream,
  type GateScan,
} from '../utils/gateScans'

export function useGateScans(gateId: string) {
  const [scans, setScans] = useState<GateScan[]>([])
  const [connection, setConnection] = useState<
    'connecting' | 'connected' | 'retrying' | 'error'
  >('connecting')
  const [error, setError] = useState('')
  const [selectedScan, setSelectedScan] = useState<GateScan | null>(null)

  useEffect(() => {
    if (!gateId) return
    const controller = new AbortController()
    let retryTimer: ReturnType<typeof setTimeout> | undefined
    let failures = 0
    let generation = 0
    queueMicrotask(() => {
      if (controller.signal.aborted) return
      setScans([])
      setSelectedScan(null)
      setConnection('connecting')
      setError('')
    })

    const connect = async () => {
      const attempt = ++generation
      try {
        const response = await apiClient.openEventStream(
          `/GateScan/stream?gateId=${encodeURIComponent(gateId)}`,
          controller.signal,
        )
        if (controller.signal.aborted) {
          await response.body?.cancel()
          return
        }
        setConnection('connected')
        setError('')
        failures = 0
        // Subscribe before loading history; live events win over an older history response.
        const liveIds = new Set<string>()
        let historyLoaded = false
        void gateScanApi
          .recent(gateId)
          .then((result) => {
            if (controller.signal.aborted || attempt !== generation) return
            if (!result.isSuccess)
              throw new Error(
                result.message || 'Không tải được lượt quét gần đây.',
              )
            const history = (result.result ?? []).filter(
              (scan) => !liveIds.has(scan.scanId),
            )
            setScans((current) => mergeGateScans(current, history, gateId))
            setSelectedScan(
              (current) =>
                history.find((scan) => scan.scanId === current?.scanId) ??
                current,
            )
          })
          .catch(() => {
            if (!controller.signal.aborted && attempt === generation)
              setError(
                'Chưa tải được lịch sử. Lượt quét mới vẫn được nhận trực tiếp.',
              )
          })
          .finally(() => {
            historyLoaded = true
            liveIds.clear()
          })
        await readGateScanStream(response, controller.signal, (scan) => {
          if (controller.signal.aborted || scan.gateId !== gateId) return
          if (!historyLoaded) liveIds.add(scan.scanId)
          setScans((current) => mergeGateScans(current, [scan], gateId))
          setSelectedScan((current) =>
            current?.scanId === scan.scanId ? scan : current,
          )
        })
        if (!controller.signal.aborted)
          throw new Error('Kết nối lượt quét đã ngắt.')
      } catch (reason) {
        if (controller.signal.aborted) return
        if (
          reason instanceof ApiRequestError &&
          [401, 403, 404].includes(reason.statusCode)
        ) {
          setConnection('error')
          setError(
            reason.statusCode === 403
              ? 'Tài khoản không có quyền nhận lượt quét.'
              : reason.statusCode === 404
                ? 'Backend chưa có API lượt quét realtime.'
                : reason.message,
          )
          return
        }
        setConnection('retrying')
        setError('Mất kết nối lượt quét. Đang tự kết nối lại…')
        retryTimer = setTimeout(
          () => {
            void connect()
          },
          Math.min(3000 * 2 ** failures++, 30_000),
        )
      }
    }
    void connect()
    return () => {
      controller.abort()
      clearTimeout(retryTimer)
    }
  }, [gateId])

  const markStatus = useCallback(
    async (
      id: string | undefined,
      status: 'Handled' | 'Dismissed' = 'Handled',
    ) => {
      if (!id) return
      try {
        const result = await gateScanApi.setStatus(id, status)
        if (!result.isSuccess || !result.result)
          throw new Error(result.message || 'Không cập nhật được lượt quét.')
        setError('')
        setScans((current) => mergeGateScans(current, [result.result!], gateId))
        setSelectedScan((current) =>
          current?.scanId === id ? result.result! : current,
        )
      } catch {
        setError(
          'Chưa cập nhật được trạng thái lượt quét. Kiểm tra kết quả vào/ra bãi rồi bấm đánh dấu lại.',
        )
      }
    },
    [gateId],
  )

  const visibleScans = scans.filter((scan) => scan.gateId === gateId)
  const clearSelection = useCallback(() => setSelectedScan(null), [])
  return {
    scans: visibleScans,
    connection,
    error,
    markStatus,
    clearSelection,
    selectedScan: selectedScan?.gateId === gateId ? selectedScan : null,
    selectScan: (id: string | null) =>
      setSelectedScan(visibleScans.find((scan) => scan.scanId === id) ?? null),
  }
}
