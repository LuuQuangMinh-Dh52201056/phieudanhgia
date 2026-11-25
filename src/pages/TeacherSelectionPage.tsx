import { ArrowRight, CheckCircle2, GraduationCap, LockKeyhole, RefreshCcw, ShieldCheck } from 'lucide-react'
import { AppFooter } from '../components/AppFooter'
import { AppHeader } from '../components/AppHeader'
import type { Teacher } from '../types/trainingDirectory'
import { JourneyIllustration } from '../components/JourneyIllustration'

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
      <main className="entry-layout teacher-entry-content">
        <section className="entry-copy">
          <span className="eyebrow"><i /> PHÚ GIÁO · ĐÀO TẠO LÁI XE</span>
          <h1>Từng buổi học.<br /><em>Vững một tay lái.</em></h1>
          <p>Đánh giá thực hành một cách rõ ràng. Ghi nhận từng tiến bộ, đồng hành cùng học viên trên mỗi chặng đường.</p>
          <div className="entry-features"><span><CheckCircle2 size={14} /> 3 hạng xe</span><span><CheckCircle2 size={14} /> 3 nội dung tập</span><span><CheckCircle2 size={14} /> Phiếu PNG rõ nét</span></div>
          <JourneyIllustration />
        </section>
        <form className="teacher-entry-card" onSubmit={(event) => { event.preventDefault(); onContinue() }}>
          <div className="teacher-entry-icon"><GraduationCap size={34} /></div>
          <div className="entry-card-heading"><div><h2>Chọn giáo viên</h2><p>Chào bạn, bắt đầu buổi đánh giá mới nhé.</p></div><span className="entry-card-step">01</span></div>
          <label className="field">
            <span>Giáo viên hướng dẫn <b>*</b></span>
            <select className="session-select" aria-label="Giáo viên hướng dẫn" value={selectedTeacherId} onChange={(event) => onSelect(event.target.value)} required disabled={loading || !!error}>
              <option value="" disabled>{loading ? 'Đang tải danh sách giáo viên…' : 'Chọn tên giáo viên'}</option>
              {teachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.name}</option>)}
            </select>
          </label>
          {error && <div className="session-notice session-notice--error" role="alert"><p>{error}</p><button className="button button--ghost" type="button" onClick={onRetry}><RefreshCcw size={16} /> Thử lại</button></div>}
          {!loading && !error && teachers.length === 0 && <p className="session-notice">Danh sách giáo viên đang trống. Vui lòng nhờ quản trị viên thêm tên giáo viên.</p>}
          <p className="teacher-entry-hint"><ShieldCheck size={17} />Tên giáo viên sẽ tự điền trên phiếu. Bạn có thể chọn mọi hạng B số sàn, B số tự động và C1 ở bước tiếp theo.</p>
          <button className="button button--primary button--large" type="submit" disabled={loading || !!error || !selectedTeacherId}>Tiếp tục <ArrowRight size={19} /></button>
          <span className="entry-card-footer"><LockKeyhole size={12} /> Thông tin được quản lý tại trung tâm</span>
        </form>
      </main>
      <AppFooter />
    </div>
  )
}
