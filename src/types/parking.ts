export type SpotStatus = 'available' | 'occupied' | 'assigned' | 'selected' | 'disabled'

export type SpotType = 'standard' | 'ev' | 'handicap'

export interface ParkingSpot {
  id: string
  row: string
  number: number
  status: SpotStatus
  type: SpotType
}

export interface ParkingFloor {
  id: number
  name: string
  rows: string[]
  cols: number
  spots: ParkingSpot[]
}
