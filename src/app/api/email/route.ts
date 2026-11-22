import { NextResponse } from 'next/server'

// No application flow owns this generic relay. Transactional emails must be
// triggered by their server-side business event; authentication alone cannot
// authorize caller-selected recipients, payment assertions or HTML content.
export async function POST() {
  return NextResponse.json(
    { error: 'Cette voie d’envoi d’email n’est plus disponible.', code: 'EMAIL_ROUTE_DISABLED' },
    { status: 410, headers: { 'Cache-Control': 'no-store' } }
  )
}
