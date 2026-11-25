import { useEffect, useMemo, useRef, useState } from 'react'
import { toCanvas } from 'html-to-image'
import { Activity, ArrowDownToLine, ArrowRight, CalendarDays, CarFront, Check, ChevronRight, ClipboardList, Download, Eye, FileText, LayoutDashboard, LoaderCircle, Pencil, RefreshCw, Search, SlidersHorizontal, Trash2, Users, X } from 'lucide-react'
import { AdminEvaluationEditDialog } from '../components/AdminEvaluationEditDialog'
import { AdminTrainingDirectory } from '../components/AdminTrainingDirectory'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { ChecklistReport } from '../components/ChecklistReport'
import { EvaluationReport } from '../components/EvaluationReport'
import { ReportImageDialog, type ReportImage } from '../components/ReportImageDialog'
import { PHU_GIAO_LOGO_DATA_URL, TrainingCenterBrand } from '../components/TrainingCenterBrand'
import { createEmergencyEvaluation, createLessonEvaluations } from '../data/lessonConfigs'
import { deleteEvaluationAdminRecord, subscribeEvaluationAdminRecords, updateEvaluationAdminRecord, type EvaluationAdminRecord } from '../services/evaluationAdminStore'
import type { EvaluationState, LessonEvaluation, TrainingType, VehicleCategory } from '../types/evaluation'
import { CONCLUSION_META, STATUS_META, generateFileName, getTodayInputValue } from '../utils/evaluation'
import { canvasToPngBlob, describeExportError, getExportPixelRatios, getPhotoDevice } from '../utils/reportExport'
import '../styles/admin-teachers.css'

type AdminView = 'overview' | 'records' | 'directory'
type RecordView = 'records' | 'teachers'
type UnknownObject = Record<string, unknown>
const TRAINING_LABELS: Record<string, string> = { BASIC: 'Tập cơ bản', EXAM: 'Sa hình', COURSE: 'Sa hình', ROAD: 'Đường trường' }
const RESULT_LABELS: Record<string, string> = {
  UNDERSTOOD: 'Đã hiểu', NEEDS_WORK: 'Cần lưu ý', UNCLEAR: 'Chưa rõ', GOOD: 'Tốt', FAIR: 'Khá', AVERAGE: 'Trung bình', WEAK: 'Yếu',
  NOTICE: 'Cần lưu ý', NEEDS_PRACTICE: 'Cần luyện thêm', BASIC_UNDERSTOOD: 'Tốt — nắm vững kiến thức, thao tác tốt',
  BASIC_NEEDS_WORK: 'Cần lưu ý — cần chú ý và luyện tập thêm', BASIC_PRACTICE: 'Cần luyện thêm', ROAD_PASSED: 'Đạt yêu cầu', ROAD_NOT_PASSED: 'Chưa đạt',
  PASSED: 'Đạt', NOT_PASSED: 'Chưa đạt', COMPLETED: 'Hoàn thành', NOT_COMPLETED: 'Chưa hoàn thành', PASS: 'Đạt', FAIL: 'Chưa đạt',
  ...Object.fromEntries(Object.entries(CONCLUSION_META).map(([key, value]) => [key, value.label])),
}

function normalize(value: string) {
  return value.trim().toLocaleLowerCase('vi-VN').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/\s+/g, ' ')
}
function categoryLabel(value: string) {
  const key = normalize(value).replace(/[^a-z0-9]/g, '')
  if (['bmanual', 'bss', 'bsosan'].includes(key)) return 'BSS'
  if (['bautomatic', 'btd', 'bsotudong'].includes(key)) return 'BTĐ'
  return key === 'c1' ? 'C1' : value.trim() || 'Chưa xác định'
}
function trainingLabel(value: string) { return TRAINING_LABELS[value] || 'Không xác định' }
function resultLabel(value?: string | null) { return value ? RESULT_LABELS[value] || value : 'Chưa ghi' }
function parseDate(value: string) { return new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00` : value) }
function dateLabel(value: string, time = false) {
  if (!value) return '—'
  const date = parseDate(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', ...(time ? { hour: '2-digit', minute: '2-digit' } as const : {}) }).format(date)
}
function localDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
function asObject(value: unknown): UnknownObject | null { return value && typeof value === 'object' && !Array.isArray(value) ? value as UnknownObject : null }
function readText(data: UnknownObject, keys: string[]) {
  for (const key of keys) if (['string', 'number', 'boolean'].includes(typeof data[key]) && String(data[key]).trim()) return String(data[key]).trim()
  return ''
}
function stringArray(value: unknown) { return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [] }
function preferredText(data: UnknownObject, key: string, legacyKeys: string[]) {
  return Object.prototype.hasOwnProperty.call(data, key) ? readText(data, [key]) : readText(data, legacyKeys)
}
function describeError(error: unknown) {
  const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : ''
  const message = error instanceof Error ? error.message : 'Không thể hoàn tất thao tác. Vui lòng thử lại.'
  if (code.includes('permission-denied') || /permission-denied|insufficient permissions/i.test(message)) return 'Tài khoản chưa có quyền thực hiện thao tác này. Vui lòng kiểm tra quyền quản trị trong Firestore Rules rồi thử lại.'
  if (code.includes('unavailable')) return 'Kết nối đang gián đoạn. Kiểm tra Internet rồi thử lại.'
  return message
}
function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 5000)
}
function exportCsv(records: EvaluationAdminRecord[]) {
  const rows = [
    ['Giáo viên', 'Học viên', 'Loại đánh giá', 'Hạng xe', 'Biển số', 'Lần tập', 'Khóa học', 'Ngày đánh giá', 'Kết quả', 'Nhận xét', 'Thời gian tạo', 'Cập nhật'],
    ...records.map((record) => [record.teacherName, record.studentName, trainingLabel(record.trainingType), categoryLabel(record.vehicleCategory), record.vehicleNumber, record.practiceAttempt, record.trainingCourse, record.evaluationDate, resultLabel(record.overallResult), record.teacherComment, dateLabel(record.createdAt, true), dateLabel(record.updatedAt, true)]),
  ]
  const csv = rows.map((row) => row.map((value) => {
    const text = String(value ?? '')
    return `"${(/^[=+\-@\t\r]/.test(text) ? `'${text}` : text).replace(/"/g, '""')}"`
  }).join(',')).join('\r\n')
  saveBlob(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }), `du-lieu-danh-gia-${getTodayInputValue()}.csv`)
}

function historicalState(record: EvaluationAdminRecord): EvaluationState | null {
  const data = asObject(record.evaluationData)
  if (!data) return null
  const category = categoryLabel(readText(data, ['vehicleCategory']) || record.vehicleCategory)
  const vehicleCategory: VehicleCategory | null = category === 'BSS' ? 'B_MANUAL' : category === 'BTĐ' ? 'B_AUTOMATIC' : category === 'C1' ? 'C1' : null
  if (!vehicleCategory) throw new Error('Phiếu cũ chưa có hạng xe hợp lệ để dựng ảnh.')
  const rawType = readText(data, ['trainingType']) || record.trainingType
  const trainingType: TrainingType | null = rawType === 'EXAM' || rawType === 'COURSE' ? 'COURSE' : rawType === 'BASIC' || rawType === 'ROAD' ? rawType : null
  if (!trainingType) throw new Error('Phiếu cũ chưa có loại đánh giá hợp lệ để dựng ảnh.')
  const configs = createLessonEvaluations(vehicleCategory)
  const parseLesson = (value: unknown, index: number, emergency = false): LessonEvaluation => {
    const item = asObject(value) || {}
    const base = emergency ? createEmergencyEvaluation() : configs.find((lesson) => lesson.id === item.id) || configs[index] || configs[0]
    const rawStatus = preferredText(item, 'status', ['rating', 'result'])
    return { ...base, id: readText(item, ['id']) || base.id, order: Number(item.order) || index + 1, name: readText(item, ['name', 'title']) || base.name,
      shortName: readText(item, ['shortName']) || base.shortName, focus: Array.isArray(item.focus) ? stringArray(item.focus) : base.focus,
      errors: Array.isArray(item.errors) ? stringArray(item.errors) : base.errors, seriousErrors: Array.isArray(item.seriousErrors) ? stringArray(item.seriousErrors) : base.seriousErrors,
      status: Object.prototype.hasOwnProperty.call(STATUS_META, rawStatus) ? rawStatus as LessonEvaluation['status'] : null,
      selectedErrors: stringArray(item.selectedErrors), note: preferredText(item, 'note', ['comment']) }
  }
  const rawConclusion = readText(data, ['finalConclusion']) || record.overallResult || ''
  const rawOverall = readText(data, ['checklistOverall']) || record.overallResult || ''
  const checklistRatings = ['UNDERSTOOD', 'NEEDS_WORK', 'UNCLEAR', 'GOOD', 'FAIR', 'AVERAGE', 'WEAK']
  return {
    vehicleCategory, trainingType, studentName: readText(data, ['studentName']) || record.studentName,
    evaluationDate: readText(data, ['evaluationDate']) || record.evaluationDate, instructorName: readText(data, ['instructorName']) || record.teacherName,
    vehicleNumber: readText(data, ['vehicleNumber']) || record.vehicleNumber || '', practiceAttempt: readText(data, ['practiceAttempt']) || record.practiceAttempt || '',
    trainingCourse: readText(data, ['trainingCourse']) || record.trainingCourse || '', teacherComment: readText(data, ['teacherComment']) || record.teacherComment || '',
    lessons: Array.isArray(data.lessons) ? data.lessons.map((lesson, index) => parseLesson(lesson, index)) : [],
    emergencyEvaluation: asObject(data.emergencyEvaluation) ? parseLesson(data.emergencyEvaluation, 0, true) : null,
    checklistItems: Array.isArray(data.checklistItems) ? data.checklistItems.map((value, index) => {
      const item = asObject(value) || {}
      const rating = preferredText(item, 'rating', ['status', 'result'])
      return { id: readText(item, ['id']) || `item-${index}`, order: Number(item.order) || index + 1, title: readText(item, ['title', 'name']) || `Nội dung ${index + 1}`, description: readText(item, ['description']) || undefined,
        rating: checklistRatings.includes(rating) ? rating as EvaluationState['checklistItems'][number]['rating'] : null }
    }) : [],
    finalConclusion: Object.prototype.hasOwnProperty.call(CONCLUSION_META, rawConclusion) ? rawConclusion as EvaluationState['finalConclusion'] : null,
    checklistOverall: ['BASIC_UNDERSTOOD', 'BASIC_NEEDS_WORK', 'BASIC_PRACTICE', 'ROAD_PASSED', 'ROAD_NOT_PASSED'].includes(rawOverall) ? rawOverall as EvaluationState['checklistOverall'] : null,
  }
}

function hasReportDetails(state: EvaluationState | null): state is EvaluationState {
  return Boolean(state && (state.lessons.length || state.emergencyEvaluation || state.checklistItems.length))
}

function detailItems(record: EvaluationAdminRecord) {
  const data = asObject(record.evaluationData)
  if (!data) return []
  const rawTrainingType = readText(data, ['trainingType'])
  const lessons = record.trainingType === 'EXAM' || rawTrainingType === 'COURSE' || rawTrainingType === 'EXAM'
  const values: unknown[] = Array.isArray(lessons ? data.lessons : data.checklistItems) ? (lessons ? data.lessons : data.checklistItems) as unknown[] : []
  const emergency = asObject(data.emergencyEvaluation)
  return [...values, ...(lessons && emergency ? [{ ...emergency, name: 'Xử lý tình huống khẩn cấp' }] : [])].map((value, index) => {
    const item = asObject(value) || {}
    return { order: readText(item, ['order', 'number']) || String(index + 1), title: readText(item, ['title', 'name', 'label']) || `Nội dung ${index + 1}`,
      details: [...stringArray(item.selectedErrors), preferredText(item, 'note', ['description', 'comment', 'detail'])].filter(Boolean).join(' • '),
      result: resultLabel(preferredText(item, lessons ? 'status' : 'rating', [lessons ? 'rating' : 'status', 'result', 'evaluation', 'level', 'conclusion'])) }
  })
}

const nextPaint = () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))

export default function AdminTeachersPage() {
  const [view, setView] = useState<AdminView>('overview')
  const [records, setRecords] = useState<EvaluationAdminRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [recordsError, setRecordsError] = useState('')
  const [subscriptionVersion, setSubscriptionVersion] = useState(0)
  const [recordView, setRecordView] = useState<RecordView>('records')
  const [teacherSearch, setTeacherSearch] = useState('')
  const [studentSearch, setStudentSearch] = useState('')
  const [courseSearch, setCourseSearch] = useState('')
  const [trainingFilter, setTrainingFilter] = useState('ALL')
  const [vehicleFilter, setVehicleFilter] = useState('ALL')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [sortMode, setSortMode] = useState('NEWEST')
  const [selectedRecordId, setSelectedRecordId] = useState('')
  const [selectedTeacherKey, setSelectedTeacherKey] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<EvaluationAdminRecord | null>(null)
  const [editTarget, setEditTarget] = useState<{ record: EvaluationAdminRecord; details: EvaluationState | null } | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const [message, setMessage] = useState('')
  const [exportError, setExportError] = useState('')
  const [exportingId, setExportingId] = useState('')
  const [exportState, setExportState] = useState<EvaluationState | null>(null)
  const [reportImage, setReportImage] = useState<ReportImage | null>(null)
  const photoDevice = getPhotoDevice()
  const reportRef = useRef<HTMLDivElement>(null)
  const exportLock = useRef(false)

  useEffect(() => {
    setLoading(true)
    setRecordsError('')
    return subscribeEvaluationAdminRecords((next) => { setRecords(next); setLoading(false); setRecordsError('') }, (error) => { setRecordsError(describeError(error)); setLoading(false) })
  }, [subscriptionVersion])

  useEffect(() => {
    if (!selectedRecordId && !selectedTeacherKey) return
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const modal = document.querySelector<HTMLElement>('.admin-modal-overlay .admin-detail-modal')
    modal?.querySelector<HTMLButtonElement>('button')?.focus()
    const handleKey = (event: KeyboardEvent) => {
      if (document.querySelector('dialog[open]')) return
      if (event.key === 'Escape') { setSelectedRecordId(''); setSelectedTeacherKey('') }
      if (event.key !== 'Tab' || !modal) return
      const focusable = [...modal.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), [tabindex="0"]')]
        .filter((element) => element.getClientRects().length > 0)
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
    }
    document.addEventListener('keydown', handleKey)
    return () => { document.removeEventListener('keydown', handleKey); if (previousFocus?.isConnected) previousFocus.focus() }
  }, [selectedRecordId, selectedTeacherKey])

  const refresh = () => setSubscriptionVersion((current) => current + 1)
  const selectedRecord = records.find((record) => record.id === selectedRecordId)
  const vehicleOptions = [...new Set(records.map((record) => categoryLabel(record.vehicleCategory)))].sort()
  const invalidDateRange = Boolean(startDate && endDate && startDate > endDate)
  const filteredRecords = useMemo(() => records.filter((record) => {
    const date = parseDate(record.evaluationDate || record.createdAt)
    const value = Number.isNaN(date.getTime()) ? '' : localDate(date)
    return !invalidDateRange && normalize(record.teacherName).includes(normalize(teacherSearch)) && normalize(record.studentName).includes(normalize(studentSearch))
      && normalize(record.trainingCourse || '').includes(normalize(courseSearch)) && (trainingFilter === 'ALL' || record.trainingType === trainingFilter)
      && (vehicleFilter === 'ALL' || categoryLabel(record.vehicleCategory) === vehicleFilter) && (!startDate || Boolean(value && value >= startDate)) && (!endDate || Boolean(value && value <= endDate))
  }).sort((left, right) => {
    if (sortMode.startsWith('TEACHER')) return left.teacherName.localeCompare(right.teacherName, 'vi-VN') * (sortMode.endsWith('DESC') ? -1 : 1)
    if (sortMode.startsWith('STUDENT')) return left.studentName.localeCompare(right.studentName, 'vi-VN') * (sortMode.endsWith('DESC') ? -1 : 1)
    return (parseDate(right.createdAt).getTime() - parseDate(left.createdAt).getTime()) * (sortMode === 'OLDEST' ? -1 : 1)
  }), [records, teacherSearch, studentSearch, courseSearch, trainingFilter, vehicleFilter, startDate, endDate, sortMode, invalidDateRange])

  const teacherSummaries = useMemo(() => {
    const groups = new Map<string, EvaluationAdminRecord[]>()
    filteredRecords.forEach((record) => { const key = normalize(record.teacherName) || '__unassigned__'; groups.set(key, [...(groups.get(key) || []), record]) })
    return [...groups].map(([key, items]) => ({ key, name: items[0].teacherName || 'Chưa ghi tên', records: items, students: new Set(items.map((item) => normalize(item.studentName))).size }))
      .sort((left, right) => right.records.length - left.records.length)
  }, [filteredRecords])
  const selectedTeacher = selectedTeacherKey ? teacherSummaries.find((teacher) => teacher.key === selectedTeacherKey) : undefined
  const totalTeachers = new Set(records.map((record) => normalize(record.teacherName)).filter(Boolean)).size
  const totalStudents = new Set(records.map((record) => normalize(record.studentName)).filter(Boolean)).size
  const totalToday = records.filter((record) => { const date = parseDate(record.createdAt); return !Number.isNaN(date.getTime()) && localDate(date) === getTodayInputValue() }).length
  const latestRecords = [...records].sort((left, right) => parseDate(right.createdAt).getTime() - parseDate(left.createdAt).getTime()).slice(0, 5)
  const hasFilters = teacherSearch || studentSearch || courseSearch || trainingFilter !== 'ALL' || vehicleFilter !== 'ALL' || startDate || endDate

  const clearFilters = () => { setTeacherSearch(''); setStudentSearch(''); setCourseSearch(''); setTrainingFilter('ALL'); setVehicleFilter('ALL'); setStartDate(''); setEndDate(''); setSortMode('NEWEST') }
  const setDatePreset = (preset: string) => {
    const today = new Date()
    if (preset === 'ALL') { setStartDate(''); setEndDate(''); return }
    const start = new Date(today)
    if (preset === 'SEVEN_DAYS') start.setDate(start.getDate() - 6)
    if (preset === 'THIS_MONTH') start.setDate(1)
    setStartDate(localDate(start)); setEndDate(localDate(today))
  }
  const requestDelete = (record: EvaluationAdminRecord) => { setDeleteError(''); setDeleteTarget(record) }
  const requestEdit = (record: EvaluationAdminRecord) => {
    let details: EvaluationState | null = null
    try { details = historicalState(record) } catch { /* Older records can still be edited from their summary fields. */ }
    setEditTarget({ record, details })
  }
  const confirmDelete = async () => {
    if (!deleteTarget || deleting) return
    setDeleting(true); setDeleteError('')
    try {
      await deleteEvaluationAdminRecord(deleteTarget.id)
      if (selectedRecordId === deleteTarget.id) setSelectedRecordId('')
      setDeleteTarget(null)
      setMessage('Đã xóa phiếu đánh giá khỏi hệ thống.')
    } catch (error) { setDeleteError(describeError(error)) }
    finally { setDeleting(false) }
  }

  const downloadHistoricalReport = async (record: EvaluationAdminRecord) => {
    if (exportLock.current) return
    exportLock.current = true
    setExportingId(record.id); setExportError('')
    const deliver = (blob: Blob, filename: string, original = false) => {
      if (photoDevice) setReportImage({ blob, filename, studentName: record.studentName, original })
      else {
        saveBlob(blob, filename)
        setMessage(original ? `Đã tải ảnh gốc trước khi sửa của ${record.studentName}.` : `Đã tạo ảnh phiếu của ${record.studentName}.`)
      }
    }
    try {
      let state: EvaluationState | null = null
      if (record.updatedBy) {
        try { state = historicalState(record) } catch { /* A legacy record may only have an original image. */ }
      }
      if (record.reportImageUrl && !hasReportDetails(state)) {
        const controller = new AbortController()
        const timeout = window.setTimeout(() => controller.abort(), 10_000)
        try {
          const response = await fetch(record.reportImageUrl, { signal: controller.signal })
          if (response.ok) {
            const original = await response.blob()
            const signature = new Uint8Array(await original.slice(0, 8).arrayBuffer())
            if ([137, 80, 78, 71, 13, 10, 26, 10].every((byte, index) => signature[index] === byte)) {
              const filename = `phieu-${normalize(record.studentName).replace(/[^a-z0-9]+/g, '-') || 'hoc-vien'}-${record.evaluationDate || 'cu'}.png`
              const isOriginal = Boolean(record.updatedBy)
              deliver(original, isOriginal ? `ban-goc-${filename}` : filename, isOriginal)
              return
            }
          }
        } catch { /* Dựng lại từ nội dung đã lưu khi ảnh gốc không còn truy cập được. */ }
        finally { window.clearTimeout(timeout) }
      }
      state ??= historicalState(record)
      if (!hasReportDetails(state)) throw new Error('Phiếu cũ chưa lưu nội dung chi tiết để dựng lại ảnh PNG.')
      setExportState(state)
      await nextPaint()
      await document.fonts.ready
      const node = reportRef.current
      if (!node) throw new Error('Chưa dựng được nội dung phiếu. Vui lòng thử lại.')
      await Promise.all([...node.querySelectorAll('img')].map((image) => image.decode().catch(() => undefined)))
      node.classList.add('report-export-flat')
      await nextPaint()
      let blob: Blob | null = null
      let lastError: unknown
      for (const pixelRatio of getExportPixelRatios(node.offsetWidth, node.offsetHeight)) {
        let canvas: HTMLCanvasElement | null = null
        try {
          canvas = await toCanvas(node, { pixelRatio, backgroundColor: '#f8fbf9', skipAutoScale: true, imagePlaceholder: PHU_GIAO_LOGO_DATA_URL, cacheBust: true, style: { transform: 'none', position: 'static', margin: '0' } })
          const logo = new Image()
          logo.src = PHU_GIAO_LOGO_DATA_URL
          await logo.decode()
          const context = canvas.getContext('2d')
          if (context) {
            const rect = node.getBoundingClientRect()
            const scaleX = canvas.width / node.offsetWidth
            const scaleY = canvas.height / node.offsetHeight
            node.querySelectorAll<HTMLElement>('[data-export-logo-slot]').forEach((slot) => {
              const bounds = slot.getBoundingClientRect()
              const x = (bounds.left - rect.left) * scaleX; const y = (bounds.top - rect.top) * scaleY
              const width = bounds.width * scaleX; const height = bounds.height * scaleY
              const scale = Math.min(width / logo.naturalWidth, height / logo.naturalHeight)
              context.save(); context.beginPath(); context.ellipse(x + width / 2, y + height / 2, width / 2, height / 2, 0, 0, Math.PI * 2); context.clip()
              context.drawImage(logo, x + (width - logo.naturalWidth * scale) / 2, y + (height - logo.naturalHeight * scale) / 2, logo.naturalWidth * scale, logo.naturalHeight * scale); context.restore()
            })
          }
          blob = await canvasToPngBlob(canvas)
          break
        } catch (error) { lastError = error }
        finally { if (canvas) { canvas.width = 1; canvas.height = 1 } }
      }
      if (!blob) throw lastError || new Error('Chưa thể tạo ảnh PNG.')
      deliver(blob, generateFileName(state))
    } catch (error) { setExportError(describeExportError(error)) }
    finally { setExportState(null); setExportingId(''); exportLock.current = false }
  }

  const rowActions = (record: EvaluationAdminRecord) => <div className="admin-row-actions">
    <button type="button" aria-label={`Xem chi tiết phiếu của ${record.studentName}`} title="Xem chi tiết" onClick={() => setSelectedRecordId(record.id)}><Eye size={17} /></button>
    <button type="button" aria-label={`Sửa phiếu của ${record.studentName}`} title="Sửa phiếu" onClick={() => requestEdit(record)}><Pencil size={17} /></button>
    <button type="button" className="admin-export-row-action" aria-label={`Tải lại ảnh phiếu của ${record.studentName}`} title="Tải lại ảnh" disabled={Boolean(exportingId)} onClick={() => { void downloadHistoricalReport(record) }}>{exportingId === record.id ? <LoaderCircle size={17} className="admin-spin" /> : <Download size={17} />}</button>
    <button type="button" className="is-danger" aria-label={`Xóa phiếu của ${record.studentName}`} title="Xóa phiếu" disabled={deleting} onClick={() => requestDelete(record)}><Trash2 size={17} /></button>
  </div>

  const recordTable = (items: EvaluationAdminRecord[]) => <div className="admin-table-scroll"><table className="admin-table admin-record-table" role="table">
    <thead><tr><th>Học viên</th><th>Giáo viên</th><th>Nội dung</th><th>Hạng / xe</th><th>Ngày đánh giá</th><th>Kết quả</th><th><span className="admin-visually-hidden">Thao tác</span></th></tr></thead>
    <tbody>{items.map((record) => <tr key={record.id}>
      <td><button className="admin-student-link" type="button" onClick={() => setSelectedRecordId(record.id)}>{record.studentName || 'Chưa ghi tên'}</button><small>{record.trainingCourse || 'Chưa ghi khóa học'}</small></td>
      <td><span className="admin-record-field" aria-hidden="true">Giáo viên</span>{record.teacherName || '—'}</td>
      <td><span className={`admin-type admin-type--${record.trainingType.toLowerCase()}`}>{trainingLabel(record.trainingType)}</span></td>
      <td><span className="admin-record-field" aria-hidden="true">Hạng xe</span><strong className="admin-category">{categoryLabel(record.vehicleCategory)}</strong><small>{record.vehicleNumber || 'Chưa chọn xe'}</small></td>
      <td><span className="admin-record-field" aria-hidden="true">Ngày đánh giá</span>{dateLabel(record.evaluationDate)}</td>
      <td><span className="admin-record-field" aria-hidden="true">Kết quả</span><span className="admin-result">{resultLabel(record.overallResult)}</span></td><td>{rowActions(record)}</td>
    </tr>)}</tbody>
  </table></div>

  return (
    <div className="admin-dashboard">
      <aside className="admin-sidebar">
        <a href="/" className="admin-sidebar-brand" aria-label="Phú Giáo — về trang tạo phiếu"><TrainingCenterBrand compact /></a>
        <span className="admin-sidebar-caption">KHÔNG GIAN QUẢN TRỊ</span>
        <nav aria-label="Điều hướng quản trị">
          {([{ id: 'overview', label: 'Tổng quan', icon: LayoutDashboard }, { id: 'records', label: 'Phiếu đánh giá', icon: ClipboardList }, { id: 'directory', label: 'Giáo viên & xe', icon: Users }] as const).map((item) => <button key={item.id} type="button" aria-current={view === item.id ? 'page' : undefined} onClick={() => setView(item.id)}><item.icon size={20} /><span>{item.label}</span>{view === item.id && <ChevronRight size={15} />}</button>)}
        </nav>
        <div className="admin-sidebar-footer"><span className="admin-sidebar-seal"><Check size={21} /></span><strong>Đồng hành cùng<br />từng tay lái.</strong><p>Trung tâm Giáo dục nghề nghiệp Phú Giáo</p><a href="/">Tạo phiếu mới <ArrowRight size={15} /></a></div>
      </aside>

      <main className="admin-main">
        <header className="admin-topbar"><div><span>Phú Giáo</span><ChevronRight size={14} /><strong>{view === 'overview' ? 'Tổng quan' : view === 'records' ? 'Phiếu đánh giá' : 'Giáo viên & xe'}</strong></div><span className={`admin-live ${recordsError ? 'has-error' : ''}`}><i />{loading ? 'Đang đồng bộ' : recordsError ? 'Kết nối gián đoạn' : 'Cập nhật trực tiếp'}</span></header>
        <div className="admin-workspace">
          <section className="admin-page-heading">
            <div><span className="admin-eyebrow">QUẢN LÝ ĐÀO TẠO</span><h1>{view === 'overview' ? 'Chào một ngày hiệu quả.' : view === 'records' ? 'Mỗi buổi học, một bước tiến.' : 'Đội ngũ vững. Hành trình tốt.'}</h1><p>{view === 'overview' ? 'Theo dõi hoạt động đánh giá và kết nối mọi thông tin đào tạo tại một nơi.' : view === 'records' ? 'Tìm kiếm, xem lại và quản lý phiếu đánh giá của trung tâm.' : 'Quản lý giáo viên cùng phương tiện đào tạo theo từng hạng xe.'}</p></div>
            {view !== 'directory' && <div className="admin-heading-actions"><button type="button" className="admin-button" disabled={loading} onClick={refresh}><RefreshCw size={16} className={loading ? 'admin-spin' : ''} />Làm mới</button><button type="button" className="admin-button is-primary" disabled={!filteredRecords.length} onClick={() => exportCsv(filteredRecords)}><ArrowDownToLine size={17} />Xuất CSV</button></div>}
          </section>
          {message && <div className="admin-notice is-success" role="status"><Check size={18} /><span>{message}</span><button type="button" aria-label="Đóng thông báo" onClick={() => setMessage('')}><X size={16} /></button></div>}
          {recordsError && view !== 'directory' && <div className="admin-notice is-error" role="alert"><span>{recordsError}</span><button type="button" onClick={refresh}>Thử lại</button></div>}
          {exportError && <div className="admin-notice is-error" role="alert"><span>{exportError}</span><button type="button" aria-label="Đóng lỗi xuất ảnh" onClick={() => setExportError('')}><X size={16} /></button></div>}

          {view === 'directory' ? <AdminTrainingDirectory /> : <>
            <section className="admin-stats" aria-label="Thống kê đánh giá">
              {([{ label: 'Tổng phiếu đánh giá', value: records.length, icon: FileText, note: 'Đã lưu tại trung tâm' }, { label: 'Giáo viên', value: totalTeachers, icon: Users, note: 'Đã thực hiện đánh giá' }, { label: 'Học viên', value: totalStudents, icon: CarFront, note: 'Theo tên trong phiếu' }, { label: 'Phiếu hôm nay', value: totalToday, icon: CalendarDays, note: dateLabel(getTodayInputValue()) }]).map((stat) => <article key={stat.label}><div className="admin-stat-top"><span>{stat.label}</span><i><stat.icon size={19} /></i></div><strong>{loading && !records.length ? '—' : stat.value.toLocaleString('vi-VN')}</strong><small>{stat.note}</small></article>)}
            </section>

            {view === 'overview' && <section className="admin-overview-grid">
              <div className="admin-card admin-overview-recent"><div className="admin-card-heading"><div><span className="admin-eyebrow">HOẠT ĐỘNG GẦN ĐÂY</span><h2>Những phiếu mới nhất</h2></div><button type="button" className="admin-text-button" onClick={() => setView('records')}>Xem tất cả <ArrowRight size={16} /></button></div>{latestRecords.length ? recordTable(latestRecords) : <div className="admin-empty"><ClipboardList size={32} /><h3>{loading ? 'Đang tải phiếu đánh giá' : 'Chưa có phiếu đánh giá'}</h3><p>Những buổi học đã đánh giá sẽ xuất hiện tại đây.</p></div>}</div>
              <div className="admin-card admin-training-breakdown"><div className="admin-card-heading"><div><span className="admin-eyebrow">NỘI DUNG ĐÀO TẠO</span><h2>Cùng nhìn tiến độ</h2></div><Activity size={21} /></div><div className="admin-breakdown-total"><strong>{records.length}</strong><span>phiếu đã đánh giá</span></div>{['BASIC', 'EXAM', 'ROAD'].map((type) => { const count = records.filter((record) => record.trainingType === type).length; return <div className="admin-breakdown-item" key={type}><div><span>{trainingLabel(type)}</span><strong>{count}</strong></div><div className="admin-progress"><i style={{ width: `${records.length ? count / records.length * 100 : 0}%` }} /></div></div> })}<p className="admin-breakdown-note">Ghi nhận từng buổi học để theo dõi hành trình luyện tập.</p></div>
            </section>}

            {view === 'records' && <>
              <section className="admin-card admin-filters" aria-label="Bộ lọc phiếu đánh giá"><div className="admin-card-heading"><div><SlidersHorizontal size={18} /><h2>Tìm đúng phiếu bạn cần</h2></div>{hasFilters && <button className="admin-text-button" type="button" onClick={clearFilters}>Xóa bộ lọc</button>}</div>
                <div className="admin-filter-grid">
                  <label><span>Tìm giáo viên</span><div className="admin-input-icon"><Search size={16} /><input type="search" value={teacherSearch} onChange={(event) => setTeacherSearch(event.target.value)} placeholder="Tên giáo viên" /></div></label>
                  <label><span>Tìm học viên</span><div className="admin-input-icon"><Search size={16} /><input type="search" value={studentSearch} onChange={(event) => setStudentSearch(event.target.value)} placeholder="Tên học viên" /></div></label>
                  <label><span>Tìm khóa học</span><input type="search" value={courseSearch} onChange={(event) => setCourseSearch(event.target.value)} placeholder="Tên hoặc mã khóa" /></label>
                  <label><span>Loại đánh giá</span><select aria-label="Loại đánh giá" value={trainingFilter} onChange={(event) => setTrainingFilter(event.target.value)}><option value="ALL">Tất cả nội dung</option>{['BASIC', 'EXAM', 'ROAD', 'UNKNOWN'].map((type) => <option key={type} value={type}>{trainingLabel(type)}</option>)}</select></label>
                  <label><span>Hạng xe</span><select aria-label="Hạng xe" value={vehicleFilter} onChange={(event) => setVehicleFilter(event.target.value)}><option value="ALL">Tất cả hạng xe</option>{vehicleOptions.map((category) => <option key={category}>{category}</option>)}</select></label>
                  <label><span>Từ ngày</span><input type="date" aria-label="Từ ngày" value={startDate} onChange={(event) => setStartDate(event.target.value)} /></label>
                  <label><span>Đến ngày</span><input type="date" aria-label="Đến ngày" value={endDate} onChange={(event) => setEndDate(event.target.value)} /></label>
                  <label><span>Sắp xếp</span><select aria-label="Sắp xếp" value={sortMode} onChange={(event) => setSortMode(event.target.value)}><option value="NEWEST">Mới nhất trước</option><option value="OLDEST">Cũ nhất trước</option><option value="TEACHER_ASC">Giáo viên A–Z</option><option value="TEACHER_DESC">Giáo viên Z–A</option><option value="STUDENT_ASC">Học viên A–Z</option><option value="STUDENT_DESC">Học viên Z–A</option></select></label>
                </div><div className="admin-date-presets"><span>Khoảng thời gian</span>{[{ id: 'ALL', label: 'Tất cả' }, { id: 'TODAY', label: 'Hôm nay' }, { id: 'SEVEN_DAYS', label: '7 ngày gần nhất' }, { id: 'THIS_MONTH', label: 'Tháng này' }].map((preset) => <button type="button" key={preset.id} onClick={() => setDatePreset(preset.id)}>{preset.label}</button>)}</div>{invalidDateRange && <p className="admin-field-error" role="alert">Ngày bắt đầu cần trước hoặc bằng ngày kết thúc.</p>}
              </section>
              <section className="admin-card admin-records-card"><div className="admin-card-heading"><div><h2>{filteredRecords.length} phiếu đánh giá</h2><span className="admin-muted">trong tổng số {records.length} phiếu</span></div><div className="admin-segmented" aria-label="Cách xem phiếu"><button type="button" aria-pressed={recordView === 'records'} onClick={() => setRecordView('records')}>Danh sách phiếu</button><button type="button" aria-pressed={recordView === 'teachers'} onClick={() => setRecordView('teachers')}>Theo giáo viên</button></div></div>
                {loading && !records.length ? <div className="admin-empty" role="status"><LoaderCircle className="admin-spin" size={30} /><h3>Đang tải dữ liệu</h3></div> : !filteredRecords.length ? <div className="admin-empty"><Search size={30} /><h3>Chưa tìm thấy phiếu phù hợp</h3><p>Thử thay đổi tên, nội dung hoặc khoảng ngày.</p><button className="admin-button" type="button" onClick={clearFilters}>Đặt lại bộ lọc</button></div> : recordView === 'records' ? recordTable(filteredRecords) : <div className="admin-teacher-grid">{teacherSummaries.map((teacher) => <button className="admin-teacher-summary" key={teacher.key} type="button" onClick={() => setSelectedTeacherKey(teacher.key)}><span className="admin-avatar">{teacher.name.charAt(0)}</span><strong>{teacher.name}</strong><span>{teacher.records.length} phiếu · {teacher.students} học viên</span><ChevronRight size={17} /></button>)}</div>}
              </section>
            </>}
          </>}
          <footer className="admin-workspace-footer"><span>PHÚ GIÁO</span><p>Chất lượng từ những điều tận tâm.</p><span>Quản lý đào tạo</span></footer>
        </div>
      </main>

      {selectedTeacher && !selectedRecord && <div className="admin-modal-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedTeacherKey('') }}><section className="admin-detail-modal" role="dialog" aria-modal="true" aria-label={`Phiếu của giáo viên ${selectedTeacher.name}`}><header><div><span className="admin-eyebrow">GIÁO VIÊN HƯỚNG DẪN</span><h2>{selectedTeacher.name}</h2><p>{selectedTeacher.records.length} phiếu · {selectedTeacher.students} học viên trong kết quả lọc</p></div><button type="button" className="admin-icon-button" aria-label="Đóng danh sách giáo viên" onClick={() => setSelectedTeacherKey('')}><X size={21} /></button></header>{recordTable(selectedTeacher.records)}</section></div>}
      {selectedRecord && <div className="admin-modal-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedRecordId('') }}><section className="admin-detail-modal" role="dialog" aria-modal="true" aria-label={`Chi tiết phiếu của học viên ${selectedRecord.studentName}`}>
        <header><div><span className="admin-eyebrow">CHI TIẾT PHIẾU ĐÁNH GIÁ</span><h2>{selectedRecord.studentName}</h2><p>{trainingLabel(selectedRecord.trainingType)} · {categoryLabel(selectedRecord.vehicleCategory)} · {dateLabel(selectedRecord.evaluationDate)}</p></div><button className="admin-icon-button" type="button" aria-label="Đóng chi tiết" onClick={() => setSelectedRecordId('')}><X size={21} /></button></header>
        <div className="admin-detail-body"><div className="admin-detail-meta">{[['Giáo viên', selectedRecord.teacherName], ['Biển số xe', selectedRecord.vehicleNumber], ['Khóa học', selectedRecord.trainingCourse], ['Lần tập', selectedRecord.practiceAttempt], ['Thời gian tạo', dateLabel(selectedRecord.createdAt, true)], ['Cập nhật', dateLabel(selectedRecord.updatedAt, true)]].map(([label, value]) => <div key={label}><small>{label}</small><strong>{value || 'Chưa ghi'}</strong></div>)}</div><div className="admin-detail-conclusion"><span>Kết quả chung</span><strong>{resultLabel(selectedRecord.overallResult)}</strong><p>{selectedRecord.teacherComment || 'Giáo viên chưa ghi nhận xét thêm.'}</p></div><h3>Nội dung đánh giá chi tiết</h3>{detailItems(selectedRecord).length ? <div className="admin-table-scroll"><table className="admin-table admin-detail-table"><thead><tr><th>Mục</th><th>Nội dung</th><th>Kết quả</th><th>Lỗi & ghi chú</th></tr></thead><tbody>{detailItems(selectedRecord).map((item, index) => <tr key={index}><td>{item.order}</td><td><strong>{item.title}</strong></td><td>{item.result}</td><td>{item.details || '—'}</td></tr>)}</tbody></table></div> : <p className="admin-empty-note">Phiếu cũ chưa lưu nội dung đánh giá chi tiết.</p>}<p className="admin-record-id">Mã phiếu: {selectedRecord.id}</p></div>
        <footer>
          <button className="admin-button is-danger" type="button" disabled={deleting} onClick={() => requestDelete(selectedRecord)}><Trash2 size={16} />Xóa phiếu</button>
          <button className="admin-button" type="button" onClick={() => requestEdit(selectedRecord)}><Pencil size={16} />Sửa phiếu</button>
          <button className="admin-button is-primary" type="button" disabled={Boolean(exportingId)} onClick={() => { void downloadHistoricalReport(selectedRecord) }}>{exportingId === selectedRecord.id ? <LoaderCircle className="admin-spin" size={17} /> : <Download size={17} />}{exportingId === selectedRecord.id ? 'Đang tạo ảnh...' : photoDevice ? 'Lưu ảnh' : 'Tải ảnh PNG'}</button>
        </footer>
      </section></div>}
      {editTarget && <AdminEvaluationEditDialog key={editTarget.record.id} {...editTarget} describeError={describeError}
        onClose={() => setEditTarget(null)} onSave={async (input) => {
          await updateEvaluationAdminRecord(editTarget.record, input)
          setMessage('Đã cập nhật phiếu đánh giá.')
        }} />}
      {reportImage && photoDevice && <ReportImageDialog image={reportImage} device={photoDevice} onClose={() => setReportImage(null)} />}
      <ConfirmDialog open={Boolean(deleteTarget)} title="Xóa phiếu đánh giá?" description={`Phiếu của ${deleteTarget?.studentName || 'học viên'} sẽ được xóa vĩnh viễn khỏi hệ thống.`} confirmLabel="Xóa phiếu" busy={deleting} error={deleteError} onCancel={() => { if (!deleting) setDeleteTarget(null) }} onConfirm={() => { void confirmDelete() }} />
      <div className="admin-print-host" aria-hidden="true">{exportState && (exportState.trainingType === 'COURSE' ? <EvaluationReport state={exportState} reportRef={reportRef} /> : <ChecklistReport state={exportState} reportRef={reportRef} />)}</div>
    </div>
  )
}
