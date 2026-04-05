import { NextResponse } from 'next/server'
// eslint-disable-next-line @typescript-eslint/no-require-imports
const QRCode = require('qrcode')
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
      .select('id, status')
      .eq('code', code)
      .single()

    if (!partner || partner.status !== 'active') {
      return NextResponse.json({ error: 'Partenaire introuvable' }, { status: 404 })
    }

    const scanUrl = `https://sutra.purama.dev/scan/${code}`

    // Generate QR code as PNG buffer
    const qrBuffer = await QRCode.toBuffer(scanUrl, {
      type: 'png',
      width: 512,
      margin: 2,
      errorCorrectionLevel: 'H',
      color: {
        dark: '#8B5CF6', // SUTRA purple
        light: '#0A0A0F', // Dark background
      },
    })

    return new NextResponse(qrBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Content-Disposition': `inline; filename="sutra-partner-${code}.png"`,
        'Cache-Control': 'public, max-age=86400, s-maxage=86400',
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur interne'
    return NextResponse.json({ error: 'Erreur generation QR', details: message }, { status: 500 })
  }
}
