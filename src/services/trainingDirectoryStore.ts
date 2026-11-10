import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  updateDoc,
  type DocumentData,
} from 'firebase/firestore'
import { firestoreDatabase } from '../lib/firebase'
import type { VehicleCategory } from '../types/evaluation'
import type { Teacher, TrainingDirectoryState, TrainingVehicle } from '../types/trainingDirectory'

const VEHICLE_CATEGORIES: VehicleCategory[] = ['B_MANUAL', 'B_AUTOMATIC', 'C1']

function cleanText(value: unknown): string {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : ''
}

function isVehicleCategory(value: unknown): value is VehicleCategory {
  return VEHICLE_CATEGORIES.some((category) => category === value)
}

export function normalizeDirectoryName(value: string): string {
  return cleanText(value)
    .toLocaleLowerCase('vi-VN')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
}

export function normalizeVehiclePlate(value: string): string {
  return cleanText(value).toUpperCase().replace(/[^A-Z0-9]/g, '')
}

export function getTrainingDirectoryError(error: unknown, action: string): string {
  const code = error && typeof error === 'object' && 'code' in error
    ? String(error.code)
    : ''
  if (code.includes('permission-denied')) {
    return `Không có quyền ${action}. Vui lòng kiểm tra Firestore Rules cho trainingTeachers và trainingVehicles.`
  }
  if (code.includes('unavailable') || code.includes('network-request-failed')) {
    return `Không thể ${action} vì mất kết nối. Kiểm tra Internet rồi thử lại.`
  }
  return error instanceof Error ? error.message : `Không thể ${action}. Vui lòng thử lại.`
}

function getDocumentId(id: string): string {
  const normalized = cleanText(id)
  if (!normalized || normalized.includes('/')) {
    throw new Error('Mã danh mục không hợp lệ.')
  }
  return normalized
}

function readTeacher(id: string, data: DocumentData): Teacher | null {
  const name = cleanText(data.name)
  if (!name) return null
  return {
    id,
    name,
  }
}

function readVehicle(id: string, data: DocumentData): TrainingVehicle | null {
  const plateNumber = cleanText(data.plateNumber).toUpperCase()
  if (!isVehicleCategory(data.vehicleCategory) || !normalizeVehiclePlate(plateNumber)) return null
  return {
    id,
    plateNumber,
    vehicleCategory: data.vehicleCategory,
  }
}

export function subscribeTrainingDirectory(
  onState: (state: TrainingDirectoryState) => void,
): () => void {
  let active = true
  let state: TrainingDirectoryState = {
    teachers: [],
    vehicles: [],
    loading: true,
    error: '',
    teachersLoading: true,
    vehiclesLoading: true,
    teacherError: '',
    vehicleError: '',
  }
  const emit = (updates: Partial<TrainingDirectoryState>) => {
    if (!active) return
    state = { ...state, ...updates }
    state.loading = state.teachersLoading || state.vehiclesLoading
    state.error = [state.teacherError, state.vehicleError].filter(Boolean).join(' ')
    onState(state)
  }
  emit({})

  const subscriptions: Array<() => void> = []
  try {
    subscriptions.push(onSnapshot(
      collection(firestoreDatabase, 'trainingTeachers'),
      (snapshot) => emit({
        teachers: snapshot.docs
          .map((item) => readTeacher(item.id, item.data()))
          .filter((teacher): teacher is Teacher => teacher !== null)
          .sort((left, right) => left.name.localeCompare(right.name, 'vi-VN')),
        teachersLoading: false,
        teacherError: '',
      }),
      (error) => emit({
        teachersLoading: false,
        teacherError: getTrainingDirectoryError(error, 'tải danh mục giáo viên'),
      }),
    ))
  } catch (error) {
    emit({
      teachersLoading: false,
      teacherError: getTrainingDirectoryError(error, 'tải danh mục giáo viên'),
    })
  }
  try {
    subscriptions.push(onSnapshot(
      collection(firestoreDatabase, 'trainingVehicles'),
      (snapshot) => emit({
        vehicles: snapshot.docs
          .map((item) => readVehicle(item.id, item.data()))
          .filter((vehicle): vehicle is TrainingVehicle => vehicle !== null)
          .sort((left, right) => left.plateNumber.localeCompare(right.plateNumber, 'vi-VN')),
        vehiclesLoading: false,
        vehicleError: '',
      }),
      (error) => emit({
        vehiclesLoading: false,
        vehicleError: getTrainingDirectoryError(error, 'tải danh mục xe'),
      }),
    ))
  } catch (error) {
    emit({
      vehiclesLoading: false,
      vehicleError: getTrainingDirectoryError(error, 'tải danh mục xe'),
    })
  }
  return () => {
    active = false
    subscriptions.forEach((unsubscribe) => unsubscribe())
  }
}

export async function saveTrainingTeacher(input: {
  id?: string
  name: string
}): Promise<Teacher> {
  const name = cleanText(input.name)
  if (!name) throw new Error('Vui lòng nhập tên giáo viên.')
  if (name.length > 120) throw new Error('Tên giáo viên không được vượt quá 120 ký tự.')
  const data = { name, normalizedName: normalizeDirectoryName(name), updatedAt: serverTimestamp() }
  if (input.id !== undefined) {
    const id = getDocumentId(input.id)
    await updateDoc(doc(firestoreDatabase, 'trainingTeachers', id), data)
    return { id, name }
  }
  const reference = await addDoc(collection(firestoreDatabase, 'trainingTeachers'), {
    ...data,
    createdAt: serverTimestamp(),
  })
  return { id: reference.id, name }
}

export async function deleteTrainingTeacher(id: string): Promise<void> {
  await deleteDoc(doc(firestoreDatabase, 'trainingTeachers', getDocumentId(id)))
}

export async function saveTrainingVehicle(input: {
  id?: string
  plateNumber: string
  vehicleCategory: VehicleCategory
}): Promise<TrainingVehicle> {
  const plateNumber = cleanText(input.plateNumber).toUpperCase()
  if (!normalizeVehiclePlate(plateNumber)) throw new Error('Vui lòng nhập biển số xe hợp lệ.')
  if (plateNumber.length > 32) throw new Error('Biển số xe không được vượt quá 32 ký tự.')
  if (!isVehicleCategory(input.vehicleCategory)) throw new Error('Vui lòng chọn hạng xe hợp lệ.')
  const vehicleCategory = input.vehicleCategory
  const data = { plateNumber, vehicleCategory, normalizedPlate: normalizeVehiclePlate(plateNumber), updatedAt: serverTimestamp() }
  if (input.id !== undefined) {
    const id = getDocumentId(input.id)
    await updateDoc(doc(firestoreDatabase, 'trainingVehicles', id), data)
    return { id, plateNumber, vehicleCategory }
  }
  const reference = await addDoc(collection(firestoreDatabase, 'trainingVehicles'), {
    ...data,
    createdAt: serverTimestamp(),
  })
  return { id: reference.id, plateNumber, vehicleCategory }
}

export async function deleteTrainingVehicle(id: string): Promise<void> {
  await deleteDoc(doc(firestoreDatabase, 'trainingVehicles', getDocumentId(id)))
}
