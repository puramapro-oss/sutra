import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { verifyProof } from '@/lib/opentimestamps'

export const dynamic = 'force-dynamic'

// ---------------------------------------------------------------------------
// GET /api/verify/[videoId]
//
// Endpoint PUBLIC — audit de la preuve blockchain d'une vidéo SUTRA.
// Pas d'auth requise : toute personne peut vérifier qu'une vidéo existait
// à un moment donné via le timestamp Bitcoin.
//
// Algo :
//   1. Load video_proofs by video_id
//   2. Fetch .ots bytes depuis bucket Storage "video-proofs" (public read)
//   3. Re-execute verifyProof(proofBase64, content_sha256) → hit blockstream.info
//      pour vérifier le Bitcoin block
//   4. Retourne { status, sha256, bitcoinBlock?, bitcoinTimestamp?, storagePublicUrl }
//
// Utilisé par :
//   - composant <BlockchainProofBadge videoId={id} />
//   - audit externe (journaliste, avocat, etc.) via l'URL publique
// ---------------------------------------------------------------------------

type ProofRow = {
  id: string
  content_sha256: string
  ots_proof_base64: string
  ots_upgraded_proof: string | null
  storage_path: string
  storage_public_url: string | null
  blockchain: string
  bitcoin_block_height: number | null
  bitcoin_timestamp: string | null
  status: 'pending' | 'upgraded' | 'verified' | 'failed'
  created_at: string
  upgraded_at: string | null
  verified_at: string | null
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ videoId: string }> },
): Promise<Response> {
  try {
    const { videoId } = await ctx.params

    if (!UUID_RE.test(videoId)) {
      return NextResponse.json(
        { error: 'invalid_video_id', detail: 'videoId must be a UUID' },
        { status: 400 },
      )
    }

    const supabase = createServiceClient()

    const { data: proof, error } = await supabase
      .from('video_proofs')
      .select(
        'id, content_sha256, ots_proof_base64, ots_upgraded_proof, storage_path, storage_public_url, blockchain, bitcoin_block_height, bitcoin_timestamp, status, created_at, upgraded_at, verified_at',
      )
      .eq('video_id', videoId)
      .maybeSingle<ProofRow>()

    if (error) {
      return NextResponse.json(
        { error: 'db_error', detail: error.message },
        { status: 500 },
      )
    }
    if (!proof) {
      return NextResponse.json(
        { error: 'proof_not_found', videoId },
        { status: 404 },
      )
    }

    // Préfère ots_upgraded_proof (Bitcoin-anchored) sinon le pending original.
    const activeProof = proof.ots_upgraded_proof ?? proof.ots_proof_base64

    // Re-verify live contre blockstream.info (sanity check 0 trust DB).
    const verify = await verifyProof(activeProof, proof.content_sha256)

    const base = {
      videoId,
      proofId: proof.id,
      sha256: proof.content_sha256,
      blockchain: proof.blockchain,
      storagePublicUrl: proof.storage_public_url,
      storagePath: proof.storage_path,
      createdAt: proof.created_at,
      upgradedAt: proof.upgraded_at,
      verifiedAt: proof.verified_at,
      dbStatus: proof.status,
    }

    if (verify.verified) {
      return NextResponse.json({
        ...base,
        status: 'verified',
        bitcoinBlockHeight: verify.bitcoinBlockHeight,
        bitcoinTimestamp: verify.bitcoinTimestamp.toISOString(),
        message: 'Preuve blockchain Purama confirmée.',
      })
    }

    // Cas de non-vérification (attendus ou erreur)
    if (verify.reason === 'not_anchored') {
      return NextResponse.json({
        ...base,
        status: 'pending',
        message:
          "Preuve en attente d'ancrage Bitcoin (délai typique 1 h – 24 h après génération).",
      })
    }
    if (verify.reason === 'sha_mismatch') {
      return NextResponse.json(
        {
          ...base,
          status: 'sha_mismatch',
          message: 'Le contenu ne correspond pas à la preuve stockée.',
          detail: verify.detail,
        },
        { status: 409 },
      )
    }

    return NextResponse.json(
      {
        ...base,
        status: 'failed',
        message: 'Impossible de vérifier la preuve.',
        detail: verify.detail ?? verify.reason,
      },
      { status: 500 },
    )
  } catch (err) {
    return NextResponse.json(
      {
        error: 'internal',
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    )
  }
}
