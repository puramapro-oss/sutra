import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(
  req: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params
    if (!code || code.length < 3) {
      return NextResponse.json({ error: 'Code invalide' }, { status: 400 })
    }

    const service = createServiceClient()

    // Only the RPC may decide and insert: separate count/insert calls race.
    const headers = req.headers
    const userAgent = headers.get('user-agent') ?? 'unknown'
    const ip = headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      ?? headers.get('x-real-ip')
      ?? '0.0.0.0'

    // Detect OS from user-agent
    let os = 'unknown'
    if (/windows/i.test(userAgent)) os = 'Windows'
    else if (/macintosh|mac os/i.test(userAgent)) os = 'macOS'
    else if (/android/i.test(userAgent)) os = 'Android'
    else if (/iphone|ipad|ipod/i.test(userAgent)) os = 'iOS'
    else if (/linux/i.test(userAgent)) os = 'Linux'

    // Detect device type
    let device = 'desktop'
    if (/mobile|android|iphone/i.test(userAgent)) device = 'mobile'
    else if (/ipad|tablet/i.test(userAgent)) device = 'tablet'

    // Service-only, transactional, rolling 24h quotas. It writes the canonical
    // partner_scans.scanned_at schema; raw headers are not persisted.
    const { data: outcome, error: scanError } = await service.rpc('record_partner_scan', {
      p_code: code, p_ip_address: ip, p_device: device, p_os: os,
    })
    if (scanError || !['recorded', 'duplicate', 'quota_exceeded', 'not_found'].includes(outcome)) {
      return NextResponse.json({ error: 'Enregistrement scan indisponible' }, { status: 503 })
    }
    if (outcome === 'not_found') {
      return NextResponse.json({ error: 'Partenaire introuvable' }, { status: 404 })
    }
    if (outcome === 'quota_exceeded') {
      return NextResponse.json({ error: 'Limite de scans quotidienne atteinte pour ce partenaire' }, { status: 429 })
    }

    // Redirect to signup with ref code
    const redirectUrl = new URL('/signup', process.env.NEXT_PUBLIC_APP_URL ?? 'https://sutra.purama.dev')
    redirectUrl.searchParams.set('ref', code)

    const response = NextResponse.redirect(redirectUrl.toString(), 302)
    response.cookies.set('sutra_partner_ref', code, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60, // 30 days
      path: '/',
    })

    return response
  } catch {
    return NextResponse.json({ error: 'Erreur scan partenaire' }, { status: 500 })
  }
}
