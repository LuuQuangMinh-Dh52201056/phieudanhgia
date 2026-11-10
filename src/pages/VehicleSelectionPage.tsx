import { ArrowLeft, ArrowRight, CarFront, CheckCircle2, Gauge, Joystick, Truck } from 'lucide-react'
import { AppFooter } from '../components/AppFooter'
import { AppHeader } from '../components/AppHeader'
import { VEHICLE_CATEGORIES } from '../data/lessonConfigs'
import type { VehicleCategory } from '../types/evaluation'
import type { TrainingVehicle } from '../types/trainingDirectory'

interface VehicleSelectionPageProps {
  onSelect: (category: VehicleCategory) => void
  instructorName: string
  selectedCategory: VehicleCategory | null
  vehicles: TrainingVehicle[]
  selectedVehicleId: string
  loadingVehicles: boolean
  vehiclesError: string
  onSelectVehicle: (id: string) => void
  onContinue: () => void
  onChangeTeacher: () => void
  onRetry: () => void
}

export function VehicleSelectionPage({ onSelect, instructorName, selectedCategory, vehicles, selectedVehicleId, loadingVehicles, vehiclesError, onSelectVehicle, onContinue, onChangeTeacher, onRetry }: VehicleSelectionPageProps) {
  const availableVehicles = vehicles.filter((vehicle) => vehicle.vehicleCategory === selectedCategory)
  const vehicleIcons = {
    B_MANUAL: <Joystick size={43} />,
    B_AUTOMATIC: <Gauge size={43} />,
    C1: <Truck size={43} />,
  }

  return (
    <div className="app-shell vehicle-page">
      <AppHeader activeStep={2} />
      <main className="vehicle-hero">
        <div className="vehicle-hero__copy">
          <h1>PHIẾU ĐÁNH GIÁ THỰC HÀNH LÁI XE</h1>
          <p>Chọn hạng xe, nội dung tập và chấm nhanh để xuất phiếu PNG rõ nét.</p>
          <div className="hero-points">
            <span><CheckCircle2 size={17} /> Đúng nội dung từng hạng</span>
            <span><CheckCircle2 size={17} /> Mức độ xanh – cam – đỏ</span>
            <span><CheckCircle2 size={17} /> Đồng bộ phiếu đánh giá</span>
          </div>
        </div>

        <div className="vehicle-selector-panel">
          <div className="panel-heading">
            <span className="panel-heading__number">02</span><div><small>GIÁO VIÊN: {instructorName}</small><h2>Chọn hạng xe</h2></div>
          </div>
          <div className="vehicle-card-grid">
            {VEHICLE_CATEGORIES.map((category) => (
              <button className={`vehicle-card ${selectedCategory === category.id ? 'vehicle-card--selected' : ''}`} aria-pressed={selectedCategory === category.id} type="button" key={category.id} onClick={() => onSelect(category.id)}>
                {category.id === 'B_MANUAL' && <span className="vehicle-card__popular">★ Phổ biến</span>}
                <div className="vehicle-card__badge">{vehicleIcons[category.id]}</div>
                <div className="vehicle-card__content">
                  <small>HẠNG XE</small>
                  <h3>{category.label}</h3>
                  <p>{category.description}</p>
                  <span>Chọn hạng này</span>
                </div>
                <span className="vehicle-card__arrow"><ArrowRight size={20} /></span>
              </button>
            ))}
          </div>
          {selectedCategory && <section className="vehicle-entry-options" aria-label="Chọn xe theo hạng">
            <label className="field">
              <span><CarFront size={18} /> Biển số xe <small>(không bắt buộc)</small></span>
              <select className="session-select" value={availableVehicles.some((vehicle) => vehicle.id === selectedVehicleId) ? selectedVehicleId : ''} onChange={(event) => onSelectVehicle(event.target.value)} aria-label="Biển số xe" disabled={loadingVehicles || !!vehiclesError}>
                <option value="">{loadingVehicles ? 'Đang tải danh sách xe…' : 'Chọn biển số xe'}</option>
                {availableVehicles.map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{vehicle.plateNumber}</option>)}
              </select>
            </label>
            {vehiclesError && <div className="session-notice session-notice--error" role="alert"><p>{vehiclesError}</p><button className="button button--ghost" type="button" onClick={onRetry}>Thử lại</button></div>}
            {!loadingVehicles && !vehiclesError && availableVehicles.length === 0 && <p className="session-notice">Chưa có xe cho hạng này. Quản trị viên có thể bổ sung trong danh mục xe; bạn vẫn có thể tiếp tục lập phiếu.</p>}
          </section>}
          <div className="session-actions">
            <button className="button button--ghost" type="button" onClick={onChangeTeacher}><ArrowLeft size={17} /> Đổi giáo viên</button>
            <button className="button button--primary" type="button" onClick={onContinue} disabled={!selectedCategory}>Tiếp tục <ArrowRight size={18} /></button>
          </div>
        </div>
      </main>
      <AppFooter />
    </div>
  )
}
