import type { VehicleCategory } from './evaluation'

export interface Teacher {
  id: string
  name: string
}

export type TrainingTeacher = Teacher

export interface TrainingVehicle {
  id: string
  plateNumber: string
  vehicleCategory: VehicleCategory
}

export interface TrainingDirectoryState {
  teachers: Teacher[]
  vehicles: TrainingVehicle[]
  loading: boolean
  error: string
  teachersLoading: boolean
  vehiclesLoading: boolean
  teacherError: string
  vehicleError: string
}
