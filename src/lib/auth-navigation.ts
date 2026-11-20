/** Accept only same-origin application paths, including their query and fragment. */
export function safeNextPath(value: string | null | undefined): string {
  if (!value || value.length > 2048 || !value.startsWith('/') || value.startsWith('//') || /[\\\s\u0000-\u001f\u007f]/.test(value)) return '/dashboard'
  try {
    const url = new URL(value, 'https://sutra.invalid')
    const path = decodeURIComponent(url.pathname)
    if (url.origin !== 'https://sutra.invalid' || path.startsWith('//') || /[\\\u0000-\u001f\u007f]/.test(path)) return '/dashboard'
    if (/^\/(?:api|_next|auth|login|signup|forgot-password)(?:\/|$)/.test(path)) return '/dashboard'
    return `${url.pathname}${url.search}${url.hash}`
  } catch { return '/dashboard' }
}

/** Apply the actual persistence choice to every SDK cookie refresh, browser or server. */
export function sessionCookieOptions<T extends { maxAge?: number; expires?: Date }>(options: T, remember: string | undefined): T {
  if (options.maxAge === 0 || (remember !== 'true' && remember !== 'false')) return options
  const next = { ...options }
  delete next.expires
  if (remember === 'true') next.maxAge = 30 * 24 * 60 * 60
  else delete next.maxAge
  return next
}

export function rememberSession(remember: boolean) {
  document.cookie = `sutra_persist=${remember};path=/;SameSite=Lax${remember ? ';max-age=2592000' : ''}${location.protocol === 'https:' ? ';Secure' : ''}`
  try {
    localStorage.setItem('sutra_remember_me', String(remember))
    sessionStorage.removeItem('sutra_signed_out')
  } catch { /* Storage preferences must not prevent authentication. */ }
}
