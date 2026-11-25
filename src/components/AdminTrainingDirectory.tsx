import { useState, type FormEvent } from 'react'
import { CarFront, Check, Pencil, Plus, RefreshCw, Search, Trash2, Users, X } from 'lucide-react'
import { ConfirmDialog } from './ConfirmDialog'
import { VEHICLE_CATEGORIES } from '../data/lessonConfigs'
import { useTrainingDirectory } from '../hooks/useTrainingDirectory'
import {
  deleteTrainingTeacher,
  deleteTrainingVehicle,
  getTrainingDirectoryError,
  normalizeDirectoryName,
  normalizeVehiclePlate,
  saveTrainingTeacher,
  saveTrainingVehicle,
} from '../services/trainingDirectoryStore'
import type { VehicleCategory } from '../types/evaluation'
import type { Teacher, TrainingVehicle } from '../types/trainingDirectory'
import '../styles/training-directory-admin.css'

export function AdminTrainingDirectory() {
  const directory = useTrainingDirectory()
  const [activeCategory, setActiveCategory] = useState<VehicleCategory>('B_MANUAL')
  const [teacherEditorOpen, setTeacherEditorOpen] = useState(false)
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null)
  const [teacherName, setTeacherName] = useState('')
  const [vehicleEditorOpen, setVehicleEditorOpen] = useState(false)
  const [editingVehicle, setEditingVehicle] = useState<TrainingVehicle | null>(null)
  const [plateNumber, setPlateNumber] = useState('')
  const [vehicleCategory, setVehicleCategory] = useState<VehicleCategory>('B_MANUAL')
  const [pendingAction, setPendingAction] = useState<string | null>(null)
  const [actionError, setActionError] = useState('')
  const [message, setMessage] = useState('')
  const [teacherSearch, setTeacherSearch] = useState('')
  const [vehicleSearch, setVehicleSearch] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<{ kind: 'teacher'; item: Teacher } | { kind: 'vehicle'; item: TrainingVehicle } | null>(null)
  const [deleteError, setDeleteError] = useState('')

  const teachersUnavailable = directory.teachersLoading || Boolean(directory.teacherError)
  const vehiclesUnavailable = directory.vehiclesLoading || Boolean(directory.vehicleError)
  const busy = pendingAction !== null
  const visibleTeachers = directory.teachers.filter((teacher) => normalizeDirectoryName(teacher.name).includes(normalizeDirectoryName(teacherSearch)))
  const visibleVehicles = directory.vehicles.filter((vehicle) => vehicle.vehicleCategory === activeCategory && normalizeVehiclePlate(vehicle.plateNumber).includes(normalizeVehiclePlate(vehicleSearch)))

  const clearFeedback = () => {
    setActionError('')
    setMessage('')
  }

  const openTeacherEditor = (teacher?: Teacher) => {
    clearFeedback()
    setEditingTeacher(teacher ?? null)
    setTeacherName(teacher?.name ?? '')
    setTeacherEditorOpen(true)
  }

  const openVehicleEditor = (vehicle?: TrainingVehicle) => {
    clearFeedback()
    setEditingVehicle(vehicle ?? null)
    setPlateNumber(vehicle?.plateNumber ?? '')
    setVehicleCategory(vehicle?.vehicleCategory ?? activeCategory)
    setVehicleEditorOpen(true)
  }

  const handleSaveTeacher = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (busy || teachersUnavailable) return
    clearFeedback()
    const normalizedName = normalizeDirectoryName(teacherName)
    if (!normalizedName) {
      setActionError('Vui lòng nhập tên giáo viên.')
      return
    }
    if (directory.teachers.some((teacher) => teacher.id !== editingTeacher?.id
      && normalizeDirectoryName(teacher.name) === normalizedName)) {
      setActionError('Tên giáo viên này đã có trong danh mục.')
      return
    }
    setPendingAction('save-teacher')
    try {
      await saveTrainingTeacher({ id: editingTeacher?.id, name: teacherName })
      setTeacherEditorOpen(false)
      setMessage(editingTeacher ? 'Đã cập nhật giáo viên.' : 'Đã thêm giáo viên.')
    } catch (error) {
      setActionError(getTrainingDirectoryError(error, 'lưu giáo viên'))
    } finally {
      setPendingAction(null)
    }
  }

  const handleSaveVehicle = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (busy || vehiclesUnavailable) return
    clearFeedback()
    const normalizedPlate = normalizeVehiclePlate(plateNumber)
    if (!normalizedPlate) {
      setActionError('Vui lòng nhập biển số xe hợp lệ.')
      return
    }
    if (directory.vehicles.some((vehicle) => vehicle.id !== editingVehicle?.id
      && normalizeVehiclePlate(vehicle.plateNumber) === normalizedPlate)) {
      setActionError('Biển số xe này đã có trong danh mục.')
      return
    }
    setPendingAction('save-vehicle')
    try {
      await saveTrainingVehicle({ id: editingVehicle?.id, plateNumber, vehicleCategory })
      setVehicleEditorOpen(false)
      setActiveCategory(vehicleCategory)
      setMessage(editingVehicle ? 'Đã cập nhật xe.' : 'Đã thêm xe.')
    } catch (error) {
      setActionError(getTrainingDirectoryError(error, 'lưu xe'))
    } finally {
      setPendingAction(null)
    }
  }

  const confirmDelete = async () => {
    if (busy || !deleteTarget) return
    clearFeedback()
    setDeleteError('')
    setPendingAction(`delete-${deleteTarget.kind}-${deleteTarget.item.id}`)
    try {
      if (deleteTarget.kind === 'teacher') {
        await deleteTrainingTeacher(deleteTarget.item.id)
        if (editingTeacher?.id === deleteTarget.item.id) setTeacherEditorOpen(false)
        setMessage('Đã xóa giáo viên khỏi danh mục.')
      } else {
        await deleteTrainingVehicle(deleteTarget.item.id)
        if (editingVehicle?.id === deleteTarget.item.id) setVehicleEditorOpen(false)
        setMessage('Đã xóa xe khỏi danh mục.')
      }
      setDeleteTarget(null)
    } catch (error) {
      setDeleteError(getTrainingDirectoryError(error, deleteTarget.kind === 'teacher' ? 'xóa giáo viên' : 'xóa xe'))
    } finally {
      setPendingAction(null)
    }
  }

  return (
    <section className="training-directory" aria-label="Danh mục giáo viên và xe">
      <div className="training-directory__heading">
        <div>
          <span className="training-directory__eyebrow">CON NGƯỜI & PHƯƠNG TIỆN</span>
          <h2>Danh mục giáo viên & xe</h2>
          <p>Giáo viên dùng chung cho các hạng. Xe được quản lý theo hạng BSS, BTĐ và C1.</p>
        </div>
        <button type="button" className="training-directory__refresh" disabled={busy || directory.loading} onClick={directory.refresh}>
          <RefreshCw size={15} /> Tải lại danh mục
        </button>
      </div>

      {actionError && <p className="training-directory__feedback is-error" role="alert">{actionError}</p>}
      {message && <p className="training-directory__feedback is-success" role="status"><Check size={17} />{message}</p>}

      <div className="training-directory__columns">
        <section className="training-directory__panel" aria-label="Quản lý giáo viên">
          <div className="training-directory__panel-heading">
            <h3><Users size={20} /> Giáo viên <span>{directory.teachers.length}</span></h3>
            <button type="button" className="training-directory__primary" disabled={busy || teachersUnavailable} onClick={() => openTeacherEditor()}>
              <Plus size={16} /> Thêm giáo viên
            </button>
          </div>
          <p className="training-directory__hint">Giáo viên có thể chọn bất kỳ hạng xe khi tạo phiếu.</p>
          <label className="training-directory__search"><Search size={16} /><input type="search" aria-label="Tìm giáo viên trong danh mục" value={teacherSearch} onChange={(event) => setTeacherSearch(event.target.value)} placeholder="Tìm tên giáo viên..." /></label>
          {directory.teacherError && <p className="training-directory__feedback is-error" role="alert">{directory.teacherError}</p>}

          {teacherEditorOpen && (
            <form className="training-directory__form" onSubmit={(event) => { void handleSaveTeacher(event) }}>
              <strong>{editingTeacher ? 'Sửa thông tin giáo viên' : 'Thêm giáo viên mới'}</strong>
              <label htmlFor="directory-teacher-name">Tên giáo viên</label>
              <input id="directory-teacher-name" value={teacherName} onChange={(event) => setTeacherName(event.target.value)} autoFocus autoComplete="off" maxLength={120} required disabled={busy} />
              <div className="training-directory__form-actions">
                <button type="button" className="training-directory__secondary" disabled={busy} onClick={() => setTeacherEditorOpen(false)}><X size={15} /> Hủy</button>
                <button type="submit" className="training-directory__primary" disabled={busy || teachersUnavailable}>{pendingAction === 'save-teacher' ? 'Đang lưu...' : 'Lưu giáo viên'}</button>
              </div>
            </form>
          )}

          {directory.teachersLoading ? <p className="training-directory__empty" role="status">Đang tải danh mục giáo viên...</p> : (
            visibleTeachers.length > 0 ? (
              <ul className="training-directory__list">
                {visibleTeachers.map((teacher) => (
                  <li key={teacher.id}>
                    <span className="training-directory__teacher-avatar" aria-hidden="true">{teacher.name.charAt(0)}</span><span className="training-directory__item-name">{teacher.name}<small>Giáo viên hướng dẫn</small></span>
                    <div className="training-directory__item-actions">
                      <button type="button" aria-label={`Sửa giáo viên ${teacher.name}`} disabled={busy || teachersUnavailable} onClick={() => openTeacherEditor(teacher)}><Pencil size={16} /></button>
                      <button type="button" className="is-danger" aria-label={`Xóa giáo viên ${teacher.name}`} disabled={busy || teachersUnavailable} onClick={() => { setDeleteError(''); setDeleteTarget({ kind: 'teacher', item: teacher }) }}><Trash2 size={16} /></button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : !directory.teacherError && <p className="training-directory__empty">{teacherSearch ? 'Chưa tìm thấy giáo viên phù hợp.' : 'Chưa có giáo viên. Thêm giáo viên để bắt đầu tạo phiếu.'}</p>
          )}
        </section>

        <section className="training-directory__panel" aria-label="Quản lý xe">
          <div className="training-directory__panel-heading">
            <h3><CarFront size={20} /> Xe đào tạo <span>{directory.vehicles.length}</span></h3>
            <button type="button" className="training-directory__primary" disabled={busy || vehiclesUnavailable} onClick={() => openVehicleEditor()}>
              <Plus size={16} /> Thêm xe
            </button>
          </div>
          <div className="training-directory__tabs" role="tablist" aria-label="Hạng xe đào tạo">
            {VEHICLE_CATEGORIES.map((category) => (
              <button type="button" key={category.id} role="tab" id={`directory-tab-${category.id}`} aria-label={category.shortLabel} aria-selected={activeCategory === category.id} aria-controls="directory-vehicle-list" disabled={busy} onClick={() => {
                setActiveCategory(category.id)
                setVehicleEditorOpen(false)
              }}>
                {category.shortLabel} <span aria-hidden="true">{directory.vehicles.filter((vehicle) => vehicle.vehicleCategory === category.id).length}</span>
              </button>
            ))}
          </div>
          <label className="training-directory__search"><Search size={16} /><input type="search" aria-label="Tìm xe trong danh mục" value={vehicleSearch} onChange={(event) => setVehicleSearch(event.target.value)} placeholder="Tìm biển số xe..." /></label>
          {directory.vehicleError && <p className="training-directory__feedback is-error" role="alert">{directory.vehicleError}</p>}

          {vehicleEditorOpen && (
            <form className="training-directory__form" onSubmit={(event) => { void handleSaveVehicle(event) }}>
              <strong>{editingVehicle ? 'Sửa thông tin xe' : 'Thêm xe mới'}</strong>
              <label htmlFor="directory-vehicle-plate">Biển số xe</label>
              <input id="directory-vehicle-plate" value={plateNumber} onChange={(event) => setPlateNumber(event.target.value)} autoComplete="off" maxLength={32} required disabled={busy} />
              <label htmlFor="directory-vehicle-category">Hạng xe quản lý</label>
              <select id="directory-vehicle-category" value={vehicleCategory} onChange={(event) => setVehicleCategory(event.target.value as VehicleCategory)} required disabled={busy}>
                {VEHICLE_CATEGORIES.map((category) => <option key={category.id} value={category.id}>{category.shortLabel} — {category.label}</option>)}
              </select>
              <div className="training-directory__form-actions">
                <button type="button" className="training-directory__secondary" disabled={busy} onClick={() => setVehicleEditorOpen(false)}><X size={15} /> Hủy</button>
                <button type="submit" className="training-directory__primary" disabled={busy || vehiclesUnavailable}>{pendingAction === 'save-vehicle' ? 'Đang lưu...' : 'Lưu xe'}</button>
              </div>
            </form>
          )}

          <div id="directory-vehicle-list" role="tabpanel" aria-labelledby={`directory-tab-${activeCategory}`}>
            {directory.vehiclesLoading ? <p className="training-directory__empty" role="status">Đang tải danh mục xe...</p> : (
              visibleVehicles.length > 0 ? (
                <ul className="training-directory__list">
                  {visibleVehicles.map((vehicle) => (
                    <li key={vehicle.id}>
                      <span className="training-directory__vehicle-icon" aria-hidden="true"><CarFront size={21} /></span><span className="training-directory__item-name is-plate">{vehicle.plateNumber}<small>{VEHICLE_CATEGORIES.find((category) => category.id === vehicle.vehicleCategory)?.label}</small></span>
                      <div className="training-directory__item-actions">
                        <button type="button" aria-label={`Sửa xe ${vehicle.plateNumber}`} disabled={busy || vehiclesUnavailable} onClick={() => openVehicleEditor(vehicle)}><Pencil size={16} /></button>
                        <button type="button" className="is-danger" aria-label={`Xóa xe ${vehicle.plateNumber}`} disabled={busy || vehiclesUnavailable} onClick={() => { setDeleteError(''); setDeleteTarget({ kind: 'vehicle', item: vehicle }) }}><Trash2 size={16} /></button>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : !directory.vehicleError && <p className="training-directory__empty">{vehicleSearch ? 'Chưa tìm thấy xe phù hợp.' : 'Chưa có xe ở hạng này. Thêm xe để giáo viên lựa chọn khi tạo phiếu.'}</p>
            )}
          </div>
        </section>
      </div>
      <ConfirmDialog open={Boolean(deleteTarget)} title={deleteTarget?.kind === 'teacher' ? 'Xóa giáo viên?' : 'Xóa xe đào tạo?'} description={deleteTarget ? `${deleteTarget.kind === 'teacher' ? deleteTarget.item.name : deleteTarget.item.plateNumber} sẽ được xóa khỏi danh mục. Các phiếu đánh giá đã lưu giữ nguyên thông tin.` : ''} confirmLabel={deleteTarget?.kind === 'teacher' ? 'Xóa giáo viên' : 'Xóa xe'} busy={busy} error={deleteError} onCancel={() => { if (!busy) setDeleteTarget(null) }} onConfirm={() => { void confirmDelete() }} />
    </section>
  )
}
