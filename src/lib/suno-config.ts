/** Explicit third-party SunoAPI routing; never send a key to a legacy or arbitrary host. */
export function sunoBaseUrl(): string {
  const configured = process.env.SUNO_API_BASE_URL?.trim() || process.env.SUNO_BASE_URL?.trim()
  if (!configured) throw new Error('Suno: SUNO_API_BASE_URL requis')
  let url: URL
  try { url = new URL(configured) } catch { throw new Error('Suno: URL fournisseur invalide') }
  if (url.protocol !== 'https:' || url.host !== 'api.sunoapi.org' ||
      !['/api/v1', '/api/v1/'].includes(url.pathname) || url.username || url.password || url.search || url.hash) {
    throw new Error('Suno: URL fournisseur non prise en charge')
  }
  return 'https://api.sunoapi.org/api/v1'
}
