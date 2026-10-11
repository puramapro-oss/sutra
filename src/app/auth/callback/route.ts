import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { safeNextPath, sessionCookieOptions } from '@/lib/auth-navigation'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = safeNextPath(searchParams.get('next'))

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
              cookieStore.set(name, value, sessionCookieOptions(options, cookieStore.get('sutra_persist')?.value))
            })
          } catch {
            // Server Component context — middleware will refresh
          }
        },
      },
    }
  )

  try {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) {
      return NextResponse.redirect(
        `${origin}/login?error=callback_failed`
      )
    }

    // A login is not proof of accepting legal documents. The existing dashboard
    // gate requests any missing acceptance. Never trust an arbitrary forwarded host.
    return NextResponse.redirect(new URL(next, origin))
  } catch {
    return NextResponse.redirect(`${origin}/login?error=callback_failed`)
  }
}
