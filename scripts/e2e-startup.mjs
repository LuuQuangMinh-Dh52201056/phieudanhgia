import path from 'node:path'

export async function runStartupScenarios({ browser, offlineContext, baseUrl, artifactDir, assert }) {
  const scenarios = [
    {
      name: 'missing-firebase',
      message: 'Thiếu cấu hình Firebase: apiKey, authDomain, projectId, appId',
      heading: 'Chưa thiết lập Firebase',
      pathname: '/admin/giaovien/A@7979',
      setup: true,
    },
    {
      name: 'generic-module-error',
      message: 'Lỗi module thử nghiệm không liên quan cấu hình',
      heading: 'Chưa thể mở ứng dụng',
      pathname: '/',
      setup: false,
    },
  ]
  const environmentNames = ['VITE_FIREBASE_API_KEY', 'VITE_FIREBASE_AUTH_DOMAIN', 'VITE_FIREBASE_PROJECT_ID', 'VITE_FIREBASE_APP_ID']

  for (const scenario of scenarios) {
    const context = await offlineContext(browser, { viewport: { width: 390, height: 844 } })
    const page = await context.newPage()
    const uncaughtErrors = []
    let interceptedModules = 0
    page.on('pageerror', (error) => uncaughtErrors.push(error.message))
    try {
      // Replace only the root application module. The real main/bootstrap and
      // startup-error component must handle this failed dynamic import.
      await page.route('**/src/App.tsx*', (route) => {
        interceptedModules += 1
        return route.fulfill({
          status: 200,
          contentType: 'application/javascript',
          body: `throw new Error(${JSON.stringify(scenario.message)});`,
        })
      })
      await page.goto(new URL(scenario.pathname, baseUrl).href)
      await page.getByRole('heading', { name: scenario.heading, exact: true }).waitFor({ state: 'visible' })
      assert(interceptedModules > 0, `${scenario.name}: chưa mô phỏng lỗi tải module App`)
      const visibleText = await page.locator('body').innerText()
      if (scenario.setup) {
        for (const name of environmentNames) assert(visibleText.includes(name), `Thiếu hướng dẫn cấu hình ${name}`)
        assert(visibleText.includes('npm.cmd run test:server'), 'Trang lỗi thiết lập phải hướng dẫn chạy bản dùng thử offline')
        const demoLink = page.getByRole('link', { name: 'Mở bản dùng thử', exact: true })
        const demoUrl = new URL(await demoLink.getAttribute('href'), page.url())
        assert(demoUrl.port === '4173', 'Liên kết dùng thử phải mở mock server cổng 4173')
        assert(demoUrl.pathname === scenario.pathname, 'Liên kết dùng thử phải giữ đường dẫn quản trị đang mở')
      } else {
        assert(await page.getByRole('heading', { name: 'Chưa thiết lập Firebase', exact: true }).count() === 0, 'Lỗi module khác không được chẩn đoán nhầm là thiếu Firebase')
        assert(environmentNames.every((name) => !visibleText.includes(name)), 'Lỗi module khác không được hiển thị panel cấu hình Firebase')
      }
      assert(uncaughtErrors.length === 0, `${scenario.name}: bootstrap để lọt lỗi chưa xử lý: ${uncaughtErrors.join(', ')}`)
      await page.screenshot({ path: path.join(artifactDir, `startup-${scenario.name}-mobile.png`), fullPage: true })
    } finally {
      await context.close()
    }
  }
}
