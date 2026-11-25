import { useEffect, useId, useRef, useState } from 'react'
import { ChevronDown, LoaderCircle, Save, X } from 'lucide-react'
import { getChecklistOverallOptions, getChecklistRatingOptions } from '../data/checklistConfigs'
import type { EditEvaluationAdminInput, EvaluationAdminRecord } from '../services/evaluationAdminStore'
import type { EvaluationState, LessonEvaluation, EvaluationStatus } from '../types/evaluation'
import { CONCLUSION_META, COURSE_CONCLUSIONS, STATUS_META } from '../utils/evaluation'

interface Props {
  record: EvaluationAdminRecord
  details: EvaluationState | null
  onClose: () => void
  onSave: (input: EditEvaluationAdminInput) => Promise<void>
  describeError: (error: unknown) => string
}

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function fieldsFor(record: EvaluationAdminRecord, details: EvaluationState | null): EditEvaluationAdminInput {
  const attempt = record.practiceAttempt || details?.practiceAttempt || ''
  return {
    teacherName: record.teacherName || details?.instructorName || '',
    studentName: record.studentName || details?.studentName || '',
    evaluationDate: (record.evaluationDate || details?.evaluationDate || '').slice(0, 10),
    vehicleNumber: record.vehicleNumber || details?.vehicleNumber || '',
    trainingCourse: record.trainingCourse || details?.trainingCourse || '',
    teacherComment: record.teacherComment || details?.teacherComment || '',
    practiceAttempt: /^(?:[1-9]|10)$/.test(attempt) ? attempt : '',
    overallResult: record.overallResult || details?.finalConclusion || details?.checklistOverall || null,
  }
}

function updatedDetails(record: EvaluationAdminRecord, initial: EvaluationState | null, state: EvaluationState | null, fields: EditEvaluationAdminInput) {
  const data = object(record.evaluationData)
  if (!state || !initial) return undefined

  const evaluationData: Record<string, unknown> = {
    ...data,
    instructorName: fields.teacherName, studentName: fields.studentName, evaluationDate: fields.evaluationDate,
    vehicleNumber: fields.vehicleNumber, practiceAttempt: fields.practiceAttempt,
    trainingCourse: fields.trainingCourse, teacherComment: fields.teacherComment,
  }
  if (state.trainingType === 'COURSE') {
    evaluationData.finalConclusion = fields.overallResult
    if (state.lessons !== initial.lessons && Array.isArray(data.lessons)) {
      const original = data.lessons
      evaluationData.lessons = state.lessons.map((lesson, index) => lesson === initial.lessons[index]
        ? original[index] : { ...object(original[index]), status: lesson.status, selectedErrors: lesson.selectedErrors, note: lesson.note.trim() })
    }
    if (state.emergencyEvaluation && state.emergencyEvaluation !== initial.emergencyEvaluation) {
      const { status, selectedErrors, note } = state.emergencyEvaluation
      evaluationData.emergencyEvaluation = { ...object(data.emergencyEvaluation), status, selectedErrors, note: note.trim() }
    }
  } else {
    evaluationData.checklistOverall = fields.overallResult
    if (state.checklistItems !== initial.checklistItems && Array.isArray(data.checklistItems)) {
      const original = data.checklistItems
      evaluationData.checklistItems = state.checklistItems.map((item, index) => item === initial.checklistItems[index]
        ? original[index] : { ...object(original[index]), rating: item.rating })
    }
  }
  return evaluationData
}

function LessonFields({ lesson, onChange }: { lesson: LessonEvaluation; onChange: (lesson: LessonEvaluation) => void }) {
  const possibleErrors = [...new Set([...lesson.errors, ...lesson.selectedErrors])]
  return <fieldset className="admin-lesson-fields">
    <legend>{lesson.name}</legend>
    <label><span>Mức đánh giá</span><select aria-label="Mức đánh giá" value={lesson.status ?? ''} onChange={(event) => {
      const status = event.target.value as EvaluationStatus
      onChange({ ...lesson, status: status || null, selectedErrors: status === 'GOOD' ? [] : lesson.selectedErrors })
    }}>
      <option value="">Chưa ghi</option>
      {Object.entries(STATUS_META).map(([id, { label }]) => <option value={id} key={id}>{label}</option>)}
    </select></label>
    {possibleErrors.length > 0 && <div className="admin-lesson-errors">
      {possibleErrors.map((error) => <label key={error}><input type="checkbox" checked={lesson.selectedErrors.includes(error)} onChange={(event) => {
        const checked = event.target.checked
        const selectedErrors = checked ? [...lesson.selectedErrors, error] : lesson.selectedErrors.filter((value) => value !== error)
        onChange({ ...lesson, selectedErrors, status: checked && lesson.status === 'GOOD' ? 'NOTICE' : lesson.status })
      }} />{error}</label>)}
    </div>}
    <label><span>Ghi chú</span><input value={lesson.note} maxLength={140} onChange={(event) => onChange({ ...lesson, note: event.target.value })} /></label>
  </fieldset>
}

export function AdminEvaluationEditDialog({ record, details, onClose, onSave, describeError }: Props) {
  const dialog = useRef<HTMLDialogElement>(null)
  const saving = useRef(false)
  const titleId = useId()
  const [fields, setFields] = useState(() => fieldsFor(record, details))
  const [state, setState] = useState(details)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const hasDetails = Boolean(state && (state.lessons.length || state.emergencyEvaluation || state.checklistItems.length))
  const options = record.trainingType === 'EXAM'
    ? COURSE_CONCLUSIONS.map((id) => ({ id, label: CONCLUSION_META[id].label }))
    : record.trainingType === 'UNKNOWN' ? [] : getChecklistOverallOptions(record.trainingType)

  useEffect(() => {
    const node = dialog.current
    node?.showModal()
    return () => node?.close()
  }, [])

  const change = (key: keyof Omit<EditEvaluationAdminInput, 'evaluationData'>, value: string) =>
    setFields((current) => ({ ...current, [key]: value }))

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (saving.current) return
    saving.current = true
    setBusy(true)
    setError('')
    const clean = (value: string) => value.trim().replace(/\s+/g, ' ')
    const input = {
      ...fields, teacherName: clean(fields.teacherName), studentName: clean(fields.studentName),
      vehicleNumber: clean(fields.vehicleNumber).toUpperCase(), trainingCourse: clean(fields.trainingCourse),
      teacherComment: fields.teacherComment.trim(), overallResult: clean(fields.overallResult ?? '') || null,
    }
    try {
      await onSave({ ...input, evaluationData: updatedDetails(record, details, state, input) })
      onClose()
    } catch (cause) {
      setError(describeError(cause))
    } finally {
      saving.current = false
      setBusy(false)
    }
  }

  return <dialog className="admin-edit-dialog" ref={dialog} aria-labelledby={titleId}
    onCancel={(event) => { event.preventDefault(); if (!busy) onClose() }}>
    <form onSubmit={(event) => { void submit(event) }}>
      <header>
        <div><h2 id={titleId}>Sửa phiếu đánh giá</h2><p>{record.studentName || 'Phiếu học viên'}</p></div>
        <button type="button" className="admin-icon-button" aria-label="Đóng biểu mẫu" disabled={busy} onClick={onClose}><X size={21} /></button>
      </header>
      <div className="admin-edit-body">
        <fieldset className="admin-edit-fields" disabled={busy}>
          <label><span>Họ và tên học viên</span><input required maxLength={160} value={fields.studentName} onChange={(event) => change('studentName', event.target.value)} /></label>
          <label><span>Giáo viên hướng dẫn</span><input required maxLength={120} value={fields.teacherName} onChange={(event) => change('teacherName', event.target.value)} /></label>
          <label><span>Ngày đánh giá</span><input required type="date" value={fields.evaluationDate} onChange={(event) => change('evaluationDate', event.target.value)} /></label>
          <label><span>Biển số xe</span><input maxLength={32} value={fields.vehicleNumber} onChange={(event) => change('vehicleNumber', event.target.value)} /></label>
          <label><span>Lần tập thứ</span><select value={fields.practiceAttempt} onChange={(event) => change('practiceAttempt', event.target.value)}><option value="">Chưa ghi</option>{Array.from({ length: 10 }, (_, index) => <option key={index + 1}>{index + 1}</option>)}</select></label>
          <label><span>Khóa đào tạo</span><input maxLength={120} value={fields.trainingCourse} onChange={(event) => change('trainingCourse', event.target.value)} /></label>
          <label className="admin-edit-wide"><span>Kết quả chung</span>
            {options.length ? <select aria-label="Kết quả chung" value={fields.overallResult ?? ''} onChange={(event) => change('overallResult', event.target.value)}>
              <option value="">Chưa ghi</option>
              {fields.overallResult && !options.some((item) => item.id === fields.overallResult) && <option value={fields.overallResult}>{fields.overallResult}</option>}
              {options.map((item) => <option value={item.id} key={item.id}>{item.label}</option>)}
            </select> : <input maxLength={120} value={fields.overallResult ?? ''} onChange={(event) => change('overallResult', event.target.value)} />}
          </label>
          <label className="admin-edit-wide"><span>Nhận xét của giáo viên</span><textarea aria-label="Nhận xét của giáo viên" rows={3} maxLength={500} value={fields.teacherComment} onChange={(event) => change('teacherComment', event.target.value)} /></label>
        </fieldset>
        {state && hasDetails && <details className="admin-edit-details">
          <summary>Nội dung đánh giá chi tiết <ChevronDown size={17} /></summary>
          <fieldset disabled={busy}>
            {state.lessons.map((lesson, index) => <LessonFields key={`${lesson.id}-${index}`} lesson={lesson} onChange={(next) => {
              setState((current) => current && { ...current, lessons: current.lessons.map((item, i) => i === index ? next : item) })
            }} />)}
            {state.emergencyEvaluation && <LessonFields lesson={state.emergencyEvaluation} onChange={(next) => {
              setState((current) => current && { ...current, emergencyEvaluation: next })
            }} />}
            {state.checklistItems.map((item, index) => <label className="admin-checklist-edit-row" key={`${item.id}-${index}`}>
              <span>{item.order}. {item.title}</span><select value={item.rating ?? ''} onChange={(event) => {
                const rating = (event.target.value || null) as typeof item.rating
                setState((current) => current && { ...current, checklistItems: current.checklistItems.map((entry, i) => i === index ? { ...entry, rating } : entry) })
              }}>
                <option value="">Chưa ghi</option>
                {getChecklistRatingOptions(state.trainingType ?? 'BASIC').map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
              </select>
            </label>)}
          </fieldset>
        </details>}
        {record.reportImageUrl && !hasDetails && <p className="admin-edit-note">Phiếu cũ thiếu nội dung chi tiết để dựng ảnh mới. Ảnh gốc sẽ được lưu để đối chiếu.</p>}
        {error && <div className="admin-notice is-error" role="alert">{error}</div>}
      </div>
      <footer>
        <button type="button" className="admin-button" disabled={busy} onClick={onClose}>Hủy</button>
        <button type="submit" className="admin-button is-primary" disabled={busy}>{busy ? <LoaderCircle size={17} className="admin-spin" /> : <Save size={17} />}{busy ? 'Đang lưu…' : 'Lưu thay đổi'}</button>
      </footer>
    </form>
  </dialog>
}
