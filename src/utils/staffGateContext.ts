export type StaffGateOperation = 'checkin' | 'checkout'

export interface StaffGateContext {
  operation: StaffGateOperation
  floorId: string
  floorName: string
  isResident: boolean
  dedicatedVehicleTypeId?: string
  dedicatedVehicleTypeName?: string
  gateId: string
  gateName: string
  gateType: 'Entry' | 'Exit'
}

export function isCarVehicleTypeName(typeName?: string | null) {
  if (!typeName) return false

  const normalized = typeName
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim()
    .toLowerCase()

  return normalized === 'o to'
}

const LEGACY_STORAGE_KEY = 'pbms.staff-gate-context'

function storageKey(operation: StaffGateOperation) {
  return `${LEGACY_STORAGE_KEY}.${operation}`
}

export function saveStaffGateContext(context: StaffGateContext) {
  sessionStorage.setItem(storageKey(context.operation), JSON.stringify(context))
}

export function readStaffGateContext(operation: StaffGateOperation): StaffGateContext | null {
  try {
    const raw =
      sessionStorage.getItem(storageKey(operation)) ??
      sessionStorage.getItem(LEGACY_STORAGE_KEY)
    if (!raw) return null
    const context = JSON.parse(raw) as StaffGateContext
    if (
      context.operation !== operation ||
      !context.floorId ||
      !context.gateId ||
      !context.floorName ||
      !context.gateName
    ) {
      return null
    }
    sessionStorage.setItem(storageKey(operation), raw)
    return context
  } catch {
    return null
  }
}

export function staffGateSelectionPath(operation: StaffGateOperation) {
  return `/staff/chon-cong/${operation}`
}
