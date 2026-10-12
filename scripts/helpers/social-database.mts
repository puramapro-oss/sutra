import { isDeepStrictEqual } from 'node:util'
import type { PublicationOperation } from '../../src/lib/publication-journal.ts'
import type { PublishResult } from '../../src/lib/zernio.ts'
export type Row = Record<string, unknown> & { operations?: PublicationOperation[] }
export const accountId = '66b2e19d8c3f5a7e9d0b1c2d', secondAccount = '66b2e19d8c3f5a7e9d0b1c2e'
export const postId = '65f1c0a9e2b5af0012ab34cd'
export function socialDatabase() {
  const url = 'https://media.invalid/final.mp4'
  const video = { id: 'v', user_id: 'u', status: 'ready', video_url: url, title: 'Title', description: 'Description', tags: [], publish_data: null as null | { sutraPublications: PublicationOperation[] },
    shotstack_json: { sutraVerification: { url, sha256: 'a'.repeat(64) } } as null | { sutraVerification: { url: string; sha256: string } } }
  const auto = { id: 'v', user_id: 'u', status: 'ready', video_final_url: url, title: 'Title', description: 'Description', hashtags: [],
    scheduled_for: '2026-01-01T00:00:00Z' as string | null, published_platforms: [] as PublishResult[] }
  const config = { user_id: 'u', is_active: true, auto_publish: true, require_approval_before_publish: false, publish_platforms: ['youtube', 'instagram'], schedules: [] }
  const accounts: Array<{ id: string; user_id: string; platform: string; external_id: string; status: string; token_expires_at?: string }> = [{ id: 'local-y', user_id: 'u', platform: 'youtube', external_id: accountId, status: 'connected' },
    { id: 'local-i', user_id: 'u', platform: 'instagram', external_id: secondAccount, status: 'connected' }]
  const profile = { id: 'u', subscription_status: 'active', access_revoked_at: null as string | null }
  const tables = { profiles: [profile], videos: [video], sutra_auto_videos: [auto], sutra_auto_config: [config], social_accounts: accounts,
    social_publication_journals: [] as Array<Row & { operations: PublicationOperation[] }>, social_posts: [] as Row[], scheduled_posts: [] as Row[], video_jobs: [{ user_id: 'u', kind: 'auto', status: 'done',
      progress: { steps: { assembly: { verification: { url, sha256: 'a'.repeat(64) } } } } }] }
  const rowsByTable: Record<string, Row[]> = tables
  const settings = { failProfileRead: false, failRead: false, failClaim: false, failFinal: false, failHistory: false, failProjection: false,
    hook: undefined as undefined | ((table: string, mutation?: Row) => void) }
  const client = { schema: () => client, from: (table: string) => {
    if (!rowsByTable[table]) throw new Error(`Unexpected table ${table}`)
    const filters: Array<(r: Row) => boolean> = []
    let mutation: Row | undefined, insert: Row | undefined, upsert: Row[] | undefined, deleting = false, single = false
    const execute = () => {
      settings.hook?.(table, mutation)
      if (settings.failProfileRead && table === 'profiles') return { data: null, error: { message: 'profile read failed' } }
      if (settings.failRead && !mutation && !insert && !upsert) return { data: null, error: { message: 'read failed' } }
      const rows = rowsByTable[table].filter(row => filters.every(f => f(row)))
      if (insert) {
        if (settings.failClaim) return { data: null, error: { message: 'claim failed' } }
        if (rowsByTable[table].some(r => r.kind === insert!.kind && r.production_id === insert!.production_id)) return { data: null, error: { code: '23505' } }
        const row = { revision: 0, ...structuredClone(insert) }; rowsByTable[table].push(row)
        return { data: single ? structuredClone(row) : [structuredClone(row)], error: null }
      }
      if (upsert) {
        if (settings.failHistory) return { data: null, error: { message: 'history failed' } }
        for (const row of upsert) {
          const old = rowsByTable[table].find(r => r.id === row.id)
          if (old) Object.assign(old, structuredClone(row)); else rowsByTable[table].push(structuredClone(row))
        }
      }
      if (mutation) {
        if (settings.failFinal && table === 'social_publication_journals' && mutation.operations?.some(o => o.phase === 'recorded')) return { data: null, error: { message: 'save failed' } }
        if (settings.failProjection && ['videos', 'sutra_auto_videos'].includes(table)) return { data: null, error: { message: 'projection failed' } }
        for (const row of rows) Object.assign(row, structuredClone(mutation))
      }
      if (deleting) rowsByTable[table] = rowsByTable[table].filter(r => !rows.includes(r))
      return { data: structuredClone(single ? rows[0] ?? null : rows), error: null }
    }
    const builder = { select: () => builder, contains: () => builder, order: () => builder, limit: () => builder,
      eq: (key: string, value: unknown) => { filters.push(row => {
        if (typeof value === 'string' && (value.startsWith('{') || value.startsWith('['))) return isDeepStrictEqual(JSON.parse(JSON.stringify(row[key])), JSON.parse(value))
        return isDeepStrictEqual(row[key], value)
      }); return builder },
      is: (key: string, value: unknown) => { filters.push(row => row[key] === value); return builder },
      in: (key: string, values: unknown[]) => { filters.push(row => values.includes(row[key])); return builder },
      lte: (key: string, value: string) => { filters.push(row => typeof row[key] === 'string' && row[key] <= value); return builder },
      update: (value: Row) => { mutation = value; return builder },
      insert: (value: Row) => { insert = value; return builder },
      upsert: (value: Row[]) => { upsert = value; return builder }, delete: () => { deleting = true; return builder },
      single: async () => { single = true; return execute() }, maybeSingle: async () => { single = true; return execute() },
      then: (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) => Promise.resolve().then(execute).then(resolve, reject),
    }
    return builder
  } }
  return { client: client as never, profile, video, auto, config, accounts, tables, settings }
}
