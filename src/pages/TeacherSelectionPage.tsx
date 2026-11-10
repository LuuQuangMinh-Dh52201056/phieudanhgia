import { ArrowRight, GraduationCap, RefreshCcw } from 'lucide-react'
import { AppFooter } from '../components/AppFooter'
import { AppHeader } from '../components/AppHeader'
import type { Teacher } from '../types/trainingDirectory'

interface TeacherSelectionPageProps {
  teachers: Teacher[]
  selectedTeacherId: string
  loading: boolean
  error: string
  onSelect: (id: string) => void
  onContinue: () => void
  onRetry: () => void
}

export function TeacherSelectionPage({ teachers, selectedTeacherId, loading, error, onSelect, onContinue, onRetry }: TeacherSelectionPageProps) {
  return (
    <div className="app-shell teacher-entry-page">
      <AppHeader activeStep={1} />
      <main className="content-page content-page--narrow teacher-entry-content">
        <div className="page-heading">
          <div className="page-heading__number">01</div>
          <div>
            <span>PHIẾU ĐÁNH GIÁ THỰC HÀNH LÁI XE</span>
            <h1>Chọn giáo viên</h1>
            <p>Chọn tên của bạn trước khi bắt đầu. Tên giáo viên sẽ tự điền trên phiếu.</p>
          </div>
        </div>
        <form className="teacher-entry-card" onSubmit={(event) => { event.preventDefault(); onContinue() }}>
          <div className="teacher-entry-icon"><GraduationCap size={34} /></div>
          <label className="field">
            <span>Giáo viên hướng dẫn <b>*</b></span>
            <select className="session-select" aria-label="Giáo viên hướng dẫn" value={selectedTeacherId} onChange={(event) => onSelect(event.target.value)} required disabled={loading || !!error}>
              <option value="" disabled>{loading ? 'Đang tải danh sách giáo viên…' : 'Chọn tên giáo viên'}</option>
              {teachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.name}</option>)}
            </select>
          </label>
          {error && <div className="session-notice session-notice--error" role="alert"><p>{error}</p><button className="button button--ghost" type="button" onClick={onRetry}><RefreshCcw size={16} /> Thử lại</button></div>}
          {!loading && !error && teachers.length === 0 && <p className="session-notice">Danh sách giáo viên đang trống. Vui lòng nhờ quản trị viên thêm tên giáo viên.</p>}
          <p className="teacher-entry-hint">Giáo viên có thể chọn mọi hạng B số sàn, B số tự động và C1 ở bước tiếp theo.</p>
          <button className="button button--primary button--large" type="submit" disabled={loading || !!error || !selectedTeacherId}>Tiếp tục <ArrowRight size={19} /></button>
        </form>
      </main>
      <AppFooter />
    </div>
  )
}
