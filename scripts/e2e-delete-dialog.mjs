async function hasStoredTarget(page, collection, id) {
  return page.evaluate(({ key, targetId }) => window.__E2E_STORES__.snapshot()[key].some((item) => item.id === targetId), { key: collection, targetId: id })
}

export async function verifyDeleteDialog({ page, assert, openButton, title, confirmLabel, operation, collection, id }) {
  assert(await hasStoredTarget(page, collection, id), `${title}: thiếu dữ liệu trước kiểm tra`)
  const initialCalls = await page.evaluate((name) => window.__E2E_STORES__.snapshot().operationCalls.filter((call) => call.operation === name).length, operation)
  await openButton.click()
  const dialog = page.getByRole('dialog', { name: title, exact: true })
  await dialog.waitFor()
  await dialog.getByRole('button', { name: 'Hủy', exact: true }).click()
  await dialog.waitFor({ state: 'hidden' })
  assert(await hasStoredTarget(page, collection, id), `${title}: hủy không được xóa dữ liệu`)
  const callsAfterCancel = await page.evaluate((name) => window.__E2E_STORES__.snapshot().operationCalls.filter((call) => call.operation === name).length, operation)
  assert(callsAfterCancel === initialCalls, `${title}: hủy không được gọi dịch vụ xóa`)

  await openButton.click()
  await dialog.waitFor()
  await page.evaluate((name) => window.__E2E_STORES__.failNext(name, { code: 'permission-denied', message: 'Không có quyền xóa dữ liệu. Kiểm tra Firestore Rules.' }), operation)
  await dialog.getByRole('button', { name: confirmLabel, exact: true }).click()
  await dialog.getByRole('alert').filter({ hasText: /quyền|permission/i }).waitFor()
  assert(await hasStoredTarget(page, collection, id), `${title}: bị từ chối quyền phải giữ dữ liệu và cho thử lại`)

  await page.evaluate((name) => window.__E2E_STORES__.failNext(name, { code: 'unavailable', message: 'Mất kết nối Internet. Vui lòng thử lại.' }), operation)
  await dialog.getByRole('button', { name: confirmLabel, exact: true }).click()
  await dialog.getByRole('alert').filter({ hasText: /kết nối|Internet|unavailable/i }).waitFor()
  assert(await hasStoredTarget(page, collection, id), `${title}: mất kết nối không được báo xóa thành công hoặc bỏ dữ liệu`)

  await page.evaluate((name) => window.__E2E_STORES__.holdOperation(name), operation)
  await dialog.getByRole('button', { name: confirmLabel, exact: true }).click()
  await page.waitForFunction(({ name, expected }) => window.__E2E_STORES__.snapshot().operationCalls.filter((call) => call.operation === name).length >= expected, { name: operation, expected: initialCalls + 3 })
  assert(await hasStoredTarget(page, collection, id), `${title}: không được xóa trước khi dịch vụ hoàn tất`)
  assert(await dialog.getByTestId('confirm-action').isDisabled(), `${title}: đang xóa phải chặn nhấn xác nhận trùng`)
  assert(await dialog.isVisible(), `${title}: đang chờ dịch vụ phải giữ hộp xác nhận`)
  await page.evaluate((name) => window.__E2E_STORES__.releaseOperation(name), operation)
  await dialog.waitFor({ state: 'hidden' })
  assert(!(await hasStoredTarget(page, collection, id)), `${title}: dịch vụ thành công phải xóa đúng dữ liệu`)
}
