import { createServerClient } from '@/lib/supabase-server'
import { authorizePublicationMedia, durableMediaUrl, mediaPath, signedMediaUrl } from '@/lib/private-media'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export async function GET(request: Request, context: { params: Promise<{ reference: string }> }) {
  const headers = { 'Cache-Control': 'private, no-store, max-age=0', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff', Vary: 'Cookie' }
  try {
    const { reference } = await context.params
    const canonical = durableMediaUrl(Buffer.from(reference, 'base64url').toString('utf8'))
    if (!canonical.endsWith(`/${reference}`)) throw new Error('invalid reference')
    const path = mediaPath(canonical)
    if (!path) throw new Error('invalid reference')
    const grant = new URL(request.url).searchParams.get('grant')
    let userId: string
    if (grant) userId = await authorizePublicationMedia(canonical, grant)
    else {
      const client = await createServerClient()
      const { data: { user }, error } = await client.auth.getUser()
      if (error || !user) return new Response(null, { status: 401, headers })
      userId = user.id
    }
    return new Response(null, { status: 307, headers: { ...headers, Location: await signedMediaUrl(path, userId) } })
  } catch { return new Response(null, { status: 404, headers }) }
}
