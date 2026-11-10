import { chromium } from 'playwright-core'
import { copyFile, mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const baseUrl = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:4173'
const outputLabel = process.argv[2] ?? 'after'
const artifactDir = path.resolve('artifacts/e2e')
const marker = await (await fetch(new URL('/__e2e_mock_mode', baseUrl))).json()
if (marker.store !== 'memory-only') throw new Error('Layout test requires the memory-only E2E server.')
await mkdir(artifactDir, { recursive: true })

const browser = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true })
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
  await page.route('**/*', (route) => {
    const url = new URL(route.request().url())
    return url.origin === new URL(baseUrl).origin || ['blob:', 'data:'].includes(url.protocol)
      ? route.continue()
      : route.abort('blockedbyclient')
  })
  await page.goto(baseUrl)
  await page.getByRole('combobox', { name: 'Giáo viên hướng dẫn', exact: true }).selectOption({ label: 'Trần Trọng Thức' })
  await page.getByRole('button', { name: 'Tiếp tục', exact: true }).click()
  await page.getByRole('button', { name: 'HẠNG XE B SỐ SÀN' }).click()
  await page.getByRole('combobox', { name: 'Biển số xe', exact: true }).selectOption({ label: '51H-123.45' })
  await page.getByRole('button', { name: 'Tiếp tục', exact: true }).click()
  await page.getByTestId('training-basic').click()
  await page.getByLabel('Họ và tên học viên').fill('Học viên kiểm tra bố cục')
  await page.getByRole('combobox', { name: 'Lần tập thứ', exact: true }).selectOption('7')
  await page.getByLabel('Khóa đào tạo').fill('K24-2026')
  await page.getByRole('button', { name: 'Bắt đầu đánh giá' }).click()
  await page.getByRole('button', { name: 'Đánh dấu tất cả là Đã hiểu' }).click()
  await page.getByTestId('overall-BASIC_UNDERSTOOD').click()
  await page.locator('.teacher-comment-card textarea').fill('Học viên nắm được các thao tác cơ bản. Cần luyện thêm khả năng quan sát và phối hợp bàn đạp để điều khiển xe an toàn.')
  await page.getByRole('button', { name: 'Xem phiếu đánh giá' }).click()
  await page.getByTestId('evaluation-report').waitFor()
  await page.evaluate(() => document.fonts.ready)
  const information = await page.locator('.checklist-report-info > div').evaluateAll((fields) => Object.fromEntries(fields.map((field) => [field.querySelector('span').textContent, field.querySelector('b').textContent])))
  if (information['Hạng xe / Biển số:'] !== 'B SỐ SÀN · 51H-123.45') throw new Error('The report must display the selected vehicle category and plate together.')
  if (information['Giáo viên hướng dẫn:'] !== 'Trần Trọng Thức') throw new Error('The selected teacher must appear in the report information.')
  if (information['Lần tập thứ:'] !== '7') throw new Error('The selected attempt must appear in the report information.')

  const metrics = await page.getByTestId('evaluation-report').evaluate((report) => {
    const reportRect = report.getBoundingClientRect()
    const scale = reportRect.width / 1080
    const rect = (selector) => {
      const element = report.querySelector(selector)
      const value = element.getBoundingClientRect()
      return { top: (value.top - reportRect.top) / scale, bottom: (value.bottom - reportRect.top) / scale, height: value.height / scale, scrollHeight: element.scrollHeight, clientHeight: element.clientHeight }
    }
    const textRect = (selector) => {
      const range = document.createRange()
      range.selectNodeContents(report.querySelector(selector))
      const value = range.getBoundingClientRect()
      return { top: (value.top - reportRect.top) / scale, bottom: (value.bottom - reportRect.top) / scale }
    }
    return {
      reportHeight: report.offsetHeight,
      rows: report.querySelectorAll('.checklist-report-table__row').length,
      body: rect('.checklist-report-body'),
      table: rect('.checklist-report-table'),
      firstRow: rect('.checklist-report-table__row'),
      overall: rect('.checklist-report-overall'),
      comment: rect('.checklist-report-comment'),
      teacherColumn: rect('.checklist-report-comment > div'),
      signature: rect('.checklist-report-comment > div strong'),
      commentText: textRect('.checklist-report-comment > p'),
      signatureText: textRect('.checklist-report-comment > div strong'),
      footer: rect('.checklist-report-footer'),
    }
  })
  await writeFile(path.join(artifactDir, `basic-layout-${outputLabel}.json`), JSON.stringify(metrics, null, 2))
  console.log(JSON.stringify(metrics, null, 2))
  const downloadPromise = page.waitForEvent('download')
  await page.getByTestId('export-download').click()
  const download = await downloadPromise
  await copyFile(await download.path(), path.join(artifactDir, `basic-layout-${outputLabel}.png`))
  if (outputLabel !== 'before') {
    if (metrics.comment.bottom > metrics.body.bottom + 1 || metrics.signature.bottom > metrics.body.bottom + 1 || metrics.signatureText.bottom > metrics.footer.top + 1) {
      throw new Error('The comment/signature is clipped by the report body or footer.')
    }
    if (metrics.commentText.bottom > metrics.comment.bottom + 1) throw new Error('The comment text overflows its container.')
  }
} finally {
  await browser.close()
}
