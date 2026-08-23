import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`)
  }

  const cookieStore = await cookies()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          } catch {
            // Server Component context — middleware will refresh
          }
        },
      },
    }
  )

  try {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) {
      return NextResponse.redirect(
        `${origin}/login?error=${encodeURIComponent(error.message)}`
      )
    }

    if (data.user) {
      const { CURRENT_LEGAL_VERSIONS } = await import('@/lib/legal/versions')
      await Promise.all(
        (['cgu', 'cgv', 'confidentialite'] as const).map((docType) =>
          supabase.from('legal_acceptances').upsert(
            { user_id: data.user!.id, doc_type: docType, version: CURRENT_LEGAL_VERSIONS[docType] },
            { onConflict: 'user_id,doc_type', ignoreDuplicates: true }
          )
        )
      )
    }

    // Use x-forwarded-host for Vercel proxy
    const forwardedHost = request.headers.get('x-forwarded-host')
    const isLocal = process.env.NODE_ENV === 'development'

    if (isLocal) {
      return NextResponse.redirect(`${origin}${next}`)
    } else if (forwardedHost) {
      return NextResponse.redirect(`https://${forwardedHost}${next}`)
    } else {
      return NextResponse.redirect(`${origin}${next}`)
    }
  } catch {
    return NextResponse.redirect(`${origin}/login?error=callback_failed`)
  }
}
