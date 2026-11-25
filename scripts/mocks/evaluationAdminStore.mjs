import { beginOperation, publishRecords, state } from './runtime.mjs'

export function subscribeEvaluationAdminRecords(onRecords) {
  state.recordListeners.add(onRecords)
  queueMicrotask(() => {
    if (state.recordListeners.has(onRecords)) onRecords(structuredClone(state.records))
  })
  return () => state.recordListeners.delete(onRecords)
}

export async function saveEvaluationAdminRecord(input) {
  await beginOperation('saveEvaluation', input.id)
  if (!input.teacherName?.trim() || !input.studentName?.trim()) throw new Error('Thiếu thông tin học viên hoặc giáo viên.')
  const now = new Date().toISOString()
  const record = { ...structuredClone(input), id: `evaluation-test-${state.nextId++}`, createdAt: now, updatedAt: now }
  state.records.unshift(record)
  publishRecords()
  return structuredClone(record)
}

export async function updateEvaluationAdminRecord(record, input) {
  await beginOperation('updateEvaluation', record.id)
  const current = state.records.find((item) => item.id === record.id)
  if (!current) throw Object.assign(new Error('Phiếu này đã bị xóa.'), { code: 'not-found' })
  if (current.updatedAt !== record.updatedAt) throw Object.assign(new Error('Phiếu đã được cập nhật.'), { code: 'conflict' })
  const fields = structuredClone(input)
  if (!fields.evaluationData) delete fields.evaluationData
  Object.assign(current, fields, { updatedAt: new Date().toISOString(), updatedBy: 'e2e-admin' })
  publishRecords()
}

export async function deleteEvaluationAdminRecord(id) {
  await beginOperation('deleteEvaluation', id)
  state.records = state.records.filter((record) => record.id !== id)
  publishRecords()
}
