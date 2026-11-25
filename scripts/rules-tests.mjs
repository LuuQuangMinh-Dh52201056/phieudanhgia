import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing'
import { collection, deleteDoc, deleteField, disableNetwork, doc, enableNetwork, getDoc, getDocs, serverTimestamp, setDoc, setLogLevel, Timestamp, updateDoc } from 'firebase/firestore'

// Never connect these destructive fixture tests to a real Firebase project.
const projectId = 'demo-phieu-danh-gia'
const emulator = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8088'
const [host, portText] = emulator.split(':')
if (!['localhost', '127.0.0.1'].includes(host) || !/^\d+$/.test(portText)) {
  throw new Error('Rules tests require a local Firestore emulator on localhost/127.0.0.1.')
}
const source = await readFile(new URL('../firebase/firestore.rules', import.meta.url), 'utf8')
// Execute the production timeout/error helper, without importing the configured
// Firebase app or changing its implementation for the test.
const helperSource = await readFile(new URL('../src/services/firestoreOperations.ts', import.meta.url), 'utf8')
const helperCode = ts.transpileModule(helperSource, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext } }).outputText
const moduleUrl = (code) => `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`
const operationsUrl = moduleUrl(helperCode)
const operations = await import(operationsUrl)
const adminList = /let adminUids = \[[^\n]*\];/
assert.ok(adminList.test(source), 'The rules must contain the explicit admin UID list.')
const adminUid = 'rules-test-admin'
const now = () => serverTimestamp()
const old = Timestamp.fromDate(new Date('2024-01-01T00:00:00Z'))
const teacher = () => ({ name: 'Nguyễn Văn An', normalizedName: 'nguyen van an', createdAt: now(), updatedAt: now() })
const vehicle = () => ({ plateNumber: '61A-123.45', normalizedPlate: '61A12345', vehicleCategory: 'B_MANUAL', createdAt: now(), updatedAt: now() })
const evaluation = () => ({ teacherName: 'Nguyễn Văn An', studentName: 'Trần Văn Bình', trainingType: 'EXAM', vehicleCategory: 'B_MANUAL', evaluationDate: '2026-11-14', createdAt: now(), updatedAt: now(), evaluationData: { lessons: [] } })
const evaluationEdit = () => ({
  teacherName: 'Nguyễn Văn An', studentName: 'Học viên đã sửa', evaluationDate: '2026-11-15',
  vehicleNumber: '61A-999.99', practiceAttempt: '3', trainingCourse: 'K24',
  overallResult: 'NEEDS_IMPROVEMENT', teacherComment: 'Cần thực hành thêm.',
  evaluationData: { lessons: [{ status: 'NOTICE' }] }, updatedBy: adminUid, updatedAt: now(),
})
let assertions = 0
let cases = 0
const allow = (operation) => { assertions += 1; return assertSucceeds(operation) }
const deny = (operation) => { assertions += 1; return assertFails(operation) }
const check = async (label, test) => { await test(); cases += 1; console.log(`PASS ${label}`) }
setLogLevel('silent')

async function environment(list) {
  return initializeTestEnvironment({
    projectId,
    firestore: { host, port: Number(portText), rules: source.replace(adminList, `let adminUids = ${list};`) },
  })
}

let env = await environment("['REPLACE_WITH_ADMIN_UID']")
try {
  await env.clearFirestore()
  const placeholder = env.authenticatedContext('REPLACE_WITH_ADMIN_UID').firestore()
  const anonymous = env.unauthenticatedContext().firestore()
  await check('unconfigured placeholder denies privileged access, including a matching UID', async () => {
    await deny(setDoc(doc(placeholder, 'trainingTeachers', 'blocked'), teacher()))
    await deny(setDoc(doc(placeholder, 'trainingVehicles', 'blocked'), vehicle()))
    await deny(getDocs(collection(placeholder, 'evaluations')))
    await deny(deleteDoc(doc(placeholder, 'evaluations', 'blocked')))
    await allow(getDocs(collection(anonymous, 'trainingTeachers')))
    await allow(getDocs(collection(anonymous, 'trainingVehicles')))
    await allow(setDoc(doc(anonymous, 'evaluations', 'anonymous-created'), evaluation()))
    await deny(getDoc(doc(anonymous, 'evaluations', 'anonymous-created')))
    await deny(deleteDoc(doc(anonymous, 'evaluations', 'anonymous-created')))
  })
} finally {
  await env.cleanup()
}

env = await environment(`['${adminUid}']`)
try {
  await env.clearFirestore()
  const admin = env.authenticatedContext(adminUid).firestore()
  const anonymous = env.unauthenticatedContext().firestore()
  const other = env.authenticatedContext('ordinary-account', { admin: true }).firestore()
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore()
    await setDoc(doc(db, 'trainingTeachers', 'existing'), { ...teacher(), createdAt: old, updatedAt: old })
    await setDoc(doc(db, 'trainingVehicles', 'existing'), { ...vehicle(), createdAt: old, updatedAt: old })
    await setDoc(doc(db, 'evaluations', 'legacy'), { legacyOnly: true, trainingType: 'COURSE', createdAt: old, reportImageUrl: 'https://example.test/old.png' })
    await setDoc(doc(db, 'trainingTeachers', 'legacy'), { name: 'Giáo viên cũ', source: 'original' })
    await setDoc(doc(db, 'trainingVehicles', 'legacy'), { plateNumber: '61A-123.45', vehicleCategory: 'B_MANUAL', source: 'original' })
  })

  for (const [label, db] of [['anonymous', anonymous], ['non-admin with an admin claim', other]]) {
    await check(`${label} can read both public catalogs`, async () => {
      for (const name of ['trainingTeachers', 'trainingVehicles']) {
        await allow(getDoc(doc(db, name, 'existing')))
        await allow(getDocs(collection(db, name)))
      }
    })
    await check(`${label} cannot create/update/delete either catalog`, async () => {
      for (const [name, payload] of [['trainingTeachers', teacher], ['trainingVehicles', vehicle]]) {
        await deny(setDoc(doc(db, name, 'unauthorized'), payload()))
        await deny(updateDoc(doc(db, name, 'existing'), { updatedAt: now() }))
        await deny(deleteDoc(doc(db, name, 'existing')))
      }
    })
    await check(`${label} cannot read/list/delete/update private evaluations`, async () => {
      await deny(getDoc(doc(db, 'evaluations', 'legacy')))
      await deny(getDocs(collection(db, 'evaluations')))
      await deny(deleteDoc(doc(db, 'evaluations', 'legacy')))
      await deny(updateDoc(doc(db, 'evaluations', 'legacy'), evaluationEdit()))
    })
  }

  await check('admin can create/read/update/delete a teacher', async () => {
    const reference = doc(admin, 'trainingTeachers', 'admin-teacher')
    await allow(setDoc(reference, teacher()))
    await allow(getDoc(reference))
    await allow(updateDoc(reference, { name: 'Nguyễn Văn Ba', normalizedName: 'nguyen van ba', updatedAt: now() }))
    await allow(getDocs(collection(admin, 'trainingTeachers')))
    await allow(deleteDoc(reference))
  })
  await check('admin can create/read/update/delete a vehicle in each supported category', async () => {
    for (const category of ['B_MANUAL', 'B_AUTOMATIC', 'C1']) {
      const reference = doc(admin, 'trainingVehicles', `admin-${category}`)
      await allow(setDoc(reference, { ...vehicle(), vehicleCategory: category }))
      await allow(getDoc(reference))
      await allow(updateDoc(reference, { plateNumber: '61A-999.99', normalizedPlate: '61A99999', updatedAt: now() }))
      await allow(deleteDoc(reference))
    }
  })
  await check('legacy teacher and vehicle can be edited without inventing creation timestamps', async () => {
    const teacherRef = doc(admin, 'trainingTeachers', 'legacy')
    const vehicleRef = doc(admin, 'trainingVehicles', 'legacy')
    await allow(updateDoc(teacherRef, { name: 'Giáo viên đã sửa', normalizedName: 'giao vien da sua', updatedAt: now() }))
    await allow(updateDoc(vehicleRef, { plateNumber: '61C-246.80', normalizedPlate: '61C24680', vehicleCategory: 'C1', updatedAt: now() }))
    for (const reference of [teacherRef, vehicleRef]) {
      const data = (await allow(getDoc(reference))).data()
      assert.equal(data.source, 'original')
      assert.equal(data.createdAt, undefined)
    }
  })
  await check('admin teacher writes reject invalid types/lengths/keys/timestamps', async () => {
    const invalid = [
      { ...teacher(), name: '' }, { ...teacher(), name: 123 }, { ...teacher(), name: 'a'.repeat(121) },
      { ...teacher(), normalizedName: '' }, { ...teacher(), normalizedName: 'a'.repeat(121) },
      { ...teacher(), unexpected: true }, { ...teacher(), createdAt: old }, { ...teacher(), updatedAt: old },
      { name: 'An', createdAt: now(), updatedAt: now() },
    ]
    for (const payload of invalid) await deny(setDoc(doc(admin, 'trainingTeachers', 'invalid'), payload))
    await deny(updateDoc(doc(admin, 'trainingTeachers', 'existing'), { createdAt: now(), updatedAt: now() }))
    await deny(updateDoc(doc(admin, 'trainingTeachers', 'existing'), { name: 'An', updatedAt: old }))
    await deny(updateDoc(doc(admin, 'trainingTeachers', 'existing'), { normalizedName: deleteField(), updatedAt: now() }))
    await deny(updateDoc(doc(admin, 'trainingTeachers', 'existing'), { unexpected: true, updatedAt: now() }))
  })
  await check('admin vehicle writes reject invalid categories/types/keys/timestamps', async () => {
    const invalid = [
      { ...vehicle(), plateNumber: '' }, { ...vehicle(), plateNumber: 'a'.repeat(33) },
      { ...vehicle(), normalizedPlate: '' }, { ...vehicle(), normalizedPlate: '61a-123' },
      { ...vehicle(), vehicleCategory: 'C2' }, { ...vehicle(), vehicleCategory: 1 },
      { ...vehicle(), unexpected: true }, { ...vehicle(), createdAt: old }, { ...vehicle(), updatedAt: old },
      { plateNumber: '61A-123.45', vehicleCategory: 'B_MANUAL', createdAt: now(), updatedAt: now() },
    ]
    for (const payload of invalid) await deny(setDoc(doc(admin, 'trainingVehicles', 'invalid'), payload))
    await deny(updateDoc(doc(admin, 'trainingVehicles', 'existing'), { createdAt: now(), updatedAt: now() }))
    await deny(updateDoc(doc(admin, 'trainingVehicles', 'existing'), { normalizedPlate: deleteField(), updatedAt: now() }))
    await deny(updateDoc(doc(admin, 'trainingVehicles', 'existing'), { updatedAt: old }))
    await deny(updateDoc(doc(admin, 'trainingVehicles', 'existing'), { unexpected: true, updatedAt: now() }))
  })
  await check('anonymous teacher can still create evaluation documents, including legacy COURSE', async () => {
    await allow(setDoc(doc(anonymous, 'evaluations', 'new-evaluation'), evaluation()))
    await allow(setDoc(doc(anonymous, 'evaluations', 'legacy-course'), { ...evaluation(), trainingType: 'COURSE' }))
  })
  await check('evaluation create retains existing basic validation and server timestamp requirements', async () => {
    const invalid = [
      { ...evaluation(), teacherName: '' }, { ...evaluation(), teacherName: 5 },
      { ...evaluation(), studentName: '' }, { ...evaluation(), studentName: 5 },
      { ...evaluation(), trainingType: 5 }, { ...evaluation(), vehicleCategory: '' },
      { ...evaluation(), vehicleCategory: 5 }, { ...evaluation(), evaluationDate: 5 },
      { ...evaluation(), createdAt: old }, { ...evaluation(), updatedAt: old }, { ...evaluation(), updatedBy: adminUid },
    ]
    const missing = evaluation()
    delete missing.teacherName
    invalid.push(missing)
    for (const payload of invalid) await deny(setDoc(doc(anonymous, 'evaluations', 'invalid'), payload))
  })
  await check('only admin can read, edit and delete saved/legacy records', async () => {
    const legacy = doc(admin, 'evaluations', 'legacy')
    await allow(getDoc(legacy))
    const snapshot = await allow(getDocs(collection(admin, 'evaluations')))
    assert.equal(snapshot.size, 3, 'Publishing permissions must not remove legacy documents.')
    await allow(updateDoc(legacy, evaluationEdit()))
    const updated = (await allow(getDoc(legacy))).data()
    assert.equal(updated.studentName, 'Học viên đã sửa')
    assert.equal(updated.trainingType, 'COURSE')
    assert.equal(updated.legacyOnly, true)
    assert.equal(updated.createdAt.isEqual(old), true)
    assert.equal(updated.updatedBy, adminUid)
    assert.equal(updated.reportImageUrl, 'https://example.test/old.png')
    assert.equal(updated.evaluationData.lessons[0].status, 'NOTICE')
    await allow(updateDoc(doc(admin, 'evaluations', 'new-evaluation'), evaluationEdit()))
    await allow(deleteDoc(doc(admin, 'evaluations', 'new-evaluation')))
    await allow(deleteDoc(doc(admin, 'evaluations', 'already-deleted')))
  })
  await check('evaluation changes protect identity, type, creation date, and updatedBy', async () => {
    const reference = doc(admin, 'evaluations', 'legacy')
    for (const patch of [
      { updatedBy: 'someone-else' }, { updatedAt: old }, { createdAt: now() },
      { teacherName: '' }, { studentName: 'x'.repeat(161) }, { evaluationDate: 'yesterday' },
      { trainingType: 'BASIC' }, { vehicleCategory: 'C1' }, { practiceAttempt: '0' },
      { evaluationData: [] }, { unexpected: true }, { reportImageUrl: 'https://example.test/replacement.png' }, { reportImageUrl: deleteField() },
    ]) {
      await deny(updateDoc(reference, { ...evaluationEdit(), ...patch }))
    }
  })
  await check('production editor rejects stale revisions and keeps the original record ID', async () => {
    globalThis.__rulesTestFirebase = { firestoreDatabase: admin, firebaseAuth: { currentUser: { uid: adminUid } } }
    try {
      const storeSource = await readFile(new URL('../src/services/evaluationAdminStore.ts', import.meta.url), 'utf8')
      const { outputText } = ts.transpileModule(storeSource, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext } })
      const storeCode = outputText
        .replace("'firebase/firestore'", JSON.stringify(import.meta.resolve('firebase/firestore')))
        .replace(/import .* from ['"]\.\.\/lib\/firebase['"];?/, 'const { firebaseAuth, firestoreDatabase } = globalThis.__rulesTestFirebase;')
        .replace("'./firestoreOperations'", JSON.stringify(operationsUrl))
      const store = await import(moduleUrl(storeCode))
      const reference = doc(admin, 'evaluations', 'legacy')
      const original = await allow(getDoc(reference))
      assert.ok(original.exists())
      const data = original.data()
      const record = store.mapEvaluationAdminDocument(reference.id, data)
      const fields = {
        teacherName: 'Nguyễn Văn An', studentName: 'Học viên đã cập nhật', evaluationDate: '2026-11-15',
        vehicleNumber: '61c-246.80', practiceAttempt: '3', trainingCourse: 'K24',
        overallResult: 'NEEDS_IMPROVEMENT', teacherComment: 'Ghi chú cập nhật.',
      }
      await store.updateEvaluationAdminRecord(record, fields)
      await assert.rejects(store.updateEvaluationAdminRecord(record, { ...fields, studentName: 'Tên ghi đè' }), (error) => error.code === 'conflict')
      const updated = (await allow(getDoc(reference))).data()
      assert.equal(updated.studentName, fields.studentName)
      assert.equal(updated.vehicleNumber, '61C-246.80')
      assert.deepEqual(updated.evaluationData, data.evaluationData)
      assert.equal(updated.createdAt.isEqual(old), true)
      assert.equal(updated.reportImageUrl, 'https://example.test/old.png')
      await allow(deleteDoc(reference))
    } finally {
      delete globalThis.__rulesTestFirebase
    }
  })
  await check('recursive fallback denies unknown collections and nested bypasses for everyone', async () => {
    for (const db of [anonymous, other, admin]) {
      for (const path of ['otherCollection/item', 'trainingTeachers/existing/private/item', 'evaluations/legacy/private/item']) {
        await deny(getDoc(doc(db, path)))
        await deny(setDoc(doc(db, path), { name: 'Bypass' }))
        await deny(deleteDoc(doc(db, path)))
      }
    }
  })
  await check('production delete helper rejects invalid IDs and retains Firestore permission codes', async () => {
    for (const id of ['', 'a/b', '.', '..', '__reserved__', 'a'.repeat(1501)]) {
      assert.throws(() => operations.requireDocumentId(id, 'phiếu'), (error) => error.code === 'invalid-argument')
    }
    assert.equal(operations.requireDocumentId(' valid-id ', 'phiếu'), 'valid-id')
    await assert.rejects(
      operations.runFirestoreWrite(() => deleteDoc(doc(other, 'evaluations', 'legacy-course')), 'xóa phiếu đánh giá'),
      (error) => error.code === 'permission-denied' && error.message.includes('Không có quyền'),
    )
  })
  await check('production delete helper times out offline; queued SDK write can finish after reconnect', async () => {
    const reference = doc(admin, 'evaluations', 'offline-delete')
    await allow(setDoc(reference, evaluation()))
    await disableNetwork(admin)
    let pendingDelete
    try {
      await assert.rejects(
        operations.runFirestoreWrite(() => {
          pendingDelete = deleteDoc(reference)
          return pendingDelete
        }, 'xóa phiếu đánh giá'),
        (error) => error.code === 'deadline-exceeded' && error.message.includes('vẫn có thể hoàn tất'),
      )
    } finally {
      await enableNetwork(admin)
    }
    await pendingDelete
    const snapshot = await allow(getDoc(reference))
    assert.equal(snapshot.exists(), false)
  })
} finally {
  await env.cleanup()
}
console.log(`Firestore rules passed: ${cases} cases, ${assertions} allow/deny assertions, local emulator only.`)
