import path from 'node:path'

const signedOut = { loading: false, configured: true, user: null, isAuthorized: false, error: '' }
const adminPath = '/admin/giaovien/A@7979'

async function contextWithSession(browser, offlineContext, initialSession) {
  const context = await offlineContext(browser, { viewport: { width: 390, height: 844 } })
  await context.addInitScript((session) => { window.__E2E_AUTH_INITIAL__ = session }, initialSession)
  return context
}

async function assertAdminHidden(page, assert, label) {
  assert(await page.getByRole('region', { name: 'Danh mục giáo viên và xe', exact: true }).count() === 0, `${label}: danh mục quản trị không được mount`)
  assert(await page.getByRole('button', { name: 'Giáo viên & xe', exact: true }).count() === 0, `${label}: không được hiển thị điều hướng quản trị`)
  await page.waitForFunction(() => window.__E2E_STORES__.snapshot().activeRecordSubscriptions === 0)
  const recordSubscriptions = await page.evaluate(() => window.__E2E_STORES__.snapshot().activeRecordSubscriptions)
  assert(recordSubscriptions === 0, `${label}: không được tiếp tục đọc phiếu riêng tư`)
}

export async function runAdminAuthScenarios({ browser, offlineContext, baseUrl, artifactDir, assert }) {
  const context = await contextWithSession(browser, offlineContext, signedOut)
  try {
    const page = await context.newPage()
    await page.goto(new URL(adminPath, baseUrl).href)
    await page.getByRole('heading', { name: 'Đăng nhập quản trị', exact: true }).waitFor()
    await assertAdminHidden(page, assert, 'Chưa đăng nhập')
    await page.screenshot({ path: path.join(artifactDir, 'admin-login-mobile.png'), fullPage: true })
    await page.setViewportSize({ width: 1440, height: 1000 })
    await page.screenshot({ path: path.join(artifactDir, 'admin-login-desktop.png'), fullPage: true })
    await page.setViewportSize({ width: 390, height: 844 })

    await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click()
    const emptyLogin = await page.evaluate(() => ({
      calls: window.__E2E_AUTH__.snapshot().loginCalls.length,
      emailValid: document.querySelector('#admin-auth-email').checkValidity(),
      passwordValid: document.querySelector('#admin-auth-password').checkValidity(),
    }))
    assert(emptyLogin.calls === 0 && !emptyLogin.emailValid && !emptyLogin.passwordValid, 'Form đăng nhập trống phải bị browser required chặn trước dịch vụ')

    await page.getByLabel('Email quản trị', { exact: true }).fill('admin@example.invalid')
    await page.getByLabel('Mật khẩu', { exact: true }).fill('test-only-password')
    await page.evaluate(() => window.__E2E_AUTH__.configureSignIn({ outcome: 'error' }))
    await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click()
    await page.getByRole('alert').filter({ hasText: 'Email hoặc mật khẩu không đúng' }).waitFor()
    assert(await page.getByLabel('Mật khẩu', { exact: true }).inputValue() === '', 'Đăng nhập lỗi phải xóa giá trị mật khẩu')
    await assertAdminHidden(page, assert, 'Sai thông tin đăng nhập')

    await page.evaluate(() => window.__E2E_AUTH__.configureSignIn({ outcome: 'denied' }))
    await page.getByLabel('Mật khẩu', { exact: true }).fill('test-only-password')
    await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click()
    await page.getByRole('alert').filter({ hasText: 'không có quyền quản trị' }).waitFor()
    assert((await page.evaluate(() => window.__E2E_AUTH__.snapshot())).user === null, 'UID chưa cấp quyền phải được đưa về phiên đã đăng xuất')
    await assertAdminHidden(page, assert, 'UID chưa cấp quyền')

    await page.evaluate(() => {
      window.__E2E_AUTH__.configureSignIn({ outcome: 'authorized' })
      window.__E2E_AUTH__.holdSignIn()
    })
    await page.getByLabel('Mật khẩu', { exact: true }).fill('test-only-password')
    await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click()
    await page.getByRole('button', { name: 'Đang đăng nhập...', exact: true }).waitFor()
    await assertAdminHidden(page, assert, 'Đang xác thực')
    await page.evaluate(() => window.__E2E_AUTH__.releaseSignIn())
    await page.getByRole('region', { name: 'Phiên quản trị', exact: true }).waitFor()
    await page.getByRole('button', { name: 'Giáo viên & xe', exact: true }).click()
    const directory = page.getByRole('region', { name: 'Danh mục giáo viên và xe', exact: true })
    await directory.waitFor()
    await directory.getByRole('button', { name: 'Thêm giáo viên', exact: true }).click()
    await directory.getByLabel('Tên giáo viên', { exact: true }).fill('Giáo viên phiên đăng nhập')
    await directory.getByRole('button', { name: 'Lưu giáo viên', exact: true }).click()
    await directory.getByRole('button', { name: 'Sửa giáo viên Giáo viên phiên đăng nhập', exact: true }).waitFor()

    await page.getByRole('button', { name: 'Đăng xuất', exact: true }).click()
    await page.getByRole('heading', { name: 'Đăng nhập quản trị', exact: true }).waitFor()
    await assertAdminHidden(page, assert, 'Sau đăng xuất')
    assert(await page.getByText('Giáo viên phiên đăng nhập', { exact: true }).count() === 0, 'Đăng xuất phải gỡ thông tin quản trị cũ khỏi DOM')

    await page.evaluate(() => window.__E2E_AUTH__.setSession({
      user: { uid: 'e2e-not-authorized', email: 'unapproved@example.invalid' },
      isAuthorized: false,
      error: 'Tài khoản này không có quyền quản trị danh mục.',
    }))
    await page.getByText('unapproved@example.invalid', { exact: true }).waitFor()
    await page.getByRole('alert').filter({ hasText: 'không có quyền quản trị' }).waitFor()
    await assertAdminHidden(page, assert, 'Phiên UID khác')
    await page.getByRole('button', { name: 'Đăng xuất', exact: true }).click()
    await page.getByLabel('Email quản trị', { exact: true }).waitFor()
  } finally {
    await context.close()
  }

  const unconfigured = await contextWithSession(browser, offlineContext, { ...signedOut, configured: false })
  try {
    const page = await unconfigured.newPage()
    await page.goto(new URL(adminPath, baseUrl).href)
    await page.getByRole('heading', { name: 'Thiết lập tài khoản quản trị', exact: true }).waitFor()
    assert((await page.locator('body').innerText()).includes('VITE_FIREBASE_ADMIN_UIDS'), 'Thiếu cấu hình phải hướng dẫn khai báo UID quản trị')
    assert(await page.getByLabel('Email quản trị', { exact: true }).count() === 0, 'Chưa cấu hình UID không được hiển thị form đăng nhập gây nhầm lẫn')
    await assertAdminHidden(page, assert, 'Chưa cấu hình quản trị')
    await page.screenshot({ path: path.join(artifactDir, 'admin-auth-setup-mobile.png'), fullPage: true })
  } finally {
    await unconfigured.close()
  }

  const loading = await contextWithSession(browser, offlineContext, { ...signedOut, loading: true })
  try {
    const page = await loading.newPage()
    await page.goto(new URL(adminPath, baseUrl).href)
    await page.getByRole('status').filter({ hasText: 'Đang kiểm tra phiên đăng nhập' }).waitFor()
    await assertAdminHidden(page, assert, 'Chờ khôi phục phiên')
    await page.evaluate(() => window.__E2E_AUTH__.setSession({ loading: false }))
    await page.getByRole('heading', { name: 'Đăng nhập quản trị', exact: true }).waitFor()
  } finally {
    await loading.close()
  }
}
