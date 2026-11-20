/** Public redirects and browser CSRF checks share the configured deployment origin.
 * Standalone Next.js may see its internal bind address behind a reverse proxy.
 * Never derive this trust boundary from client-supplied forwarded headers.
 */
export function publicOrigin(requestUrl: string): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL
  if (!configured) return new URL(requestUrl).origin

  let url: URL
  try { url = new URL(configured) } catch { throw new Error('Invalid public application origin') }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password
    || url.pathname !== '/' || url.search || url.hash) {
    throw new Error('Invalid public application origin')
  }
  return url.origin
}
