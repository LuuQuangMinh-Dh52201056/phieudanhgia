const androidUserAgent = 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36'

async function completeCourse(page, helpers, studentName) {
  await page.goto(helpers.baseUrl)
  await helpers.chooseVehicle(page, 'HẠNG XE B SỐ SÀN')
  await helpers.enterStudent(page, studentName)
  await page.getByRole('button', { name: 'Đánh dấu bài còn lại là Tốt' }).click()
  await page.getByTestId('status-emergency-GOOD').click()
  await page.getByRole('button', { name: 'Xem phiếu đánh giá' }).click()
  await page.getByTestId('evaluation-report').waitFor({ state: 'visible' })
}

export async function runExportScenarios(helpers) {
  const { browser, offlineContext, assert } = helpers
  const androidOptions = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, userAgent: androidUserAgent }
  const context = await offlineContext(browser, androidOptions)
  try {
    await context.addInitScript(() => {
      window.__E2E_SHARE_CALLS__ = []
      window.__E2E_SHARE_MODE__ = 'cancel'
      window.__E2E_CAN_SHARE__ = true
      Object.defineProperty(navigator, 'canShare', { configurable: true, value: ({ files }) => window.__E2E_CAN_SHARE__ && files?.[0]?.type === 'image/png' })
      Object.defineProperty(navigator, 'share', {
        configurable: true,
        value: (data) => {
          window.__E2E_SHARE_CALLS__.push({
            keys: Object.keys(data),
            fileName: data.files[0].name,
            fileType: data.files[0].type,
            fileSize: data.files[0].size,
            active: navigator.userActivation.isActive,
          })
          return window.__E2E_SHARE_MODE__ === 'cancel'
            ? Promise.reject(new DOMException('User cancelled', 'AbortError'))
            : Promise.resolve()
        },
      })
    })
    const page = await context.newPage()
    await completeCourse(page, helpers, 'Học viên Android')
    assert(await page.evaluate(() => window.__E2E_STORES__.snapshot().records.length) === 0, 'Xem trước phiếu chưa được ghi Firebase')
    await page.locator('.conclusion-options button').nth(1).click()
    await page.getByRole('button', { name: 'Sửa đánh giá', exact: true }).click()
    await page.getByRole('button', { name: 'Xem phiếu đánh giá', exact: true }).click()
    assert(await page.evaluate(() => window.__E2E_STORES__.snapshot().records.length) === 0, 'Xem trước lần hai vẫn là cùng một bản nháp')
    await page.evaluate(() => window.__E2E_STORES__.failNext('saveEvaluation', { code: 'unavailable', message: 'Mạng gián đoạn khi lưu phiếu.' }))
    await page.getByTestId('save-evaluation').click()
    await page.getByRole('alert').filter({ hasText: 'Mạng gián đoạn khi lưu phiếu.' }).waitFor()
    await page.getByTestId('save-evaluation').click()
    const shareButton = page.getByTestId('export-share')
    await page.getByTestId('export-fallback').waitFor({ state: 'visible' })
    await page.waitForFunction(() => !document.querySelector('[data-testid="export-share"]')?.disabled)
    assert(await page.evaluate(() => window.__E2E_SHARE_CALLS__.length) === 0, 'Chuẩn bị PNG nền không được tự mở bảng chia sẻ')
    assert((await shareButton.innerText()).includes('Lưu vào bộ sưu tập'), 'Android phải ưu tiên thao tác lưu ảnh')
    const saved = await page.evaluate(() => window.__E2E_STORES__.snapshot().records)
    assert(saved.length === 1 && saved[0].overallResult === 'NEEDS_IMPROVEMENT' && saved[0].evaluationData.finalConclusion === 'NEEDS_IMPROVEMENT', 'Lưu một phiếu duy nhất với kết luận đã chốt')
    assert(await page.locator('.conclusion-options').count() === 0, 'Phiếu đã lưu không đổi kết luận cục bộ')

    await shareButton.click()
    await page.getByRole('status').filter({ hasText: 'Đã đóng bảng chia sẻ' }).waitFor()
    const cancelledCall = await page.evaluate(() => window.__E2E_SHARE_CALLS__[0])
    assert(cancelledCall.active, 'navigator.share phải được gọi trong lần chạm lưu ảnh đầu tiên')
    assert(cancelledCall.keys.length === 1 && cancelledCall.keys[0] === 'files', 'Native share chỉ được nhận tệp PNG để tương thích trình duyệt')
    assert(cancelledCall.fileType === 'image/png' && cancelledCall.fileName.endsWith('.png') && cancelledCall.fileSize > 0, 'Native share phải nhận PNG có dữ liệu')
    const fallbackUrl = await page.getByTestId('export-download-link').getAttribute('href')
    assert(fallbackUrl?.startsWith('blob:'), 'Sau hủy share phải giữ liên kết tệp PNG')

    await page.evaluate(() => { window.__E2E_SHARE_MODE__ = 'success' })
    await shareButton.click()
    await page.getByRole('status').filter({ hasText: 'Đã mở bảng chia sẻ' }).waitFor()
    assert(await page.evaluate(() => window.__E2E_SHARE_CALLS__.length) === 2, 'Hủy chia sẻ không được làm mất khả năng thử lại')

    await page.evaluate(() => { window.__E2E_CAN_SHARE__ = false })
    await shareButton.click()
    await page.getByRole('status').filter({ hasText: 'chưa hỗ trợ chia sẻ tệp PNG' }).waitFor()
    assert(await page.evaluate(() => window.__E2E_SHARE_CALLS__.length) === 2, 'canShare false không được gọi native share')
    const downloadPromise = page.waitForEvent('download')
    await page.getByTestId('export-download').click()
    const download = await downloadPromise
    assert(download.suggestedFilename() === cancelledCall.fileName, 'PNG tải xuống và PNG chia sẻ phải dùng cùng tên tệp')

    // Regression: old code revoked Blob URLs after one second while links stayed visible.
    await page.waitForTimeout(1100)
    const stillReadable = await page.evaluate(async (url) => {
      const response = await fetch(url)
      const blob = await response.blob()
      return blob.type === 'image/png' && blob.size > 0
    }, fallbackUrl)
    assert(stillReadable, 'Liên kết tải/mở ảnh phải còn hiệu lực khi khu vực fallback vẫn hiển thị')
    const popupPromise = page.waitForEvent('popup')
    await page.getByTestId('export-open-image').click()
    const popup = await popupPromise
    await popup.waitForFunction(() => document.querySelector('img')?.naturalWidth > 0)
    await popup.close()

    await page.getByRole('button', { name: 'Tạo phiếu mới' }).click()
    await page.getByTestId('export-fallback').waitFor({ state: 'detached' })
  } finally {
    await context.close()
  }

  const unsupported = await offlineContext(browser, androidOptions)
  try {
    await unsupported.addInitScript(() => {
      Object.defineProperty(navigator, 'share', { configurable: true, value: undefined })
      Object.defineProperty(navigator, 'canShare', { configurable: true, value: undefined })
      window.__E2E_ENCODE_WIDTHS__ = []
      const nativeToBlob = HTMLCanvasElement.prototype.toBlob
      HTMLCanvasElement.prototype.toBlob = function (callback, type, quality) {
        window.__E2E_ENCODE_WIDTHS__.push(this.width)
        if (this.width > 1080) callback(null)
        else nativeToBlob.call(this, callback, type, quality)
      }
    })
    const page = await unsupported.newPage()
    await completeCourse(page, helpers, 'Học viên máy ít bộ nhớ')
    await page.getByTestId('save-evaluation').click()
    await page.getByTestId('export-fallback').waitFor()
    await page.getByTestId('export-share').click()
    await page.waitForFunction(() => document.querySelector('[data-testid="export-fallback"] details')?.open)
    const downloadPromise = page.waitForEvent('download')
    await page.getByTestId('export-download').click()
    const download = await downloadPromise
    assert(download.suggestedFilename().endsWith('.png'), 'Không có native share vẫn phải tải được PNG')
    const widths = await page.evaluate(() => window.__E2E_ENCODE_WIDTHS__)
    assert(widths.includes(1080) && widths.some((width) => width > 1080), `Lỗi encode phải retry xuống mức tương thích 1x: ${widths.join(', ')}`)
    assert((await page.getByTestId('export-fallback').innerText()).includes('1080 × 1920px'), 'Fallback phải ghi kích thước PNG thực tế sau retry')
    await page.waitForFunction(() => document.querySelector('[data-testid="export-fallback"] img')?.naturalWidth === 1080)
  } finally {
    await unsupported.close()
  }
}
