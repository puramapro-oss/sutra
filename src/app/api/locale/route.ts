import { NextResponse } from 'next/server'
import { locales, type Locale } from '@/i18n/request'

export async function POST(req: Request) {
  const { locale } = await req.json()

  if (!locale || !locales.includes(locale as Locale)) {
    return NextResponse.json({ error: 'Locale invalide' }, { status: 400 })
  }

  const response = NextResponse.json({ locale })
  response.cookies.set('sutra_locale', locale, {
    path: '/',
    maxAge: 365 * 24 * 60 * 60, // 1 year
    httpOnly: false, // Readable by JS for UI
    sameSite: 'lax',
  })

  return response
}
