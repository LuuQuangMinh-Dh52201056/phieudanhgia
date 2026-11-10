import { directorySnapshot, publishDirectory, state } from './runtime.mjs'

export function normalizeDirectoryName(value) {
  return String(value ?? '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('vi-VN')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd')
}

export function normalizeVehiclePlate(value) {
  return String(value ?? '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
}

export function getTrainingDirectoryError(error, action) {
  return error instanceof Error ? error.message : `Không thể ${action}. Vui lòng thử lại.`
}

export function subscribeTrainingDirectory(onDirectory) {
  state.directoryListeners.add(onDirectory)
  queueMicrotask(() => {
    if (state.directoryListeners.has(onDirectory)) onDirectory(directorySnapshot())
  })
  return () => state.directoryListeners.delete(onDirectory)
}

export async function saveTrainingTeacher({ id, name }) {
  const normalizedName = String(name ?? '').trim().replace(/\s+/g, ' ')
  if (!normalizedName) throw new Error('Tên giáo viên không được để trống.')
  const teacher = { id: id || `teacher-test-${state.nextId++}`, name: normalizedName }
  const index = state.teachers.findIndex((item) => item.id === teacher.id)
  if (index < 0) state.teachers.push(teacher)
  else state.teachers[index] = teacher
  publishDirectory()
  return structuredClone(teacher)
}

export async function deleteTrainingTeacher(id) {
  state.teachers = state.teachers.filter((teacher) => teacher.id !== id)
  publishDirectory()
}

export async function saveTrainingVehicle({ id, plateNumber, vehicleCategory }) {
  const normalizedPlate = String(plateNumber ?? '').trim().toUpperCase()
  if (!normalizedPlate) throw new Error('Biển số xe không được để trống.')
  if (!['B_MANUAL', 'B_AUTOMATIC', 'C1'].includes(vehicleCategory)) throw new Error('Hạng xe không hợp lệ.')
  const vehicle = { id: id || `vehicle-test-${state.nextId++}`, plateNumber: normalizedPlate, vehicleCategory }
  const index = state.vehicles.findIndex((item) => item.id === vehicle.id)
  if (index < 0) state.vehicles.push(vehicle)
  else state.vehicles[index] = vehicle
  publishDirectory()
  return structuredClone(vehicle)
}

export async function deleteTrainingVehicle(id) {
  state.vehicles = state.vehicles.filter((vehicle) => vehicle.id !== id)
  publishDirectory()
}
