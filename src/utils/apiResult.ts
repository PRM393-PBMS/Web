import { apiErrorMessage } from '../config/api'

/**
 * Lý do một lần gọi API thất bại để báo người dùng, hoặc null khi thành công.
 * Gồm cả trường hợp máy chủ trả 200 nhưng `isSuccess: false`: không được coi như "không có dữ liệu".
 */
export function failureOf(
  result: PromiseSettledResult<{ isSuccess?: boolean; message?: string | null }>,
  fallback: string,
): string | null {
  if (result.status === 'rejected') return apiErrorMessage(result.reason, fallback)
  if (result.value?.isSuccess === false) return result.value.message || fallback
  return null
}
