import { Check, LayoutDashboard, ShieldCheck } from 'lucide-react'
import { TrainingCenterBrand } from './TrainingCenterBrand'

interface AppHeaderProps {
  activeStep: number
}

const steps = ['Giáo viên', 'Chọn hạng', 'Nội dung', 'Thông tin', 'Đánh giá', 'Xem phiếu']

export function AppHeader({ activeStep }: AppHeaderProps) {
  return (
    <header className="app-header">
      <div className="app-header__inner">
        <div className="app-header__top">
          <TrainingCenterBrand compact />
          <div className="header-actions">
            <span className="header-note"><ShieldCheck size={15} /> An tâm từng buổi học</span>
            <a className="header-admin" href="/admin/giaovien/A@7979"><LayoutDashboard size={15} /> Quản trị</a>
          </div>
        </div>
        <div className="stepper" aria-label={`Bước ${activeStep} trên ${steps.length}`}>
          {steps.map((step, index) => {
            const number = index + 1
            const done = number < activeStep
            const active = number === activeStep
            return (
              <div className={`stepper__item ${done ? 'is-done' : ''} ${active ? 'is-active' : ''}`} key={step}>
                <span className="stepper__number">{done ? <Check size={14} strokeWidth={3} /> : number}</span>
                <span className="stepper__label">{step}</span>
              </div>
            )
          })}
        </div>
      </div>
    </header>
  )
}
