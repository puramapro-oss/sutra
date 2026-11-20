import { AsyncLocalStorage } from 'node:async_hooks'
import { createHash, createHmac, timingSafeEqual } from 'node:crypto'
import { createServiceClient } from '@/lib/supabase'
import { getAuthorizedProfileId } from '@/lib/zernio'

// The job owner is checked against the durable lease before entering this scope.
// AsyncLocalStorage keeps concurrent workers' media authorities separate.
const owners = new AsyncLocalStorage<string>()
export const MEDIA_BUCKET = 'sutra-assets'
const PREFIX = '/api/media/'
export function withMediaOwner<T>(userId: string, operation: () => T): T {
  if (!userId || /[\s/\\]/.test(userId)) throw new Error('SUTRA_MEDIA_OWNER_REQUIRED')
  if (owners.getStore() && owners.getStore() !== userId) throw new Error('SUTRA_MEDIA_OWNER_MISMATCH')
  return owners.run(userId, operation)
}
export function mediaOwner(): string {
  const userId = owners.getStore()
  if (!userId) throw new Error('SUTRA_MEDIA_OWNER_REQUIRED')
  return userId
}
function origin(): string {
  const url = new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://sutra.purama.dev')
  if (url.protocol !== 'https:' || url.username || url.password) throw new Error('SUTRA_MEDIA_ORIGIN_INVALID')
  return url.origin
}
export function ownedMediaPath(path: string, userId = mediaOwner()): string {
  if (!path || path.length > 1024 || /[\x00-\x1f\\]/.test(path) || path.split('/').some(p => !p || p === '.' || p === '..')) {
    throw new Error('SUTRA_MEDIA_PATH_INVALID')
  }
  return `owners/${userId}/${path}`
}
export function durableMediaUrl(path: string): string {
  return `${origin()}${PREFIX}${Buffer.from(path).toString('base64url')}`
}
export function mediaPath(value: string): string | null {
  let url: URL
  try { url = new URL(value) } catch { return null }
  if (url.origin !== origin() || !url.pathname.startsWith(PREFIX)) return null
  if (url.search || url.hash || url.username || url.password) throw new Error('SUTRA_MEDIA_REFERENCE_INVALID')
  const encoded = url.pathname.slice(PREFIX.length)
  const path = Buffer.from(encoded, 'base64url').toString('utf8')
  if (Buffer.from(path).toString('base64url') !== encoded || !path || path.length > 1024
    || /[\x00-\x1f\\]/.test(path) || path.split('/').some(p => !p || p === '.' || p === '..')) throw new Error('SUTRA_MEDIA_REFERENCE_INVALID')
  return path
}
export async function assertMediaOwner(path: string, userId: string, service = createServiceClient()): Promise<void> {
  if (path.startsWith('owners/')) {
    if (path.split('/')[1] !== userId) throw new Error('SUTRA_MEDIA_ACCESS_DENIED')
    return
  }
  // Existing objects get a reviewed ownership inventory during the cutover.
  const { data, error } = await service.from('media_ownership').select('user_id').eq('object_path', path).eq('user_id', userId).maybeSingle()
  if (error || !data || data.user_id !== userId) throw new Error('SUTRA_MEDIA_ACCESS_DENIED')
}
export async function signedMediaUrl(path: string, userId: string, service = createServiceClient()): Promise<string> {
  await assertMediaOwner(path, userId, service)
  const { data, error } = await service.storage.from(MEDIA_BUCKET).createSignedUrl(path, 300)
  if (error || !data?.signedUrl) throw new Error('SUTRA_MEDIA_SIGNATURE_FAILED')
  return data.signedUrl
}
/** Only resolve private references under an authenticated owner scope. External
 * media still passes through the downloader's DNS/redirect/size checks. */
export async function resolveMediaUrl(value: string): Promise<string> {
  const path = mediaPath(value)
  return path === null ? value : signedMediaUrl(path, mediaOwner())
}
export async function resolveMediaTree<T>(value: T): Promise<T> {
  if (typeof value === 'string') return await resolveMediaUrl(value) as T
  if (Array.isArray(value)) return await Promise.all(value.map(resolveMediaTree)) as T
  if (value && typeof value === 'object') return Object.fromEntries(await Promise.all(
    Object.entries(value).map(async ([key, entry]) => [key, await resolveMediaTree(entry)]))) as T
  return value
}

interface PublicationGrant { userId: string; productionId: string; kind: 'video' | 'auto'; operationId: string; expires: number; pathHash: string }
function signature(encoded: string): Buffer {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) throw new Error('SUTRA_MEDIA_SIGNING_UNAVAILABLE')
  return createHmac('sha256', key).update(`sutra-publication-media:v1:${encoded}`).digest()
}
/** Persist this capability once with the publication intent. Its URL is stable
 * on every provider retry; the endpoint renews Storage signatures on demand. */
export async function publicationMediaUrl(value: string, grant: Omit<PublicationGrant, 'pathHash'>, service = createServiceClient()): Promise<string | undefined> {
  const path = mediaPath(value)
  if (path === null) return undefined
  await assertMediaOwner(path, grant.userId, service)
  const encoded = Buffer.from(JSON.stringify({ ...grant, pathHash: createHash('sha256').update(path).digest('hex') })).toString('base64url')
  return `${value}?grant=${encoded}.${signature(encoded).toString('base64url')}`
}
export async function authorizePublicationMedia(value: string, token: string, service = createServiceClient(), now = Date.now()): Promise<string> {
  if (token.length > 2048) throw new Error('SUTRA_MEDIA_ACCESS_DENIED')
  const [encoded, mac, extra] = token.split('.')
  const actual = Buffer.from(mac ?? '', 'base64url')
  const expected = signature(encoded ?? '')
  if (extra || actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw new Error('SUTRA_MEDIA_ACCESS_DENIED')
  const grant = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as PublicationGrant
  const path = mediaPath(value)
  if (!path || !Number.isSafeInteger(grant.expires) || grant.expires <= now || !['video', 'auto'].includes(grant.kind)
    || grant.pathHash !== createHash('sha256').update(path).digest('hex')) throw new Error('SUTRA_MEDIA_ACCESS_DENIED')
  const journal = await service.from('social_publication_journals').select('operations')
    .eq('user_id', grant.userId).eq('production_id', grant.productionId).eq('kind', grant.kind).maybeSingle()
  const op = journal.data?.operations?.find((o: { id?: string }) => o.id === grant.operationId)
  if (journal.error || !op || op.request?.videoUrl !== value || op.request?.providerMediaUrl !== `${value}?grant=${token}`) throw new Error('SUTRA_MEDIA_ACCESS_DENIED')
  const profile = await service.from('profiles').select('id,subscription_status,access_revoked_at').eq('id', grant.userId).maybeSingle()
  if (profile.error || profile.data?.id !== grant.userId || profile.data.subscription_status === 'banned' || profile.data.access_revoked_at) throw new Error('SUTRA_MEDIA_ACCESS_DENIED')
  const production = await service.from(grant.kind === 'video' ? 'videos' : 'sutra_auto_videos')
    .select('*')
    .eq('id', grant.productionId).eq('user_id', grant.userId).maybeSingle()
  const row = production.data
  if (production.error || !row || (grant.kind === 'video'
    ? row.video_url !== value || !['ready', 'published'].includes(row.status)
      || row.shotstack_json?.sutraVerification?.sha256 !== op.request.verifiedSha256
    : row.video_final_url !== value || !['ready', 'pending_approval', 'publishing', 'partially_published', 'published', 'failed'].includes(row.status))) {
    throw new Error('SUTRA_MEDIA_ACCESS_DENIED')
  }
  const accounts = await service.schema('public').from('social_accounts')
    .select('id,platform,external_id,status,token_expires_at,metadata').eq('user_id', grant.userId)
  // A previously emitted capability cannot outlive its current social authority.
  // Reuse the same server binding as the publication journal on every retrieval.
  const authorizedProfile = getAuthorizedProfileId(grant.userId)
  if (accounts.error || !op.request.platforms?.length || op.request.platforms.some((platform: string) =>
    (accounts.data ?? []).filter(a => a.id === op.accountRows?.[platform] && a.platform === platform
      && a.external_id === op.request.accountIds?.[platform] && a.status === 'connected'
      && a.metadata?.sutra_revocation_pending !== true
      && a.metadata?.credential_owner === 'zernio' && a.metadata?.zernio_profile_id === authorizedProfile
      && (!a.token_expires_at || Date.parse(a.token_expires_at) > now)).length !== 1)) throw new Error('SUTRA_MEDIA_ACCESS_DENIED')
  await assertMediaOwner(path, grant.userId, service)
  return grant.userId
}
