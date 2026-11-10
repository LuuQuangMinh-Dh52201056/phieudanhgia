const clone = (value) => structuredClone(value)

export const state = {
  teachers: [
    { id: 'teacher-thuc', name: 'Trần Trọng Thức' },
    { id: 'teacher-tam', name: 'Nguyễn Minh Tâm' },
  ],
  vehicles: [
    { id: 'vehicle-manual', plateNumber: '51H-123.45', vehicleCategory: 'B_MANUAL' },
    { id: 'vehicle-automatic', plateNumber: '51K-678.90', vehicleCategory: 'B_AUTOMATIC' },
    { id: 'vehicle-c1', plateNumber: '61C-246.80', vehicleCategory: 'C1' },
  ],
  records: [],
  directoryStatus: {
    loading: false,
    error: '',
    teachersLoading: false,
    vehiclesLoading: false,
    teacherError: '',
    vehicleError: '',
  },
  nextId: 1,
  directoryListeners: new Set(),
  recordListeners: new Set(),
}

export function directorySnapshot() {
  return { teachers: clone(state.teachers), vehicles: clone(state.vehicles), ...state.directoryStatus }
}

export function publishDirectory() {
  for (const listener of state.directoryListeners) listener(directorySnapshot())
}

export function publishRecords() {
  for (const listener of state.recordListeners) listener(clone(state.records))
}

// Test-only inspection/control. No localStorage, network, or production import.
globalThis.__E2E_STORES__ = {
  snapshot: () => ({ ...directorySnapshot(), records: clone(state.records) }),
  replaceDirectory(directory) {
    if (directory.teachers) state.teachers = clone(directory.teachers)
    if (directory.vehicles) state.vehicles = clone(directory.vehicles)
    publishDirectory()
  },
  setDirectoryStatus(status) {
    Object.assign(state.directoryStatus, status)
    state.directoryStatus.loading = state.directoryStatus.teachersLoading || state.directoryStatus.vehiclesLoading
    state.directoryStatus.error = [state.directoryStatus.teacherError, state.directoryStatus.vehicleError].filter(Boolean).join(' ')
    publishDirectory()
  },
}
