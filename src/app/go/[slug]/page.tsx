import { redirect, notFound } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase'

interface PageProps {
  params: Promise<{ slug: string }>
}

export default async function GoPage({ params }: PageProps) {
  const { slug } = await params

  if (!slug || slug.length < 2 || slug.length > 50) {
    notFound()
  }

  const supabase = createServiceClient()

  const { data: influencer } = await supabase
    .from('influencer_profiles')
    .select('id, user_id, custom_link_slug, is_active')
    .eq('custom_link_slug', slug)
    .eq('is_active', true)
    .single()

  if (!influencer) {
    const { data: referralCode } = await supabase
      .from('referral_codes')
      .select('id, code, is_active')
      .eq('code', slug)
      .eq('is_active', true)
      .single()

    if (!referralCode) {
      notFound()
    }

    redirect(`/signup?ref=${referralCode.code}`)
  }

  try {
    await supabase.from('influencer_clicks').insert({
      influencer_id: influencer.id,
      source: 'go_link',
      user_agent: '',
      referrer: '',
    })
  } catch {
    // Non-blocking: tracking failure should not prevent redirect
  }

  redirect(`/signup?ref=${slug}&via=influencer`)
}
