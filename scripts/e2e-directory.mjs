import path from 'node:path'
import { verifyDeleteDialog } from './e2e-delete-dialog.mjs'

export async function runDirectoryScenarios({ browser, offlineContext, baseUrl, assert, chooseTeacher, chooseVehicle, enterStudent, artifactDir }) {
  const context = await offlineContext(browser, { viewport: { width: 1440, height: 1000 } })
  const page = await context.newPage()
  try {
    await page.goto(baseUrl)
    await chooseTeacher(page)
    const plate = page.getByRole('combobox', { name: 'Biển số xe', exact: true })
    await page.getByRole('button', { name: 'HẠNG XE B SỐ SÀN' }).click()
    await plate.selectOption({ label: '51H-123.45' })
    const manualOptions = await plate.locator('option').allTextContents()
    assert(!manualOptions.some((text) => text.includes('51K-678.90') || text.includes('61C-246.80')), 'BSS chỉ được liệt kê xe BSS')

    await page.getByRole('button', { name: 'HẠNG XE HẠNG C1' }).click()
    assert(await plate.inputValue() === '', 'Đổi từ BSS sang C1 phải bỏ biển số BSS đã chọn')
    await plate.selectOption({ label: '61C-246.80' })
    const c1Options = await plate.locator('option').allTextContents()
    assert(!c1Options.some((text) => text.includes('51H-123.45') || text.includes('51K-678.90')), 'C1 chỉ được liệt kê xe C1')

    // A realtime removal must not leave a stale selected vehicle in the form.
    await page.evaluate(() => {
      const snapshot = window.__E2E_STORES__.snapshot()
      window.__E2E_STORES__.replaceDirectory({ vehicles: snapshot.vehicles.filter((vehicle) => vehicle.id !== 'vehicle-c1') })
    })
    await page.waitForFunction(() => document.querySelector('select[aria-label="Biển số xe"]')?.value === '')
    assert(!(await plate.locator('option').allTextContents()).some((text) => text.includes('61C-246.80')), 'Xe đã xóa phải biến mất khỏi danh sách realtime')
    await page.getByRole('button', { name: 'Tiếp tục', exact: true }).click()
    await page.getByTestId('training-basic').click()
    await enterStudent(page, 'Học viên không có xe')
    await page.getByRole('button', { name: 'Đánh dấu tất cả là Đã hiểu' }).click()
    await page.getByTestId('overall-BASIC_UNDERSTOOD').click()
    await page.getByRole('button', { name: 'Xem phiếu đánh giá' }).click()
    await page.getByTestId('evaluation-report').waitFor({ state: 'visible' })
    await page.getByTestId('save-evaluation').click()
    await page.getByRole('heading', { name: 'Phiếu đánh giá đã lưu' }).waitFor()
    const optionalVehicleRecord = await page.evaluate(() => window.__E2E_STORES__.snapshot().records[0])
    assert(optionalVehicleRecord.teacherName === 'Trần Trọng Thức', 'Giáo viên chung phải được giữ khi chuyển hạng xe')
    assert(!optionalVehicleRecord.vehicleNumber, 'Xe đã xóa không được lưu nhầm vào phiếu; chưa có xe vẫn được lập phiếu')
    assert(optionalVehicleRecord.vehicleCategory === 'C1', 'Phiếu phải lưu hạng xe vừa chọn')
    assert(optionalVehicleRecord.practiceAttempt === '7', 'Lần tập thứ phải được lưu đúng từ dropdown')

    // Switch only the local SPA view so the in-memory store and saved record survive.
    await page.evaluate(() => {
      history.pushState({}, '', '/admin/giaovien/A@7979')
      window.dispatchEvent(new PopStateEvent('popstate'))
    })
    await page.getByRole('button', { name: 'Giáo viên & xe', exact: true }).click()
    const directory = page.getByRole('region', { name: 'Danh mục giáo viên và xe', exact: true })
    await directory.waitFor({ state: 'visible' })
    await directory.screenshot({ path: path.join(artifactDir, 'admin-directory-desktop.png') })
    await page.setViewportSize({ width: 390, height: 844 })
    await directory.screenshot({ path: path.join(artifactDir, 'admin-directory-mobile.png') })
    await page.setViewportSize({ width: 320, height: 844 })
    const directoryWidth = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, content: document.documentElement.scrollWidth }))
    assert(directoryWidth.content <= directoryWidth.viewport + 1, 'Danh mục giáo viên/xe phải vừa màn hình 320px')
    await directory.screenshot({ path: path.join(artifactDir, 'admin-directory-320.png') })
    await page.setViewportSize({ width: 1440, height: 1000 })
    await directory.getByRole('button', { name: 'Thêm giáo viên', exact: true }).click()
    await directory.getByLabel('Tên giáo viên', { exact: true }).fill('Giáo viên E2E')
    await directory.getByRole('button', { name: 'Lưu giáo viên', exact: true }).click()
    await directory.getByRole('button', { name: 'Sửa giáo viên Giáo viên E2E', exact: true }).waitFor()

    await directory.getByRole('button', { name: 'Sửa giáo viên Giáo viên E2E', exact: true }).click()
    await directory.getByLabel('Tên giáo viên', { exact: true }).fill('Giáo viên E2E đã sửa')
    await directory.getByRole('button', { name: 'Lưu giáo viên', exact: true }).click()
    await directory.getByRole('button', { name: 'Sửa giáo viên Giáo viên E2E đã sửa', exact: true }).waitFor()
    assert(await directory.getByRole('button', { name: 'Sửa giáo viên Giáo viên E2E', exact: true }).count() === 0, 'Đổi tên phải cập nhật hàng giáo viên realtime')

    await directory.getByRole('tab', { name: 'BSS', exact: true }).click()
    await directory.getByRole('button', { name: 'Thêm xe', exact: true }).click()
    await directory.getByLabel('Biển số xe', { exact: true }).fill('61A-999.99')
    await directory.getByLabel('Hạng xe quản lý', { exact: true }).selectOption('B_MANUAL')
    await directory.getByRole('button', { name: 'Lưu xe', exact: true }).click()
    await directory.getByRole('button', { name: 'Sửa xe 61A-999.99', exact: true }).waitFor()

    await directory.getByRole('button', { name: 'Sửa xe 61A-999.99', exact: true }).click()
    await directory.getByLabel('Biển số xe', { exact: true }).fill('61C-999.99')
    await directory.getByLabel('Hạng xe quản lý', { exact: true }).selectOption('C1')
    await directory.getByRole('button', { name: 'Lưu xe', exact: true }).click()
    await directory.getByRole('tab', { name: 'C1', exact: true }).click()
    await directory.getByRole('button', { name: 'Sửa xe 61C-999.99', exact: true }).waitFor()
    assert(await directory.getByRole('button', { name: 'Sửa xe 61A-999.99', exact: true }).count() === 0, 'Đổi hạng và biển số phải cập nhật đúng nhóm xe')

    const deleteTargets = await page.evaluate(() => {
      const snapshot = window.__E2E_STORES__.snapshot()
      return {
        teacherId: snapshot.teachers.find((teacher) => teacher.name === 'Giáo viên E2E đã sửa').id,
        vehicleId: snapshot.vehicles.find((vehicle) => vehicle.plateNumber === '61C-999.99').id,
      }
    })
    await verifyDeleteDialog({ page, assert, openButton: directory.getByRole('button', { name: 'Xóa xe 61C-999.99', exact: true }), title: 'Xóa xe đào tạo?', confirmLabel: 'Xóa xe', operation: 'deleteVehicle', collection: 'vehicles', id: deleteTargets.vehicleId })
    await verifyDeleteDialog({ page, assert, openButton: directory.getByRole('button', { name: 'Xóa giáo viên Giáo viên E2E đã sửa', exact: true }), title: 'Xóa giáo viên?', confirmLabel: 'Xóa giáo viên', operation: 'deleteTeacher', collection: 'teachers', id: deleteTargets.teacherId })

    const afterCrud = await page.evaluate(() => window.__E2E_STORES__.snapshot())
    assert(afterCrud.records.length === 1 && afterCrud.records[0].teacherName === 'Trần Trọng Thức', 'CRUD danh mục không được thay đổi phiếu đánh giá đã lưu')
    assert(!afterCrud.teachers.some((teacher) => teacher.name.includes('E2E')), 'Xóa giáo viên phải cập nhật kho dữ liệu')
    assert(!afterCrud.vehicles.some((vehicle) => vehicle.plateNumber.includes('999.99')), 'Xóa xe phải cập nhật kho dữ liệu')

    // A newly added vehicle must become selectable without reloading the app.
    await directory.getByRole('button', { name: 'Thêm xe', exact: true }).click()
    await directory.getByLabel('Biển số xe', { exact: true }).fill('61C-246.80')
    await directory.getByLabel('Hạng xe quản lý', { exact: true }).selectOption('C1')
    await directory.getByRole('button', { name: 'Lưu xe', exact: true }).click()
    await directory.getByRole('button', { name: 'Sửa xe 61C-246.80', exact: true }).waitFor()
    await page.evaluate(() => {
      history.pushState({}, '', '/')
      window.dispatchEvent(new PopStateEvent('popstate'))
    })
    await chooseVehicle(page, 'HẠNG XE HẠNG C1', 'TẬP CƠ BẢN')
    assert(await page.getByRole('combobox', { name: 'Giáo viên hướng dẫn', exact: true }).count() === 0, 'Thông tin học viên không được cho nhập lại giáo viên tự do')
  } finally {
    await context.close()
  }
}
