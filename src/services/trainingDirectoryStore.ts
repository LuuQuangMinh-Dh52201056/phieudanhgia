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
import { normalizeFirestoreError, requireDocumentId, runFirestoreWrite } from './firestoreOperations'
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
  return normalizeFirestoreError(error, action).message
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
        teachers: [],
        teachersLoading: false,
        teacherError: getTrainingDirectoryError(error, 'tải danh mục giáo viên'),
      }),
    ))
  } catch (error) {
    emit({
      teachers: [],
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
        vehicles: [],
        vehiclesLoading: false,
        vehicleError: getTrainingDirectoryError(error, 'tải danh mục xe'),
      }),
    ))
  } catch (error) {
    emit({
      vehicles: [],
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
  const normalizedName = normalizeDirectoryName(name)
  if (!normalizedName) throw new Error('Vui lòng nhập tên giáo viên hợp lệ.')
  const data = { name, normalizedName, updatedAt: serverTimestamp() }
  if (input.id !== undefined) {
    const id = requireDocumentId(input.id, 'giáo viên')
    await runFirestoreWrite(() => updateDoc(doc(firestoreDatabase, 'trainingTeachers', id), data), 'sửa giáo viên')
    return { id, name }
  }
  const reference = await runFirestoreWrite(() => addDoc(collection(firestoreDatabase, 'trainingTeachers'), {
    ...data,
    createdAt: serverTimestamp(),
  }), 'thêm giáo viên')
  return { id: reference.id, name }
}

export async function deleteTrainingTeacher(id: string): Promise<void> {
  const documentId = requireDocumentId(id, 'giáo viên')
  await runFirestoreWrite(() => deleteDoc(doc(firestoreDatabase, 'trainingTeachers', documentId)), 'xóa giáo viên')
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
    const id = requireDocumentId(input.id, 'xe')
    await runFirestoreWrite(() => updateDoc(doc(firestoreDatabase, 'trainingVehicles', id), data), 'sửa xe')
    return { id, plateNumber, vehicleCategory }
  }
  const reference = await runFirestoreWrite(() => addDoc(collection(firestoreDatabase, 'trainingVehicles'), {
    ...data,
    createdAt: serverTimestamp(),
  }), 'thêm xe')
  return { id: reference.id, plateNumber, vehicleCategory }
}

export async function deleteTrainingVehicle(id: string): Promise<void> {
  const documentId = requireDocumentId(id, 'xe')
  await runFirestoreWrite(() => deleteDoc(doc(firestoreDatabase, 'trainingVehicles', documentId)), 'xóa xe')
}
