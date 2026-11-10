import { publishRecords, state } from './runtime.mjs'

export function subscribeEvaluationAdminRecords(onRecords) {
  state.recordListeners.add(onRecords)
  queueMicrotask(() => {
    if (state.recordListeners.has(onRecords)) onRecords(structuredClone(state.records))
  })
  return () => state.recordListeners.delete(onRecords)
}

export async function saveEvaluationAdminRecord(input) {
  if (!input.teacherName?.trim() || !input.studentName?.trim()) throw new Error('Thiếu thông tin học viên hoặc giáo viên.')
  const now = new Date().toISOString()
  const record = { ...structuredClone(input), id: `evaluation-test-${state.nextId++}`, createdAt: now, updatedAt: now }
  state.records.unshift(record)
  publishRecords()
  return structuredClone(record)
}

export async function deleteEvaluationAdminRecord(id) {
  state.records = state.records.filter((record) => record.id !== id)
  publishRecords()
}
