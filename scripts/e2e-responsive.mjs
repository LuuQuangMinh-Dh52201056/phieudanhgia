import { chromium } from 'playwright-core'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'

const baseUrl = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:4173'
const artifactDir = path.resolve('artifacts/e2e')
if ((await (await fetch(new URL('/__e2e_mock_mode', baseUrl))).json()).store !== 'memory-only') throw new Error('Responsive QA requires the memory-only server.')
await mkdir(artifactDir, { recursive: true })
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true })
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
  await page.route('**/*', (route) => {
    const url = new URL(route.request().url())
    return url.origin === new URL(baseUrl).origin || ['blob:', 'data:'].includes(url.protocol) ? route.continue() : route.abort('blockedbyclient')
  })
  const capture = async (stage) => {
    for (const width of [1440, 390, 320]) {
      await page.setViewportSize({ width, height: width === 1440 ? 1000 : 844 })
      await page.screenshot({ path: path.join(artifactDir, `flow-${stage}-${width}.png`), fullPage: true })
      const sizes = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, content: document.documentElement.scrollWidth }))
      if (sizes.content > sizes.viewport + 1) throw new Error(`${stage} at ${width}px overflows by ${sizes.content - sizes.viewport}px`)
    }
    await page.setViewportSize({ width: 1440, height: 1000 })
  }
  await page.goto(baseUrl)
  await page.getByRole('combobox', { name: 'Giáo viên hướng dẫn', exact: true }).waitFor()
  await capture('teacher')
  await page.getByRole('combobox', { name: 'Giáo viên hướng dẫn', exact: true }).selectOption({ label: 'Trần Trọng Thức' })
  await page.getByRole('button', { name: 'Tiếp tục', exact: true }).click()
  await page.getByRole('button', { name: 'HẠNG XE B SỐ SÀN' }).click()
  await page.getByRole('combobox', { name: 'Biển số xe', exact: true }).selectOption({ label: '51H-123.45' })
  await capture('vehicle')
  await page.getByRole('button', { name: 'Tiếp tục', exact: true }).click()
  await capture('training')
  await page.getByTestId('training-basic').click()
  await page.getByLabel('Họ và tên học viên', { exact: true }).fill('Nguyễn Văn An')
  await page.getByRole('combobox', { name: 'Lần tập thứ', exact: true }).selectOption('7')
  await page.getByLabel('Khóa đào tạo', { exact: true }).fill('K24-2026')
  await capture('information')
  await page.getByRole('button', { name: 'Bắt đầu đánh giá', exact: true }).click()
  await page.getByRole('button', { name: 'Đánh dấu tất cả là Đã hiểu', exact: true }).click()
  await page.getByTestId('check-basic-pedals-NEEDS_WORK').click()
  await page.getByTestId('overall-BASIC_NEEDS_WORK').click()
  await page.locator('.teacher-comment-card textarea').fill('Học viên đã nắm các thao tác cơ bản. Cần luyện thêm phối hợp bàn đạp và quan sát trước khi chuyển hướng.')
  await capture('evaluation')
  await page.getByRole('button', { name: 'Xem phiếu đánh giá', exact: true }).click()
  await page.getByTestId('evaluation-report').waitFor()
  await capture('report')
  console.log('RESPONSIVE_QA_OK: six stages at 1440, 390 and 320px; no document overflow')
} finally {
  await browser.close()
}
