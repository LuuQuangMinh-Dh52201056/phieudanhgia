import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { verifyDeleteDialog } from './e2e-delete-dialog.mjs'

const records = [
  {
    id: 'record-exam', teacherName: 'Trần Trọng Thức', studentName: 'An Sa Hình', trainingType: 'EXAM', vehicleCategory: 'B_MANUAL',
    vehicleNumber: '51H-123.45', evaluationDate: '2026-11-14', practiceAttempt: '3', trainingCourse: 'K24',
    overallResult: 'CONTINUE_PRACTICE', teacherComment: 'Cần luyện dừng xe trên dốc.', createdAt: '2026-11-14T03:00:00.000Z', updatedAt: '2026-11-14T03:00:00.000Z',
    evaluationData: {
      lessons: [{ id: 'hill', order: 3, name: 'Dừng xe và khởi hành trên dốc', status: 'NEEDS_PRACTICE', selectedErrors: ['Tuột dốc'], note: 'Giữ phanh trước khi chuyển sang ga.' }],
      emergencyEvaluation: { status: 'NOTICE', selectedErrors: ['Phản ứng chậm'], note: 'Quan sát tín hiệu khẩn cấp.' },
    },
  },
  {
    id: 'record-basic', teacherName: 'Nguyễn Minh Tâm', studentName: 'Bình Cơ Bản', trainingType: 'BASIC', vehicleCategory: 'B_AUTOMATIC',
    vehicleNumber: '51K-678.90', evaluationDate: '2026-11-13', practiceAttempt: '1', trainingCourse: 'K25',
    overallResult: 'BASIC_UNDERSTOOD', teacherComment: 'Đã hiểu vị trí điều khiển.', createdAt: '2026-11-13T03:00:00.000Z', updatedAt: '2026-11-13T03:00:00.000Z',
    evaluationData: { checklistItems: [{ order: 1, title: 'Mở cửa xe và lên xe an toàn', rating: 'UNDERSTOOD' }] },
  },
  {
    id: 'record-road', teacherName: 'Trần Trọng Thức', studentName: 'Cường Đường Trường', trainingType: 'ROAD', vehicleCategory: 'C1',
    vehicleNumber: '61C-246.80', evaluationDate: '2026-11-12', practiceAttempt: '7', trainingCourse: 'K24',
    overallResult: 'ROAD_PASSED', teacherComment: 'Giữ làn và tốc độ an toàn.', createdAt: '2026-11-12T03:00:00.000Z', updatedAt: '2026-11-12T03:00:00.000Z',
    evaluationData: { checklistItems: [{ order: 1, title: 'Giữ làn và khoảng cách', rating: 'GOOD' }] },
  },
]

async function checkPageWidth(page, assert, label) {
  const sizes = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, content: document.documentElement.scrollWidth }))
  assert(sizes.content <= sizes.viewport + 1, `${label}: trang bị tràn ngang ${sizes.content - sizes.viewport}px`)
}

export async function runAdminDataScenarios({ browser, offlineContext, baseUrl, artifactDir, assert }) {
  const context = await offlineContext(browser, { viewport: { width: 1440, height: 1000 } })
  const page = await context.newPage()
  try {
    await page.goto(new URL('/admin/giaovien/A@7979', baseUrl).href)
    await page.getByRole('button', { name: 'Phiếu đánh giá', exact: true }).waitFor()
    await page.evaluate((items) => window.__E2E_STORES__.replaceRecords(items), records)
    await page.getByRole('button', { name: 'An Sa Hình', exact: true }).waitFor()
    await checkPageWidth(page, assert, 'Tổng quan desktop')
    await page.screenshot({ path: path.join(artifactDir, 'admin-overview-desktop.png'), fullPage: true })

    await page.getByRole('button', { name: 'Phiếu đánh giá', exact: true }).click()
    await page.getByRole('heading', { name: '3 phiếu đánh giá', exact: true }).waitFor()
    await page.getByRole('button', { name: 'Theo giáo viên', exact: true }).click()
    const thucGroup = page.getByRole('button').filter({ hasText: 'Trần Trọng Thức' }).filter({ hasText: '2 phiếu' })
    await thucGroup.waitFor()
    await thucGroup.click()
    const teacherDialog = page.getByRole('dialog', { name: 'Phiếu của giáo viên Trần Trọng Thức', exact: true })
    await teacherDialog.waitFor()
    assert(await teacherDialog.getByRole('button', { name: 'An Sa Hình', exact: true }).count() === 1 && await teacherDialog.getByRole('button', { name: 'Cường Đường Trường', exact: true }).count() === 1, 'Nhóm giáo viên phải gồm đúng hai phiếu của giáo viên đã chọn')
    assert(await teacherDialog.getByRole('button', { name: 'Bình Cơ Bản', exact: true }).count() === 0, 'Nhóm không được lẫn phiếu giáo viên khác')
    await teacherDialog.getByRole('button', { name: 'Đóng danh sách giáo viên', exact: true }).click()
    await page.getByRole('button', { name: 'Danh sách phiếu', exact: true }).click()

    await page.getByLabel('Tìm giáo viên', { exact: true }).fill('tran trong thuc')
    await page.getByRole('heading', { name: '2 phiếu đánh giá', exact: true }).waitFor()
    await page.getByLabel('Loại đánh giá', { exact: true }).selectOption('EXAM')
    await page.getByLabel('Hạng xe', { exact: true }).selectOption('BSS')
    await page.getByLabel('Tìm khóa học', { exact: true }).fill('K24')
    await page.getByRole('heading', { name: '1 phiếu đánh giá', exact: true }).waitFor()
    const csvPromise = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Xuất CSV', exact: true }).click()
    const csvDownload = await csvPromise
    const csv = await readFile(await csvDownload.path(), 'utf8')
    assert(csv.includes('An Sa Hình') && !csv.includes('Bình Cơ Bản') && !csv.includes('Cường Đường Trường'), 'CSV phải xuất đúng kết quả bộ lọc hiện tại')
    assert(csv.includes('51H-123.45') && csv.includes('Trần Trọng Thức'), 'CSV phải giữ biển số và giáo viên của phiếu')

    await page.getByRole('button', { name: 'Xem chi tiết phiếu của An Sa Hình', exact: true }).click()
    const detail = page.getByRole('dialog', { name: 'Chi tiết phiếu của học viên An Sa Hình', exact: true })
    await detail.waitFor()
    const detailText = await detail.innerText()
    for (const content of ['Tuột dốc', 'Giữ phanh trước khi chuyển sang ga.', 'Phản ứng chậm', 'Quan sát tín hiệu khẩn cấp.', '51H-123.45']) {
      assert(detailText.includes(content), `Chi tiết phiếu thiếu dữ liệu đã lưu: ${content}`)
    }
    await detail.screenshot({ path: path.join(artifactDir, 'admin-record-detail-desktop.png') })
    const historicalDownloadPromise = page.waitForEvent('download')
    await detail.getByRole('button', { name: 'Tải ảnh PNG', exact: true }).click()
    const historicalDownload = await historicalDownloadPromise
    const historicalPng = await readFile(await historicalDownload.path())
    assert(historicalDownload.suggestedFilename().endsWith('.png') && historicalPng.readUInt32BE(16) >= 1080 && historicalPng.readUInt32BE(20) >= 1920, 'Phiếu đã lưu phải dựng lại được PNG đủ khổ từ trang quản trị')

    await detail.getByRole('button', { name: 'Sửa phiếu', exact: true }).click()
    const editor = page.getByRole('dialog', { name: 'Sửa phiếu đánh giá', exact: true })
    await editor.waitFor()
    await page.setViewportSize({ width: 320, height: 844 })
    await checkPageWidth(page, assert, 'Sửa phiếu 320px')
    assert(await editor.evaluate((node) => node.scrollWidth <= node.clientWidth + 1), 'Biểu mẫu sửa phiếu không được tràn ngang')
    await editor.screenshot({ path: path.join(artifactDir, 'admin-edit-320.png') })
    await page.setViewportSize({ width: 1440, height: 1000 })
    await editor.getByLabel('Biển số xe', { exact: true }).fill('61h-999.98')
    await editor.getByLabel('Nhận xét của giáo viên', { exact: true }).fill('Đã sửa nhận xét cuối buổi.')
    await editor.getByLabel('Kết quả chung', { exact: true }).selectOption('NEEDS_IMPROVEMENT')
    await editor.getByText('Nội dung đánh giá chi tiết', { exact: true }).click()
    const hillEditor = editor.getByRole('group', { name: 'Dừng xe và khởi hành trên dốc', exact: true })
    await hillEditor.getByLabel('Mức đánh giá', { exact: true }).selectOption('NOTICE')
    await hillEditor.getByLabel('Ghi chú', { exact: true }).fill('Ghi chú bài dốc đã sửa.')
    await page.evaluate(() => window.__E2E_STORES__.failNext('updateEvaluation', { code: 'permission-denied' }))
    const saveEdit = editor.getByRole('button', { name: 'Lưu thay đổi', exact: true })
    await saveEdit.click()
    await editor.getByRole('alert').filter({ hasText: 'Tài khoản chưa có quyền' }).waitFor()
    assert(await page.evaluate(() => window.__E2E_STORES__.snapshot().records.find((record) => record.id === 'record-exam').vehicleNumber) === '51H-123.45', 'Lỗi sửa phiếu không được đổi dữ liệu')
    await saveEdit.click()
    await editor.waitFor({ state: 'detached' })
    await detail.getByText('Ghi chú bài dốc đã sửa.', { exact: false }).waitFor()
    const edited = await page.evaluate(() => window.__E2E_STORES__.snapshot().records.find((record) => record.id === 'record-exam'))
    assert(edited.createdAt === records[0].createdAt && edited.vehicleNumber === '61H-999.98' && edited.evaluationData.vehicleNumber === edited.vehicleNumber, 'Sửa phiếu phải giữ bản ghi gốc và đồng bộ biển số khi dựng lại ảnh')
    assert(edited.overallResult === 'NEEDS_IMPROVEMENT' && edited.evaluationData.finalConclusion === edited.overallResult && edited.evaluationData.lessons[0].status === 'NOTICE', 'Kết quả và chi tiết được cập nhật trên cùng bản ghi')

    await detail.getByRole('button', { name: 'Đóng chi tiết', exact: true }).click()
    await page.getByRole('button', { name: 'Xóa bộ lọc', exact: true }).click()
    await page.getByLabel('Từ ngày', { exact: true }).fill('2026-11-13')
    await page.getByLabel('Đến ngày', { exact: true }).fill('2026-11-13')
    await page.getByRole('heading', { name: '1 phiếu đánh giá', exact: true }).waitFor()
    assert(await page.getByRole('button', { name: 'Bình Cơ Bản', exact: true }).count() === 1, 'Khoảng ngày phải lọc theo ngày đánh giá')
    await page.getByLabel('Từ ngày', { exact: true }).fill('2026-11-14')
    await page.getByRole('alert').filter({ hasText: 'Ngày bắt đầu' }).waitFor()
    await page.getByRole('heading', { name: 'Chưa tìm thấy phiếu phù hợp', exact: true }).waitFor()
    await page.getByRole('button', { name: 'Đặt lại bộ lọc', exact: true }).click()
    await page.getByRole('heading', { name: '3 phiếu đánh giá', exact: true }).waitFor()
    await page.getByLabel('Tìm học viên', { exact: true }).fill('không tồn tại')
    await page.getByRole('heading', { name: 'Chưa tìm thấy phiếu phù hợp', exact: true }).waitFor()
    await page.getByRole('button', { name: 'Đặt lại bộ lọc', exact: true }).click()

    for (const width of [390, 320]) {
      await page.setViewportSize({ width, height: 844 })
      await checkPageWidth(page, assert, `Danh sách phiếu ${width}px`)
      await page.screenshot({ path: path.join(artifactDir, `admin-records-${width}.png`), fullPage: true })
    }
    await page.setViewportSize({ width: 1440, height: 1000 })
    await verifyDeleteDialog({ page, assert, openButton: page.getByRole('button', { name: 'Xóa phiếu của An Sa Hình', exact: true }), title: 'Xóa phiếu đánh giá?', confirmLabel: 'Xóa phiếu', operation: 'deleteEvaluation', collection: 'records', id: 'record-exam' })
    await page.getByRole('heading', { name: '2 phiếu đánh giá', exact: true }).waitFor()
    assert(await page.getByRole('button', { name: 'An Sa Hình', exact: true }).count() === 0, 'Xóa thành công phải cập nhật danh sách realtime')

    await page.getByRole('button', { name: 'Giáo viên & xe', exact: true }).click()
    const directory = page.getByRole('region', { name: 'Danh mục giáo viên và xe', exact: true })
    await directory.waitFor()
    await page.evaluate(() => window.__E2E_STORES__.setDirectoryStatus({
      teacherError: 'permission-denied: Không có quyền tải danh mục giáo viên.',
      vehicleError: 'permission-denied: Không có quyền tải danh mục xe.',
    }))
    await directory.getByRole('alert').filter({ hasText: 'Không có quyền tải danh mục giáo viên' }).waitFor()
    assert(await directory.getByRole('button', { name: 'Thêm giáo viên', exact: true }).isDisabled() && await directory.getByRole('button', { name: 'Thêm xe', exact: true }).isDisabled(), 'Quyền đọc bị từ chối phải chặn sửa danh mục thay vì báo thành công giả')
    await page.evaluate(() => window.__E2E_STORES__.setDirectoryStatus({ teacherError: '', vehicleError: '' }))
    await directory.getByRole('button', { name: 'Tải lại danh mục', exact: true }).click()
    await directory.getByRole('button', { name: 'Thêm giáo viên', exact: true }).waitFor()
    assert(await directory.getByRole('button', { name: 'Thêm giáo viên', exact: true }).isEnabled() && await directory.getByRole('button', { name: 'Thêm xe', exact: true }).isEnabled(), 'Sửa quyền và tải lại phải khôi phục thao tác thêm giáo viên/xe')
    await page.screenshot({ path: path.join(artifactDir, 'admin-directory-page-desktop.png'), fullPage: true })
    for (const width of [390, 320]) {
      await page.setViewportSize({ width, height: 844 })
      await checkPageWidth(page, assert, `Danh mục ${width}px`)
      await page.screenshot({ path: path.join(artifactDir, `admin-directory-page-${width}.png`), fullPage: true })
    }
  } finally {
    await context.close()
  }
}
