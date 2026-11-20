/**
 * PURAMA promotion draft planner — no network, timers, secrets, spending or publication.
 * TrustedPromotionContext MUST be constructed server-side from verified records.
 * Passing browser/model-supplied evidence as context defeats these checks.
 * A DRAFT_READY result is neither legal certification nor permission to publish.
 */
export const PROMOTION_POLICY_VERSION = 'sutra-purama-promotion-v1-20261021'
export type PromotionStatus = 'DISABLED' | 'BLOCKED' | 'REVIEW_REQUIRED' | 'WAIT_CADENCE'
  | 'RECONCILE_REQUIRED' | 'DRAFT_READY'
export type Relationship = 'own-brand' | 'affiliate' | 'partner'
export interface PromotionIntent {
  tenantId: string
  ownerId: string
  accountId: string
  platform: string
  mode: 'personal' | 'client'
  campaignId: string
  productId: string
  productRevision: string
  claimId: string
  disclosurePolicyId: string
  locale: string
  country: string
  cta: 'discover' | 'waitlist'
  /** SHA-256 of the reviewed creative, including its script and on-screen text. */
  creativeDigest: string
}
interface Evidence { evidenceId: string; reviewedAt: number; expiresAt: number }
export interface TrustedPromotionContext {
  enabled: boolean
  now: number
  actor: { userId: string; tenantId: string; active: boolean }
  /** Verified owner of the PERSONAL compute environment, never supplied by a browser. */
  personalOwnerId: string
  account: {
    id: string; tenantId: string; ownerId: string; platform: string; connected: boolean
    relationship: Relationship; enrolledForPuramaPromotion: boolean; affiliationDisclosed: boolean
    topics: readonly string[]; locales: readonly string[]; countries: readonly string[]
  }
  product: Evidence & {
    id: string; revision: string; brand: 'PURAMA'; name: string; locale: string
    state: 'available' | 'beta' | 'planned' | 'withdrawn'
    category: 'general' | 'health' | 'finance' | 'children' | 'funded-training' | 'unknown'
    topics: readonly string[]; countries: readonly string[]
    /** All copy is approved catalog copy, not generated factual claims. */
    claims: readonly { id: string; text: string; evidenceId: string }[]
    availabilityNotice: string
    destinations: readonly { action: 'discover' | 'waitlist'; url: string; label: string }[]
  }
  policy: Evidence & {
    version: string; platform: string; country: string; locale: string
    relationship: Relationship; organicPromotionAllowed: boolean
    /** Reviewed native label requirement; no platform-independent guess is made. */
    nativeLabel: 'required' | 'not-required' | 'unknown'
    nativeLabelSupported: boolean; disclosureText: string
  }
  mandate: {
    id: string; ownerId: string; tenantId: string; intentKey: string; policyVersion: string
    approvedAt: number; expiresAt: number; revoked: boolean
  }
  creativeReview: Evidence & {
    intentKey: string; original: boolean; rightsCleared: boolean; claimMatchesCreative: boolean
    disclosureRenderingVerified: boolean; audience: 'adults' | 'mixed' | 'children'
    syntheticMedia: 'none' | 'required-label-verified' | 'review-required'
  }
  /** A read-only snapshot: the publishing service MUST reserve cadence atomically. */
  cadence: {
    accountId: string; campaignId: string; checkedAt: number; expiresAt: number
    windowStart: number; windowEnd: number; nextAllowedAt: number
    directPromotions: number; maxDirectPromotions: number
  }
  previousAttempt?: { intentKey: string; operationId: string; state: 'in-flight' | 'unknown' | 'confirmed' }
}
export interface PromotionPlan {
  status: PromotionStatus
  reason: string
  policyVersion: string
  intentKey?: string
  remoteExecutionAllowed: false
  publicationAllowed: false
  paidSpendAllowed: false
  draft?: {
    accountId: string; campaignId: string; productId: string; productRevision: string
    caption: string; destinationUrl: string; disclosureText: string
    nativeLabelRequired: boolean; relationship: Relationship
    claimEvidenceId: string; creativeDigest: string
    /** Rendering plan only. No user IDs, tracking pixels, cookies or affiliation codes. */
    analyticsMode: 'aggregate-only-proposed'
  }
}
const obj = (x: unknown): x is Record<string, unknown> => x !== null && typeof x === 'object' && !Array.isArray(x)
const id = (x: unknown): x is string => typeof x === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/.test(x)
const time = (x: unknown): x is number => typeof x === 'number' && Number.isSafeInteger(x) && x >= 0
const text = (x: unknown, max = 2000): x is string => typeof x === 'string' && x.trim().length > 0
  && x.length <= max && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\u202a-\u202e\u2066-\u2069]/u.test(x)
const ids = (x: unknown): x is string[] => Array.isArray(x) && x.length > 0 && x.length <= 100 && x.every(id)
const fresh = (start: unknown, end: unknown, now: number, maxAge: number): boolean =>
  time(start) && time(end) && start <= now && now < end && now - start <= maxAge
const DAY = 86_400_000
function evidence(x: unknown, now: number, maxAge: number): boolean {
  return obj(x) && id(x.evidenceId) && fresh(x.reviewedAt, x.expiresAt, now, maxAge)
}
function invalid(): never { throw new Error('SUTRA_PROMOTION_INVALID_INPUT') }
/** Strict boundary: no arbitrary claim text, credentials, wildcard destinations or budgets. */
export function parsePromotionIntent(input: unknown): PromotionIntent {
  if (!obj(input)) return invalid()
  const fields = ['tenantId', 'ownerId', 'accountId', 'platform', 'mode', 'campaignId', 'productId',
    'productRevision', 'claimId', 'disclosurePolicyId', 'locale', 'country', 'cta', 'creativeDigest']
  if (Object.keys(input).length !== fields.length || fields.some(k => !Object.hasOwn(input, k))) return invalid()
  if (!['tenantId', 'ownerId', 'accountId', 'platform', 'campaignId', 'productId', 'productRevision', 'claimId', 'disclosurePolicyId'].every(k => id(input[k]))
    || !['personal', 'client'].includes(input.mode as string) || !['discover', 'waitlist'].includes(input.cta as string)
    || typeof input.locale !== 'string' || !/^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8}){0,3}$/.test(input.locale)
    || typeof input.country !== 'string' || !/^[A-Z]{2}$/.test(input.country)
    || typeof input.creativeDigest !== 'string' || !/^[a-f0-9]{64}$/.test(input.creativeDigest)) return invalid()
  return Object.fromEntries(fields.map(k => [k, input[k]])) as unknown as PromotionIntent
}
/** Unambiguous identity, NOT a cryptographic token or evidence of approval. */
export function promotionIntentKey(input: unknown): string {
  const i = parsePromotionIntent(input)
  return JSON.stringify(['sutra-purama-promotion/1', i.tenantId, i.ownerId, i.accountId, i.platform, i.mode,
    i.campaignId, i.productId, i.productRevision, i.claimId, i.disclosurePolicyId, i.locale, i.country, i.cta, i.creativeDigest])
}
/** Catalog destinations are exact reviewed HTTPS URLs. No redirects are followed by this module. */
function destination(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.length > 2048) return undefined
  try {
    const u = new URL(value)
    if (u.protocol !== 'https:' || u.username || u.password || u.port || u.search || u.hash
      || !/^[a-z0-9-]+(?:\.[a-z0-9-]+)+$/.test(u.hostname) || /^[\d.]+$/.test(u.hostname)
      || /\.(local|internal|localhost)$/.test(u.hostname) || u.href !== value) return undefined
    return u.href
  } catch { return undefined }
}
/** Server-only planning. A later worker rechecks all facts and obtains its own live permission. */
export function planPuramaPromotion(input: unknown, c: TrustedPromotionContext): PromotionPlan {
  const base = { policyVersion: PROMOTION_POLICY_VERSION, remoteExecutionAllowed: false as const,
    publicationAllowed: false as const, paidSpendAllowed: false as const }
  const stop = (status: PromotionStatus, reason: string, intentKey?: string): PromotionPlan =>
    ({ ...base, status, reason, ...(intentKey ? { intentKey } : {}) })
  let i: PromotionIntent
  try { i = parsePromotionIntent(input) } catch { return stop('BLOCKED', 'INVALID_INPUT') }
  if (!obj(c) || !time(c.now)) return stop('BLOCKED', 'INVALID_CONTEXT')
  if (c.enabled !== true) return stop('DISABLED', 'FEATURE_DISABLED')
  if (!obj(c.actor) || c.actor.active !== true || c.actor.userId !== i.ownerId || c.actor.tenantId !== i.tenantId)
    return stop('BLOCKED', 'IDENTITY_OR_TENANT_MISMATCH')
  if (i.mode === 'personal' && c.personalOwnerId !== i.ownerId) return stop('BLOCKED', 'PERSONAL_OWNER_REQUIRED')
  const a = c.account
  if (!obj(a) || a.id !== i.accountId || a.ownerId !== i.ownerId || a.tenantId !== i.tenantId
    || a.platform !== i.platform || a.connected !== true) return stop('BLOCKED', 'ACCOUNT_SCOPE_OR_CONNECTION')
  if (a.enrolledForPuramaPromotion !== true) return stop('BLOCKED', 'PROMOTION_NOT_OPTED_IN')
  if (a.affiliationDisclosed !== true || !['own-brand', 'affiliate', 'partner'].includes(a.relationship))
    return stop('REVIEW_REQUIRED', 'BRAND_RELATIONSHIP_NOT_DISCLOSED')
  if (!ids(a.topics) || !ids(a.locales) || !ids(a.countries) || !a.locales.includes(i.locale) || !a.countries.includes(i.country))
    return stop('BLOCKED', 'ACCOUNT_AUDIENCE_SCOPE')
  const key = promotionIntentKey(i)
  if (c.previousAttempt !== undefined) {
    const p = c.previousAttempt
    if (!obj(p) || p.intentKey !== key || !id(p.operationId) || !['in-flight', 'unknown', 'confirmed'].includes(p.state))
      return stop('BLOCKED', 'ATTEMPT_SCOPE_INVALID', key)
    return stop('RECONCILE_REQUIRED', p.state === 'confirmed' ? 'REUSE_CONFIRMED_RESULT' : 'NO_BLIND_RETRY', key)
  }
  const p = c.product
  if (!obj(p) || p.id !== i.productId || p.revision !== i.productRevision || p.brand !== 'PURAMA'
    || p.locale !== i.locale || !evidence(p, c.now, DAY) || !text(p.name, 160) || !ids(p.countries)
    || !p.countries.includes(i.country)) return stop('REVIEW_REQUIRED', 'CATALOG_NOT_CURRENT_OR_MISMATCHED', key)
  if (!['available', 'beta', 'planned', 'withdrawn'].includes(p.state) || p.state === 'withdrawn')
    return stop('BLOCKED', 'PRODUCT_NOT_PROMOTABLE', key)
  if (p.category !== 'general') return stop('REVIEW_REQUIRED', 'SPECIALIST_REVIEW_REQUIRED', key)
  if (!ids(p.topics) || !p.topics.some(t => a.topics.includes(t))) return stop('BLOCKED', 'NO_EDITORIAL_FIT', key)
  if (p.state === 'planned' && i.cta !== 'waitlist') return stop('BLOCKED', 'PLANNED_PRODUCT_NOT_AVAILABLE', key)
  if (!text(p.availabilityNotice, 500)) return stop('REVIEW_REQUIRED', 'AVAILABILITY_DISCLOSURE_REQUIRED', key)
  if (!Array.isArray(p.claims) || p.claims.length > 100) return stop('REVIEW_REQUIRED', 'CLAIM_EVIDENCE_REQUIRED', key)
  const claims = p.claims.filter(x => obj(x) && x.id === i.claimId)
  if (claims.length !== 1 || !id(claims[0].evidenceId) || !text(claims[0].text))
    return stop('REVIEW_REQUIRED', 'CLAIM_EVIDENCE_REQUIRED', key)
  if (!Array.isArray(p.destinations) || p.destinations.length > 10) return stop('BLOCKED', 'DESTINATION_NOT_APPROVED', key)
  const targets = p.destinations.filter(t => obj(t) && t.action === i.cta)
  if (targets.length !== 1 || !text(targets[0].label, 160) || !destination(targets[0].url))
    return stop('BLOCKED', 'DESTINATION_NOT_APPROVED', key)
  const policy = c.policy
  if (!obj(policy) || policy.evidenceId !== i.disclosurePolicyId || policy.version !== PROMOTION_POLICY_VERSION || policy.platform !== i.platform
    || policy.locale !== i.locale || policy.country !== i.country || policy.relationship !== a.relationship
    || !evidence(policy, c.now, 7 * DAY) || policy.organicPromotionAllowed !== true
    || !text(policy.disclosureText, 500) || !['required', 'not-required'].includes(policy.nativeLabel))
    return stop('REVIEW_REQUIRED', 'COMMERCIAL_POLICY_REVIEW_REQUIRED', key)
  if (policy.nativeLabel === 'required' && policy.nativeLabelSupported !== true)
    return stop('REVIEW_REQUIRED', 'NATIVE_DISCLOSURE_UNSUPPORTED', key)
  const m = c.mandate
  if (!obj(m) || !id(m.id) || m.ownerId !== i.ownerId || m.tenantId !== i.tenantId || m.intentKey !== key
    || m.policyVersion !== PROMOTION_POLICY_VERSION || m.revoked !== false
    || !fresh(m.approvedAt, m.expiresAt, c.now, 30 * DAY)) return stop('BLOCKED', 'CAMPAIGN_MANDATE_REQUIRED', key)
  const r = c.creativeReview
  if (!obj(r) || r.intentKey !== key || !evidence(r, c.now, 7 * DAY) || r.original !== true
    || r.rightsCleared !== true || r.claimMatchesCreative !== true || r.disclosureRenderingVerified !== true
    || !['adults', 'mixed'].includes(r.audience) || !['none', 'required-label-verified'].includes(r.syntheticMedia))
    return stop('REVIEW_REQUIRED', 'CREATIVE_REVIEW_REQUIRED', key)
  const q = c.cadence
  if (!obj(q) || q.accountId !== i.accountId || q.campaignId !== i.campaignId
    || !fresh(q.checkedAt, q.expiresAt, c.now, 60_000) || !time(q.windowStart) || !time(q.windowEnd)
    || !(q.windowStart <= c.now && c.now < q.windowEnd) || !time(q.nextAllowedAt)
    || !time(q.directPromotions) || !time(q.maxDirectPromotions))
    return stop('WAIT_CADENCE', 'CADENCE_NOT_VERIFIED', key)
  if (q.directPromotions >= q.maxDirectPromotions || q.nextAllowedAt > c.now)
    return stop('WAIT_CADENCE', 'PROMOTIONAL_PRESSURE_LIMIT', key)
  const disclosureText = policy.disclosureText.trim()
  return { ...base, status: 'DRAFT_READY', reason: 'OFFLINE_DRAFT_ONLY', intentKey: key, draft: {
    accountId: i.accountId, campaignId: i.campaignId, productId: i.productId, productRevision: i.productRevision,
    caption: [disclosureText, p.name.trim(), claims[0].text.trim(), p.availabilityNotice.trim(), targets[0].label.trim()].join('\n\n'),
    destinationUrl: targets[0].url, disclosureText, nativeLabelRequired: policy.nativeLabel === 'required',
    relationship: a.relationship, claimEvidenceId: claims[0].evidenceId, creativeDigest: i.creativeDigest,
    analyticsMode: 'aggregate-only-proposed',
  } }
}
