/**
 * Account onboarding planning core. No HTTP, browser automation, account creation,
 * credentials, model loading, timers or publication side effects.
 * Context MUST be assembled on the server from verified identity and durable records,
 * never deserialized from a browser request. A plan is NOT an execution permission.
 */
export const ONBOARDING_POLICY_VERSION = 'sutra-onboarding-v1-20261021'
export const PLATFORMS = Object.freeze(['youtube', 'instagram', 'facebook', 'threads', 'tiktok', 'x',
  'linkedin', 'pinterest', 'snapchat', 'reddit', 'discord', 'telegram', 'bluesky',
  'mastodon', 'peertube'] as const)
export type Platform = typeof PLATFORMS[number]
export type SpaceKind = 'account' | 'channel' | 'page' | 'bot'
export type Route = 'official-assisted' | 'oauth-signup-assisted' | 'instance-review' | 'connect-existing'
export type Status = 'DISABLED' | 'BLOCKED' | 'POLICY_REVIEW_REQUIRED' | 'OWNER_APPROVAL_REQUIRED'
  | 'INSTANCE_REVIEW_REQUIRED' | 'WAIT_QUOTA' | 'RECONCILE_REQUIRED' | 'USER_ACTION_REQUIRED'
  | 'CONNECTOR_REVIEW_REQUIRED'
export interface OnboardingIntent {
  tenantId: string
  ownerId: string
  editionId: string
  platform: Platform
  kind: SpaceKind
  action: 'create' | 'connect'
  mode: 'personal' | 'client'
  locale: string
  /** SHA-256 of the profile/brand dossier; recompute server-side before planning. */
  profileDigest: string
  instanceOrigin?: string
}
export interface PolicyEvidence {
  version: string
  platform: Platform
  kind: SpaceKind
  action: 'create' | 'connect'
  evidenceId: string
  reviewedAt: number
  expiresAt: number
}
export interface OwnerMandate {
  id: string
  tenantId: string
  ownerId: string
  intentKey: string
  policyVersion: string
  approvedAt: number
  expiresAt: number
  revoked: boolean
}
export interface TrustedOnboardingContext {
  enabled: boolean
  now: number
  actor: { userId: string; tenantId: string; access: 'active' | 'revoked' }
  personalOwnerId: string
  networkAccess: 'approved' | 'restricted' | 'unknown'
  policy?: PolicyEvidence
  mandate?: OwnerMandate
  /** Exact reviewed origins, not suffix matches. This is NOT an SSRF defense for an HTTP adapter. */
  approvedInstanceOrigins?: readonly string[]
  quota?: { state: 'available' | 'exhausted'; checkedAt: number; expiresAt: number }
  /** A non-idle attempt can only be cleared by a durable reconciliation layer. */
  previousAttempt?: { intentKey: string; state: 'in_flight' | 'unknown' | 'confirmed'; operationId: string }
}
export interface OnboardingPlan {
  status: Status
  reason: string
  route?: Route
  intentKey?: string
  policyVersion: string
  remoteExecutionAllowed: false
  publicationAllowed: false
  guidance: string
}
const FEDERATED: readonly Platform[] = ['bluesky', 'mastodon', 'peertube']
const KINDS: Record<Platform, readonly SpaceKind[]> = {
  youtube: ['channel'], instagram: ['account'], facebook: ['account', 'page'],
  threads: ['account'], tiktok: ['account'], x: ['account'], linkedin: ['account', 'page'],
  pinterest: ['account'], snapchat: ['account'], reddit: ['account'], discord: ['bot'],
  telegram: ['account', 'channel', 'bot'], bluesky: ['account'], mastodon: ['account'],
  peertube: ['account', 'channel'],
}
const GUIDANCE: Record<Route, string> = {
  'official-assisted': 'Préparer le dossier, puis utiliser le parcours officiel avec le propriétaire. Aucun pilotage automatisé de formulaire, mot de passe, CAPTCHA ou validation humaine.',
  'oauth-signup-assisted': 'Utiliser le parcours officiel de connexion/inscription du serveur autorisé. Le propriétaire effectue les consentements et vérifications demandés.',
  'instance-review': 'Vérifier la version, les droits administrateur et le contrat de cette instance avant de développer ou activer un adaptateur. Aucun endpoint universel présumé.',
  'connect-existing': 'Raccorder un compte existant via le connecteur officiel validé, puis vérifier son identité et ses permissions. La connexion ne vaut pas autorisation de publier.',
}
const id = (x: unknown): x is string => typeof x === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:@-]{0,127}$/.test(x)
const epoch = (x: unknown): x is number => typeof x === 'number' && Number.isSafeInteger(x) && x >= 0
const own = (x: object, key: PropertyKey) => Object.prototype.hasOwnProperty.call(x, key)
const record = (x: unknown): x is Record<string, unknown> => x !== null && typeof x === 'object' && !Array.isArray(x)
function bad(): never { throw new Error('SUTRA_ONBOARDING_INVALID_INPUT') }
function origin(value: unknown): string {
  if (typeof value !== 'string' || value.length > 253) return bad()
  let u: URL
  try { u = new URL(value) } catch { return bad() }
  if (u.protocol !== 'https:' || u.username || u.password || u.port || u.search || u.hash
    || u.pathname !== '/' || !/^[a-z0-9-]+(?:\.[a-z0-9-]+)+$/.test(u.hostname)
    || /^[\d.]+$/.test(u.hostname) || /\.(localhost|local|internal)$/.test(u.hostname)) return bad()
  return u.origin
}
/** Strict input boundary; unknown fields (including secrets and authority flags) are rejected. */
export function parseOnboardingIntent(input: unknown): OnboardingIntent {
  if (!record(input)) return bad()
  const required = ['tenantId', 'ownerId', 'editionId', 'platform', 'kind', 'action', 'mode', 'locale', 'profileDigest']
  if (required.some(k => !own(input, k)) || Object.keys(input).some(k => !required.includes(k) && k !== 'instanceOrigin')) return bad()
  if (![input.tenantId, input.ownerId, input.editionId].every(id)
    || !PLATFORMS.includes(input.platform as Platform)
    || !['account', 'channel', 'page', 'bot'].includes(input.kind as string)
    || !['create', 'connect'].includes(input.action as string) || !['personal', 'client'].includes(input.mode as string)
    || typeof input.locale !== 'string' || !/^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8}){0,3}$/.test(input.locale)
    || typeof input.profileDigest !== 'string' || !/^[a-f0-9]{64}$/.test(input.profileDigest)) return bad()
  const i = input as unknown as OnboardingIntent
  const instanceOrigin = own(input, 'instanceOrigin') ? origin(input.instanceOrigin) : undefined
  if (FEDERATED.includes(i.platform) !== Boolean(instanceOrigin)) return bad()
  return { tenantId: i.tenantId, ownerId: i.ownerId, editionId: i.editionId, platform: i.platform,
    kind: i.kind, action: i.action, mode: i.mode, locale: i.locale, profileDigest: i.profileDigest,
    ...(instanceOrigin ? { instanceOrigin } : {}) }
}
/** Stable, collision-unambiguous serialization, NOT a cryptographic authorization token. */
export function onboardingIntentKey(input: unknown): string {
  const i = parseOnboardingIntent(input)
  return JSON.stringify(['sutra-onboarding/1', i.tenantId, i.ownerId, i.editionId, i.platform,
    i.kind, i.action, i.mode, i.locale, i.profileDigest, i.instanceOrigin ?? null])
}
export function onboardingCapabilities(platform: Platform) {
  if (!PLATFORMS.includes(platform)) return bad()
  return { platform, kinds: [...KINDS[platform]], requiresInstance: FEDERATED.includes(platform),
    policyVersion: ONBOARDING_POLICY_VERSION, liveCreationImplemented: false as const }
}
function fresh(reviewedAt: unknown, expiresAt: unknown, now: number): boolean {
  return epoch(reviewedAt) && epoch(expiresAt) && reviewedAt <= now && now < expiresAt && reviewedAt < expiresAt
}
/** Pure planner. Every return denies remote execution; live adapters are a separate reviewed phase. */
export function planAccountOnboarding(input: unknown, context: TrustedOnboardingContext): OnboardingPlan {
  const base = { policyVersion: ONBOARDING_POLICY_VERSION, remoteExecutionAllowed: false as const, publicationAllowed: false as const }
  const stop = (status: Status, reason: string, extra: Partial<OnboardingPlan> = {}): OnboardingPlan =>
    ({ ...base, status, reason, guidance: 'Aucune action distante autorisée par ce plan.', ...extra })
  let i: OnboardingIntent
  try { i = parseOnboardingIntent(input) } catch { return stop('BLOCKED', 'INVALID_INPUT') }
  if (!record(context) || !epoch(context.now)) return stop('BLOCKED', 'INVALID_CONTEXT')
  if (context.enabled !== true) return stop('DISABLED', 'FEATURE_DISABLED')
  const a = context.actor
  if (!record(a) || a.access !== 'active' || a.userId !== i.ownerId || a.tenantId !== i.tenantId)
    return stop('BLOCKED', 'IDENTITY_OR_TENANT_MISMATCH')
  if (i.mode === 'personal' && (!id(context.personalOwnerId) || context.personalOwnerId !== i.ownerId))
    return stop('BLOCKED', 'PERSONAL_OWNER_REQUIRED')
  if (!KINDS[i.platform].includes(i.kind)) return stop('BLOCKED', 'UNSUPPORTED_SPACE_KIND')
  if (context.networkAccess !== 'approved') return stop('BLOCKED', 'NETWORK_ACCESS_REVIEW_REQUIRED')
  const intentKey = onboardingIntentKey(i)
  const route: Route = i.action === 'connect' ? 'connect-existing' : i.platform === 'bluesky'
    ? 'oauth-signup-assisted' : ['mastodon', 'peertube'].includes(i.platform) ? 'instance-review' : 'official-assisted'
  const details = { intentKey, route, guidance: GUIDANCE[route] }
  const attempt = context.previousAttempt
  if (attempt !== undefined) {
    if (!record(attempt) || attempt.intentKey !== intentKey || !id(attempt.operationId)
      || !['in_flight', 'unknown', 'confirmed'].includes(attempt.state)) return stop('BLOCKED', 'ATTEMPT_SCOPE_INVALID', details)
    return stop('RECONCILE_REQUIRED', attempt.state === 'confirmed' ? 'REUSE_CONFIRMED_RESULT' : 'NO_BLIND_RETRY', details)
  }
  const p = context.policy
  if (!record(p) || p.version !== ONBOARDING_POLICY_VERSION || p.platform !== i.platform || p.kind !== i.kind
    || p.action !== i.action || !id(p.evidenceId) || !fresh(p.reviewedAt, p.expiresAt, context.now)
    || context.now - p.reviewedAt > 30 * 24 * 3600_000)
    return stop('POLICY_REVIEW_REQUIRED', 'MISSING_STALE_OR_MISMATCHED_POLICY', details)
  if (i.instanceOrigin && (!Array.isArray(context.approvedInstanceOrigins)
    || !context.approvedInstanceOrigins.includes(i.instanceOrigin))) return stop('INSTANCE_REVIEW_REQUIRED', 'INSTANCE_NOT_APPROVED', details)
  const m = context.mandate
  if (!record(m) || !id(m.id) || m.revoked !== false || m.tenantId !== i.tenantId || m.ownerId !== i.ownerId
    || m.intentKey !== intentKey || m.policyVersion !== ONBOARDING_POLICY_VERSION
    || !fresh(m.approvedAt, m.expiresAt, context.now)) return stop('OWNER_APPROVAL_REQUIRED', 'MISSING_STALE_OR_MISMATCHED_MANDATE', details)
  const q = context.quota
  if (!record(q) || !['available', 'exhausted'].includes(q.state) || !fresh(q.checkedAt, q.expiresAt, context.now) || context.now - q.checkedAt > 300_000)
    return stop('WAIT_QUOTA', 'QUOTA_NOT_VERIFIED', details)
  if (q.state === 'exhausted') return stop('WAIT_QUOTA', 'QUOTA_EXHAUSTED_NO_ACCOUNT_ROTATION', details)
  return route === 'instance-review' || route === 'connect-existing'
    ? stop('CONNECTOR_REVIEW_REQUIRED', 'LIVE_ADAPTER_NOT_IMPLEMENTED', details)
    : stop('USER_ACTION_REQUIRED', 'OFFICIAL_OWNER_FLOW_REQUIRED', details)
}
