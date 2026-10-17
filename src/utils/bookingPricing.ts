export const DEPOSIT_RATES = {
  car: 25000,
  bike: 5000,
} as const

export const HOURLY_RATES = {
  car: { day: 25000, night: 40000 },
  bike: { day: 5000, night: 10000 },
} as const

export function vehicleTypeLabel(vehicle: 'car' | 'bike') {
  return vehicle === 'car' ? 'Ô tô' : 'Xe máy'
}

export function depositAmount(vehicle: 'car' | 'bike') {
  return DEPOSIT_RATES[vehicle]
}
