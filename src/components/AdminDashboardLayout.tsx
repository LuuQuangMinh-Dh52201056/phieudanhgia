import type { ReactNode } from 'react'
import { ArrowRight, CalendarDays, CarFront, Check, ChevronRight, ClipboardList, FileText, LayoutDashboard, Users } from 'lucide-react'
import { TrainingCenterBrand } from './TrainingCenterBrand'
import '../styles/admin-teachers.css'

const views = {
  overview: {
    label: 'Tổng quan',
    title: 'Chào một ngày hiệu quả.',
    description: 'Theo dõi hoạt động đánh giá và kết nối mọi thông tin đào tạo tại một nơi.',
    Icon: LayoutDashboard,
  },
  records: {
    label: 'Phiếu đánh giá',
    title: 'Mỗi buổi học, một bước tiến.',
    description: 'Tìm kiếm, xem lại và quản lý phiếu đánh giá của trung tâm.',
    Icon: ClipboardList,
  },
  directory: {
    label: 'Giáo viên & xe',
    title: 'Đội ngũ vững. Hành trình tốt.',
    description: 'Quản lý giáo viên cùng phương tiện đào tạo theo từng hạng xe.',
    Icon: Users,
  },
}

export type AdminView = keyof typeof views

interface AdminDashboardLayoutProps {
  view: AdminView
  onViewChange: (view: AdminView) => void
  status: string
  statusAttention?: boolean
  headingActions?: ReactNode
  children: ReactNode
}

export function AdminDashboardLayout({ view, onViewChange, status, statusAttention, headingActions, children }: AdminDashboardLayoutProps) {
  const { label, title, description } = views[view]
  return <>
    <aside className="admin-sidebar">
      <a href="/" className="admin-sidebar-brand" aria-label="Phú Giáo — về trang tạo phiếu"><TrainingCenterBrand compact /></a>
      <span className="admin-sidebar-caption">KHÔNG GIAN QUẢN TRỊ</span>
      <nav aria-label="Điều hướng quản trị">
        {(Object.keys(views) as AdminView[]).map((id) => {
          const { Icon, label } = views[id]
          return <button key={id} type="button" aria-current={view === id ? 'page' : undefined} onClick={() => onViewChange(id)}>
            <Icon size={20} /><span>{label}</span>{view === id && <ChevronRight size={15} />}
          </button>
        })}
      </nav>
      <div className="admin-sidebar-footer"><span className="admin-sidebar-seal"><Check size={21} /></span><strong>Đồng hành cùng<br />từng tay lái.</strong><p>Trung tâm Giáo dục nghề nghiệp Phú Giáo</p><a href="/">Tạo phiếu mới <ArrowRight size={15} /></a></div>
    </aside>
    <main className="admin-main">
      <header className="admin-topbar">
        <div><span>Phú Giáo</span><ChevronRight size={14} /><strong>{label}</strong></div>
        <span className={`admin-live ${statusAttention ? 'has-error' : ''}`}><i />{status}</span>
      </header>
      <div className="admin-workspace">
        <section className="admin-page-heading">
          <div><span className="admin-eyebrow">QUẢN LÝ ĐÀO TẠO</span><h1>{title}</h1><p>{description}</p></div>
          {headingActions}
        </section>
        {children}
        <footer className="admin-workspace-footer"><span>PHÚ GIÁO</span><p>Chất lượng từ những điều tận tâm.</p><span>Quản lý đào tạo</span></footer>
      </div>
    </main>
  </>
}

interface AdminDashboardStatsProps {
  records?: number
  teachers?: number
  students?: number
  today?: number
  todayLabel: string
}

export function AdminDashboardStats({ records, teachers, students, today, todayLabel }: AdminDashboardStatsProps) {
  const stats = [
    { label: 'Tổng phiếu đánh giá', value: records, Icon: FileText, note: 'Đã lưu tại trung tâm' },
    { label: 'Giáo viên', value: teachers, Icon: Users, note: 'Đã thực hiện đánh giá' },
    { label: 'Học viên', value: students, Icon: CarFront, note: 'Theo tên trong phiếu' },
    { label: 'Phiếu hôm nay', value: today, Icon: CalendarDays, note: todayLabel },
  ]
  return <section className="admin-stats" aria-label="Thống kê đánh giá">
    {stats.map(({ label, value, Icon, note }) => <article key={label}>
      <div className="admin-stat-top"><span>{label}</span><i><Icon size={19} /></i></div>
      <strong>{value?.toLocaleString('vi-VN') ?? '—'}</strong><small>{note}</small>
    </article>)}
  </section>
}
