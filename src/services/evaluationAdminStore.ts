import { addDoc, collection, deleteDoc, doc, onSnapshot, runTransaction, serverTimestamp, Timestamp, type DocumentData, type DocumentReference } from 'firebase/firestore'
import { firebaseAuth, firestoreDatabase } from '../lib/firebase'
import { BackendOperationError, normalizeFirestoreError, requireDocumentId, runFirestoreWrite } from './firestoreOperations'

export type AdminTrainingType = 'BASIC' | 'EXAM' | 'ROAD'
export type StoredTrainingType = AdminTrainingType | 'UNKNOWN'

export interface EvaluationAdminRecord {
  id: string
  teacherName: string
  studentName: string
  trainingType: StoredTrainingType
  vehicleCategory: string
  vehicleNumber?: string
  evaluationDate: string
  practiceAttempt?: string
  trainingCourse?: string
  overallResult?: string | null
  teacherComment?: string
  evaluationData?: unknown
  reportImageUrl?: string
  createdAt: string
  updatedAt: string
  updatedBy?: string
  revision?: string
}

export interface SaveEvaluationAdminInput {
  /** Compatibility only: saving always creates a new document, including when id is supplied. */
  id?: string
  teacherName: string
  studentName: string
  trainingType: AdminTrainingType
  vehicleCategory: string
  vehicleNumber?: string
  evaluationDate?: string
  practiceAttempt?: string
  trainingCourse?: string
  overallResult?: string | null
  teacherComment?: string
  evaluationData?: unknown
}

export interface EditEvaluationAdminInput {
  teacherName: string
  studentName: string
  vehicleNumber: string
  evaluationDate: string
  practiceAttempt: string
  trainingCourse: string
  overallResult: string | null
  teacherComment: string
  evaluationData?: Record<string, unknown>
}

const pendingCreations = new WeakMap<SaveEvaluationAdminInput, Promise<DocumentReference>>()

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : ''
}

function timestampToIso(value: unknown): string {
  try {
    if (value instanceof Timestamp) return value.toDate().toISOString()
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? '' : value.toISOString()
    if (typeof value === 'string' && value.trim()) {
      const normalized = value.trim()
      // Accept ISO calendar dates or timestamps with an explicit timezone;
      // locale dates such as 01/02/2024 differ between browsers.
      if (!/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2}))?$/.test(normalized)) return ''
      const milliseconds = Date.parse(normalized)
      return Number.isNaN(milliseconds) ? '' : new Date(milliseconds).toISOString()
    }
    if (value && typeof value === 'object' && 'seconds' in value && typeof value.seconds === 'number') {
      const nanoseconds = 'nanoseconds' in value && typeof value.nanoseconds === 'number' ? value.nanoseconds : 0
      return new Timestamp(value.seconds, nanoseconds).toDate().toISOString()
    }
  } catch { /* Invalid legacy timestamps remain unknown instead of becoming today's date. */ }
  return ''
}

function trainingType(value: unknown): StoredTrainingType {
  if (value === 'COURSE') return 'EXAM'
  return value === 'BASIC' || value === 'EXAM' || value === 'ROAD' ? value : 'UNKNOWN'
}

function revision(value: unknown): string {
  return value instanceof Timestamp ? `${value.seconds}:${value.nanoseconds}` : timestampToIso(value)
}

/** Handles legacy records without manufacturing names, dates or assessment types. */
export function mapEvaluationAdminDocument(id: string, data: DocumentData): EvaluationAdminRecord {
  const evaluationData = data.evaluationData ?? null
  const nestedType = evaluationData && typeof evaluationData === 'object' && 'trainingType' in evaluationData
    ? evaluationData.trainingType : undefined
  const explicitType = trainingType(data.trainingType)
  const imageUrl = text(data.reportImageUrl)
  return {
    id,
    teacherName: text(data.teacherName),
    studentName: text(data.studentName),
    trainingType: explicitType === 'UNKNOWN' ? trainingType(nestedType) : explicitType,
    vehicleCategory: text(data.vehicleCategory),
    vehicleNumber: text(data.vehicleNumber) || undefined,
    evaluationDate: text(data.evaluationDate),
    practiceAttempt: text(data.practiceAttempt) || undefined,
    trainingCourse: text(data.trainingCourse) || undefined,
    overallResult: text(data.overallResult) || null,
    teacherComment: typeof data.teacherComment === 'string' ? data.teacherComment.trim() : '',
    evaluationData,
    reportImageUrl: /^https?:\/\//i.test(imageUrl) ? imageUrl : undefined,
    createdAt: timestampToIso(data.createdAt),
    updatedAt: timestampToIso(data.updatedAt),
    updatedBy: text(data.updatedBy) || undefined,
    revision: revision(data.updatedAt),
  }
}

/** Anonymous teacher flow creates a fresh record; existing records are never updated. */
export async function saveEvaluationAdminRecord(input: SaveEvaluationAdminInput): Promise<EvaluationAdminRecord> {
  const teacherName = text(input.teacherName)
  const studentName = text(input.studentName)
  const vehicleCategory = text(input.vehicleCategory)
  if (!teacherName) throw new Error('Tên giáo viên không được để trống.')
  if (!studentName) throw new Error('Tên học viên không được để trống.')
  if (!vehicleCategory) throw new Error('Hạng xe không được để trống.')
  if (!['BASIC', 'EXAM', 'ROAD'].includes(input.trainingType)) throw new Error('Loại đánh giá không hợp lệ.')
  const evaluationDate = text(input.evaluationDate)
  if (!evaluationDate) throw new Error('Vui lòng chọn ngày đánh giá.')

  const data = {
    teacherName,
    studentName,
    trainingType: input.trainingType,
    vehicleCategory,
    vehicleNumber: text(input.vehicleNumber),
    evaluationDate,
    practiceAttempt: text(input.practiceAttempt),
    trainingCourse: text(input.trainingCourse),
    overallResult: text(input.overallResult) || null,
    teacherComment: typeof input.teacherComment === 'string' ? input.teacherComment.trim() : '',
    evaluationData: input.evaluationData ?? null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }
  const reference = await runFirestoreWrite(() => {
    const pending = pendingCreations.get(input)
    if (pending) return pending
    const write = addDoc(collection(firestoreDatabase, 'evaluations'), data).catch((error: unknown) => {
      pendingCreations.delete(input)
      throw error
    })
    pendingCreations.set(input, write)
    return write
  }, 'lưu phiếu đánh giá')
  // Server timestamps are authoritative. The anonymous creator cannot read the
  // private document back, so timestamps stay blank until an admin snapshot.
  return mapEvaluationAdminDocument(reference.id, data)
}

export async function updateEvaluationAdminRecord(record: EvaluationAdminRecord, input: EditEvaluationAdminInput): Promise<void> {
  const id = requireDocumentId(record.id, 'phiếu')
  const teacherName = text(input.teacherName)
  const studentName = text(input.studentName)
  if (!teacherName || !studentName) throw new Error('Vui lòng nhập tên giáo viên và học viên.')
  const evaluationDate = text(input.evaluationDate)
  const parsedDate = new Date(evaluationDate)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(evaluationDate) || !Number.isFinite(+parsedDate) || parsedDate.toISOString().slice(0, 10) !== evaluationDate) {
    throw new Error('Vui lòng chọn ngày đánh giá hợp lệ.')
  }
  const practiceAttempt = text(input.practiceAttempt)
  if (practiceAttempt && !/^(?:[1-9]|10)$/.test(practiceAttempt)) throw new Error('Lần tập phải từ 1 đến 10.')
  const updatedBy = firebaseAuth.currentUser?.uid
  if (!updatedBy) throw new BackendOperationError('Vui lòng đăng nhập lại để sửa phiếu đánh giá.', 'unauthenticated')

  const fields = {
    teacherName, studentName, evaluationDate, practiceAttempt,
    vehicleNumber: text(input.vehicleNumber).toUpperCase(),
    trainingCourse: text(input.trainingCourse),
    overallResult: text(input.overallResult) || null,
    teacherComment: input.teacherComment.trim(),
    updatedAt: serverTimestamp(),
    updatedBy,
    ...(input.evaluationData ? { evaluationData: input.evaluationData } : {}),
  }
  const reference = doc(firestoreDatabase, 'evaluations', id)
  await runFirestoreWrite(() => runTransaction(firestoreDatabase, async (transaction) => {
    const current = await transaction.get(reference)
    if (!current.exists()) throw new BackendOperationError('Phiếu này đã bị xóa. Hãy đóng biểu mẫu và tải lại danh sách.', 'not-found')
    if (revision(current.data().updatedAt) !== record.revision) {
      throw new BackendOperationError('Phiếu đã được cập nhật. Hãy mở lại từ danh sách để xem bản mới nhất.', 'conflict')
    }
    transaction.update(reference, fields)
  }), 'sửa phiếu đánh giá')
}

export async function deleteEvaluationAdminRecord(id: string): Promise<void> {
  const documentId = requireDocumentId(id, 'phiếu')
  await runFirestoreWrite(() => deleteDoc(doc(firestoreDatabase, 'evaluations', documentId)), 'xóa phiếu đánh giá')
}

export function subscribeEvaluationAdminRecords(
  onRecords: (records: EvaluationAdminRecord[]) => void,
  onError?: (error: Error) => void,
): () => void {
  let active = true
  let unsubscribe = () => undefined as void
  try {
    // An orderBy(createdAt) query omits legacy documents with no createdAt.
    // Sort client-side so those records remain visible and can be managed.
    unsubscribe = onSnapshot(collection(firestoreDatabase, 'evaluations'), (snapshot) => {
      if (!active) return
      const records = snapshot.docs.map((item) => mapEvaluationAdminDocument(item.id, item.data()))
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt) || left.id.localeCompare(right.id))
      onRecords(records)
    }, (error) => {
      if (active) onError?.(normalizeFirestoreError(error, 'tải danh sách phiếu đánh giá'))
    })
  } catch (error) {
    queueMicrotask(() => {
      if (active) onError?.(normalizeFirestoreError(error, 'tải danh sách phiếu đánh giá'))
    })
  }
  return () => { active = false; unsubscribe() }
}
