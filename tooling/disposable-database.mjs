// The migration test drops schemas. Validate its target before constructing a client.
export function assertDisposableDatabase(value, confirmation) {
  const failure = 'Refusing migration test: use SUTRA_DISPOSABLE_DB=1 and an explicit loopback postgres URL with database sutra_ci_<name>, port, and no query parameters.'
  let target
  try { target = new URL(value) } catch { throw new Error(failure) }
  if (confirmation !== '1'
    || !['postgres:', 'postgresql:'].includes(target.protocol)
    || !['127.0.0.1', '[::1]'].includes(target.hostname)
    || !target.port
    || !/^\/sutra_ci_[a-z0-9_]+$/.test(target.pathname)
    || target.search || target.hash) throw new Error(failure)
}
