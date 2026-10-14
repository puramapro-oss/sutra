// Synthetic browser harness only. Never retain headers, cookies, query strings or bodies.
export function observeNavigation(page) {
  const pending = new Map(), recent = []
  const path = value => { try { return new URL(value).pathname } catch { return 'unavailable' } }
  const record = row => { recent.push(row); if (recent.length > 80) recent.shift() }
  page.on('request', request => {
    pending.set(request, { path: path(request.url()), method: request.method(), type: request.resourceType(), startedAt: Date.now() })
  })
  page.on('response', response => {
    const row = pending.get(response.request())
    if (row) row.status = response.status()
  })
  const finish = request => {
    const row = pending.get(request)
    if (row) record({ ...row, elapsedMs: Date.now() - row.startedAt, failed: Boolean(request.failure()) })
    pending.delete(request)
  }
  page.on('requestfinished', finish).on('requestfailed', finish)
  page.on('framenavigated', frame => {
    if (frame === page.mainFrame()) record({ navigation: path(frame.url()), at: Date.now() })
  })
  return () => ({ path: path(page.url()), closed: page.isClosed(), recent,
    pending: [...pending.values()].map(row => ({ ...row, elapsedMs: Date.now() - row.startedAt })) })
}
