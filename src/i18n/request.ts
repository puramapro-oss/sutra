import { getRequestConfig } from 'next-intl/server'
import { cookies, headers } from 'next/headers'

export const locales = [
  'fr', 'en', 'es', 'de', 'it', 'pt', 'ar', 'zh', 'ja', 'ko', 'hi', 'ru', 'tr', 'nl', 'pl', 'sv',
] as const

export type Locale = (typeof locales)[number]

export const defaultLocale: Locale = 'fr'

export async function getLocale(): Promise<Locale> {
  const cookieStore = await cookies()
  const localeCookie = cookieStore.get('sutra_locale')?.value
  if (localeCookie && locales.includes(localeCookie as Locale)) {
    return localeCookie as Locale
  }

  const headerStore = await headers()
  const acceptLanguage = headerStore.get('accept-language') ?? ''
  const preferred = acceptLanguage
    .split(',')
    .map((lang) => lang.split(';')[0].trim().split('-')[0])
    .find((lang) => locales.includes(lang as Locale))

  return (preferred as Locale) ?? defaultLocale
}

export default getRequestConfig(async () => {
  const locale = await getLocale()

  let messages
  try {
    messages = (await import(`../../messages/${locale}.json`)).default
  } catch {
    messages = (await import('../../messages/fr.json')).default
  }

  return {
    locale,
    messages,
  }
})
