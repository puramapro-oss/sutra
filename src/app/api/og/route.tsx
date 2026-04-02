import { ImageResponse } from 'next/og'

export const runtime = 'edge'

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #06050e 0%, #1a0533 50%, #06050e 100%)',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        {/* Glow */}
        <div
          style={{
            position: 'absolute',
            width: 400,
            height: 400,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(139, 92, 246, 0.3) 0%, transparent 70%)',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
          }}
        />

        {/* Title */}
        <div
          style={{
            display: 'flex',
            fontSize: 80,
            fontWeight: 900,
            letterSpacing: '-0.02em',
            background: 'linear-gradient(135deg, #a78bfa, #c084fc, #e879f9)',
            backgroundClip: 'text',
            color: 'transparent',
          }}
        >
          SUTRA
        </div>

        {/* Subtitle */}
        <div
          style={{
            display: 'flex',
            fontSize: 28,
            color: 'rgba(255, 255, 255, 0.6)',
            marginTop: 16,
            fontWeight: 500,
          }}
        >
          Genere des videos IA en quelques minutes
        </div>

        {/* Badge */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginTop: 32,
            padding: '8px 20px',
            borderRadius: 100,
            background: 'rgba(139, 92, 246, 0.15)',
            border: '1px solid rgba(139, 92, 246, 0.3)',
          }}
        >
          <div style={{ color: '#a78bfa', fontSize: 16, fontWeight: 600 }}>
            by Purama
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  )
}
