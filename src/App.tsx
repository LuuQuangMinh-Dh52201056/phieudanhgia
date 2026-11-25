import { useEffect, useRef, useState } from 'react'
import { LoaderCircle, X } from 'lucide-react'
import { createChecklistItems } from './data/checklistConfigs'
import { createEmergencyEvaluation, createLessonEvaluations } from './data/lessonConfigs'
import { AdminAuthGate } from './components/AdminAuthGate'
import AdminTeachersPage from './pages/AdminTeachersPage'
import { TeacherSelectionPage } from './pages/TeacherSelectionPage'
import { VehicleSelectionPage } from './pages/VehicleSelectionPage'
import { TrainingSelectionPage } from './pages/TrainingSelectionPage'
import { StudentInformationPage } from './pages/StudentInformationPage'
import { EvaluationPage } from './pages/EvaluationPage'
import { ChecklistEvaluationPage } from './pages/ChecklistEvaluationPage'
import { ReportPreviewPage } from './pages/ReportPreviewPage'
import { useTrainingDirectory } from './hooks/useTrainingDirectory'
import { saveEvaluationAdminRecord, type SaveEvaluationAdminInput } from './services/evaluationAdminStore'
import { getBackendErrorCode } from './services/firestoreOperations'
import type { EvaluationState, TrainingType, VehicleCategory } from './types/evaluation'
import { calculateConclusion, getTodayInputValue } from './utils/evaluation'

type Step = 'teacher' | 'vehicle' | 'training' | 'information' | 'evaluation' | 'report'

function emptyEvaluation(): EvaluationState {
  return {
    vehicleCategory: null, trainingType: null, studentName: '', evaluationDate: getTodayInputValue(),
    instructorName: '', vehicleNumber: '', practiceAttempt: '1', trainingCourse: '',
    lessons: [], emergencyEvaluation: null, checklistItems: [], checklistOverall: null,
    teacherComment: '', finalConclusion: null,
  }
}

function isAdminPath(): boolean {
  let pathname = window.location.pathname
  try { pathname = decodeURIComponent(pathname) } catch { /* Keep a malformed path out of admin. */ }
  return ['/admin', '/admin/giaovien/A@7979'].includes(pathname.replace(/\/+$/, ''))
}

export default function App() {
  const [admin, setAdmin] = useState(isAdminPath)
  useEffect(() => {
    const update = () => setAdmin(isAdminPath())
    window.addEventListener('popstate', update)
    return () => window.removeEventListener('popstate', update)
  }, [])
  return admin ? <AdminAuthGate><AdminTeachersPage /></AdminAuthGate> : <EvaluationWorkflow />
}

function EvaluationWorkflow() {
  const directory = useTrainingDirectory()
  const [step, setStep] = useState<Step>('teacher')
  const [state, setState] = useState<EvaluationState>(emptyEvaluation)
  const [teacherId, setTeacherId] = useState('')
  const [vehicleId, setVehicleId] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false)
  const [error, setError] = useState('')
  const savingRef = useRef(false)
  const pendingSave = useRef<SaveEvaluationAdminInput | null>(null)
  const mountedRef = useRef(true)
  const contentRef = useRef<HTMLDivElement>(null)
  const teacher = directory.teachers.find((item) => item.id === teacherId)
  const vehicle = directory.vehicles.find((item) => item.id === vehicleId && item.vehicleCategory === state.vehicleCategory)

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  useEffect(() => {
    if (contentRef.current) contentRef.current.inert = saving
  }, [saving])

  useEffect(() => {
    if (saving || step === 'report' || !teacher) return
    setState((current) => current.instructorName === teacher.name ? current : { ...current, instructorName: teacher.name })
  }, [teacher, saving, step])

  useEffect(() => {
    if (saving || step === 'report' || directory.vehiclesLoading || !vehicleId) return
    if (!vehicle) setVehicleId('')
    setState((current) => current.vehicleNumber === (vehicle?.plateNumber ?? '') ? current : { ...current, vehicleNumber: vehicle?.plateNumber ?? '' })
  }, [vehicle, vehicleId, directory.vehiclesLoading, saving, step])

  const go = (next: Step) => {
    if (savingRef.current) return
    setStep(next)
    setError('')
    window.scrollTo({ top: 0, behavior: 'instant' })
  }

  const update = (updates: Partial<EvaluationState>) => {
    if (savingRef.current) return
    setState((current) => ({ ...current, ...updates, ...(updates.lessons ? { finalConclusion: null } : {}) }))
    setError('')
  }

  const chooseTeacher = (id: string) => {
    setTeacherId(id)
    update({ instructorName: directory.teachers.find((item) => item.id === id)?.name ?? '' })
  }

  const chooseCategory = (category: VehicleCategory) => {
    if (state.vehicleCategory === category) return
    setVehicleId('')
    setState({ ...emptyEvaluation(), vehicleCategory: category, instructorName: teacher?.name ?? '' })
    setError('')
  }

  const chooseVehicle = (id: string) => {
    const selected = directory.vehicles.find((item) => item.id === id && item.vehicleCategory === state.vehicleCategory)
    setVehicleId(selected?.id ?? '')
    update({ vehicleNumber: selected?.plateNumber ?? '' })
  }

  const chooseTraining = (trainingType: TrainingType) => {
    if (!state.vehicleCategory) return
    if (state.trainingType !== trainingType) {
      update({
        trainingType,
        lessons: trainingType === 'COURSE' ? createLessonEvaluations(state.vehicleCategory) : [],
        emergencyEvaluation: trainingType === 'COURSE' ? createEmergencyEvaluation() : null,
        checklistItems: trainingType === 'COURSE' ? [] : createChecklistItems(trainingType, state.vehicleCategory),
        checklistOverall: null, teacherComment: '', finalConclusion: null,
      })
    }
    go('information')
  }

  const validateInformation = (): boolean => {
    if (!teacher) {
      go('teacher')
      setError('Giáo viên đã thay đổi trong danh mục. Vui lòng chọn lại tên giáo viên.')
      return false
    }
    if (!state.studentName.trim()) { setError('Vui lòng nhập họ và tên học viên.'); return false }
    if (!state.evaluationDate) { setError('Vui lòng chọn ngày đánh giá.'); return false }
    if (!/^(?:[1-9]|10)$/.test(state.practiceAttempt)) { setError('Vui lòng chọn lần tập từ 1 đến 10.'); return false }
    return true
  }

  const openReport = () => {
    if (savingRef.current || !validateInformation() || !state.vehicleCategory || !state.trainingType || !teacher) return
    setState({
      ...state,
      studentName: state.studentName.trim().replace(/\s+/g, ' '), instructorName: teacher.name,
      vehicleNumber: vehicle?.plateNumber ?? '',
      trainingCourse: state.trainingCourse.trim().replace(/\s+/g, ' '),
      teacherComment: state.teacherComment.trim(),
      finalConclusion: state.trainingType === 'COURSE' ? state.finalConclusion ?? calculateConclusion(state.lessons) : null,
    })
    go('report')
  }

  const saveReport = async () => {
    if (savingRef.current || saved || !state.vehicleCategory || !state.trainingType) return
    if (!pendingSave.current && !validateInformation()) return
    const input = pendingSave.current ?? {
      teacherName: state.instructorName, studentName: state.studentName,
      trainingType: state.trainingType === 'COURSE' ? 'EXAM' : state.trainingType,
      vehicleCategory: state.vehicleCategory, vehicleNumber: state.vehicleNumber,
      evaluationDate: state.evaluationDate, practiceAttempt: state.practiceAttempt,
      trainingCourse: state.trainingCourse, teacherComment: state.teacherComment,
      overallResult: state.trainingType === 'COURSE' ? state.finalConclusion : state.checklistOverall,
      evaluationData: state,
    } satisfies SaveEvaluationAdminInput
    pendingSave.current = input
    savingRef.current = true
    setSaving(true)
    setError('')
    try {
      await saveEvaluationAdminRecord(input)
      pendingSave.current = null
      if (mountedRef.current) {
        setAwaitingConfirmation(false)
        setSaved(true)
        window.scrollTo({ top: 0, behavior: 'instant' })
      }
    } catch (cause) {
      const uncertain = getBackendErrorCode(cause) === 'deadline-exceeded'
        || (awaitingConfirmation && getBackendErrorCode(cause) === 'unavailable')
      if (!uncertain) pendingSave.current = null
      if (mountedRef.current) {
        setAwaitingConfirmation(uncertain)
        setError(uncertain
          ? 'Phiếu đang chờ xác nhận. Kiểm tra mạng rồi bấm “Kiểm tra lưu phiếu” để tiếp tục với cùng yêu cầu.'
          : cause instanceof Error ? cause.message : 'Chưa thể lưu phiếu. Vui lòng kiểm tra kết nối rồi thử lại.')
      }
    } finally {
      savingRef.current = false
      if (mountedRef.current) setSaving(false)
    }
  }

  const newEvaluation = () => {
    setSaved(false)
    setState({ ...emptyEvaluation(), instructorName: teacher?.name ?? '' })
    setVehicleId('')
    go(teacher ? 'vehicle' : 'teacher')
  }

  let page
  if (step === 'teacher') {
    page = <TeacherSelectionPage teachers={directory.teachers} selectedTeacherId={teacher?.id ?? ''}
      loading={directory.teachersLoading} error={directory.teacherError ? 'Chưa tải được danh sách giáo viên. Vui lòng thử lại hoặc liên hệ quản trị viên.' : ''}
      onSelect={chooseTeacher} onContinue={() => { if (teacher) go('vehicle') }} onRetry={directory.refresh} />
  } else if (step === 'vehicle') {
    page = <VehicleSelectionPage instructorName={teacher?.name ?? state.instructorName} selectedCategory={state.vehicleCategory}
      vehicles={directory.vehicles} selectedVehicleId={vehicleId} loadingVehicles={directory.vehiclesLoading}
      vehiclesError={directory.vehicleError ? 'Chưa tải được danh sách xe. Vui lòng thử lại hoặc liên hệ quản trị viên.' : ''}
      onSelectVehicle={chooseVehicle} onSelect={chooseCategory} onContinue={() => { if (!teacher) go('teacher'); else if (state.vehicleCategory) go('training') }}
      onChangeTeacher={() => go('teacher')} onRetry={directory.refresh} />
  } else if (step === 'training' && state.vehicleCategory) {
    page = <TrainingSelectionPage vehicleCategory={state.vehicleCategory} onSelect={chooseTraining} onBack={() => go('vehicle')} />
  } else if (step === 'information') {
    page = <StudentInformationPage state={state} onChange={update} onContinue={() => { if (validateInformation()) go('evaluation') }} onBack={() => go('training')} onChangeSession={() => go('vehicle')} />
  } else if (step === 'evaluation') {
    const props = { state, onChange: update, onBack: () => go('information'), onPreview: openReport }
    page = state.trainingType === 'COURSE' ? <EvaluationPage {...props} /> : <ChecklistEvaluationPage {...props} />
  } else {
    page = <ReportPreviewPage state={state} saved={saved} awaitingConfirmation={awaitingConfirmation}
      onChange={update} onEdit={() => go('evaluation')} onSave={() => { void saveReport() }} onNew={newEvaluation} />
  }

  return <>
    <div ref={contentRef}>{page}</div>
    {error && <div className="workflow-toast" role="alert"><span>{error}</span><button className="icon-button" type="button" aria-label="Đóng thông báo" onClick={() => setError('')}><X size={17} /></button></div>}
    {saving && <div className="save-overlay" role="status" aria-live="polite"><div><LoaderCircle className="spin" size={23} />Đang lưu phiếu đánh giá…</div></div>}
  </>
}
