import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

const KNOWN_PURAMA_APPS = new Set([
  'sutra', 'midas', 'kash', 'kaia', 'vida', 'vida_sante', 'vida_aide', 'vida_assoc',
  'jurispurama', 'akasha', 'akasha_ai', 'adya', 'satya', 'veda',
  'mokshâ', 'moksha', 'mana', 'prana', 'aether', 'exodus',
  'lingora', 'lumios', 'dona', 'voya',
  'entreprise_pilot', 'pilot', 'purama_ai', 'purama_origin', 'origin',
  'purama_compta', 'compta', 'impact',
])

const KNOWN_COUPONS = new Set(['WELCOME50'])

const COOKIE_MAX_AGE = 7 * 24 * 60 * 60

interface RouteContext {
  params: Promise<{ slug: string }>
}

export async function GET(req: NextRequest, ctx: RouteContext) {
  const { slug } = await ctx.params

  if (!slug || slug.length < 2 || slug.length > 50) {
    return NextResponse.redirect(new URL('/', req.url), { status: 302 })
  }

  const url = new URL(req.url)
  const couponParam = url.searchParams.get('coupon')?.toUpperCase().trim()
  const validCoupon = couponParam && KNOWN_COUPONS.has(couponParam) ? couponParam : null
  const slugLower = slug.toLowerCase()

  if (validCoupon && KNOWN_PURAMA_APPS.has(slugLower)) {
    return handleCrossPromo(req, slugLower, validCoupon)
  }

  return handleInfluencerOrReferral(req, slug)
}

async function handleCrossPromo(req: NextRequest, sourceApp: string, coupon: string) {
  const supabase = createServiceClient()
  const userAgent = req.headers.get('user-agent') ?? ''
  const referrer = req.headers.get('referer') ?? ''

  const existingPromo = req.cookies.get('purama_promo')?.value
  let anonId: string | null = null
  try {
    if (existingPromo) {
      const parsed = JSON.parse(existingPromo) as { anon_id?: string }
      anonId = parsed.anon_id ?? null
    }
  } catch {
    anonId = null
  }
  if (!anonId) {
    anonId = `anon_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
  }

  try {
    await supabase.from('cross_promos').insert({
      source_app: sourceApp,
      target_app: 'sutra',
      anon_id: anonId,
      coupon_code: coupon,
      user_agent: userAgent.slice(0, 500),
      referrer: referrer.slice(0, 500),
    })
  } catch {
    // Non-blocking: tracking failure should not break user flow
  }

  const payload = JSON.stringify({
    coupon,
    source: sourceApp,
    anon_id: anonId,
    set_at: new Date().toISOString(),
  })

  const res = NextResponse.redirect(
    new URL(`/signup?promo=${coupon}&src=${sourceApp}`, req.url),
    { status: 302 }
  )

  res.cookies.set('purama_promo', payload, {
    maxAge: COOKIE_MAX_AGE,
    path: '/',
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    httpOnly: false,
  })

  return res
}

async function handleInfluencerOrReferral(req: NextRequest, slug: string) {
  const supabase = createServiceClient()

  const { data: influencer } = await supabase
    .from('influencer_profiles')
    .select('id, user_id, custom_link_slug, is_active')
    .eq('custom_link_slug', slug)
    .eq('is_active', true)
    .single()

  if (influencer) {
    try {
      await supabase.from('influencer_clicks').insert({
        influencer_id: influencer.id,
        source: 'go_link',
        user_agent: req.headers.get('user-agent')?.slice(0, 500) ?? '',
        referrer: req.headers.get('referer')?.slice(0, 500) ?? '',
      })
    } catch {
      // Non-blocking
    }
    return NextResponse.redirect(
      new URL(`/signup?ref=${encodeURIComponent(slug)}&via=ambassadeur`, req.url),
      { status: 302 }
    )
  }

  const { data: referralCode } = await supabase
    .from('referral_codes')
    .select('id, code, is_active')
    .eq('code', slug)
    .eq('is_active', true)
    .single()

  if (referralCode) {
    return NextResponse.redirect(
      new URL(`/signup?ref=${encodeURIComponent(referralCode.code)}`, req.url),
      { status: 302 }
    )
  }

  return NextResponse.redirect(new URL('/', req.url), { status: 302 })
}
