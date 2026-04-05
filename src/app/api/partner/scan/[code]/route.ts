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

    // Verify partner exists
    const { data: partner } = await service
      .from('partners')
      .select('id, code, status')
      .eq('code', code)
      .single()

    if (!partner || partner.status !== 'active') {
      return NextResponse.json({ error: 'Partenaire introuvable' }, { status: 404 })
    }

    // Extract device info from headers
    const headers = req.headers
    const userAgent = headers.get('user-agent') ?? 'unknown'
    const ip = headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      ?? headers.get('x-real-ip')
      ?? '0.0.0.0'

    // Anti-fraud: max 1 scan per IP per 24h for same code
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

    const { count: ipScanCount } = await service
      .from('partner_scans')
      .select('*', { count: 'exact', head: true })
      .eq('partner_id', partner.id)
      .eq('ip_address', ip)
      .gte('created_at', twentyFourHoursAgo)

    if ((ipScanCount ?? 0) >= 1) {
      // Silently redirect without logging duplicate scan
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
    }

    // Anti-fraud: max 100 scans/day per code
    const { count: dailyScanCount } = await service
      .from('partner_scans')
      .select('*', { count: 'exact', head: true })
      .eq('partner_id', partner.id)
      .gte('created_at', twentyFourHoursAgo)

    if ((dailyScanCount ?? 0) >= 100) {
      return NextResponse.json(
        { error: 'Limite de scans quotidienne atteinte pour ce partenaire' },
        { status: 429 }
      )
    }

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

    // Log scan
    await service.from('partner_scans').insert({
      partner_id: partner.id,
      code,
      ip_address: ip,
      user_agent: userAgent,
      device,
      os,
      referrer_url: req.headers.get('referer') ?? null,
    })

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
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur interne'
    return NextResponse.json({ error: 'Erreur scan partenaire', details: message }, { status: 500 })
  }
}
