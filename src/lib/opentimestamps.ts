import { createHash } from 'node:crypto'
import OpenTimestamps from 'javascript-opentimestamps'

// ---------------------------------------------------------------------------
// OpenTimestamps — Horodatage blockchain Bitcoin natif (remplace OriginStamp).
// Source of truth : STRIPE_CONNECT_KARMA_V4.md §36.2 / CLAUDE.md §36.2.
// 0 API key, 0 signup, open source. Ancrage Bitcoin via calendars publics.
//
// Flow Purama :
//   1. Vidéo Shotstack assemblée → buffer MP4 final
//   2. stampMp4(buffer) → { sha256Hex, proofBase64 } (hit calendars, ~1-2s I/O)
//   3. Insert sutra.video_proofs(status='pending') + content_sha256 + ots_proof_base64
//   4. Upload .ots bytes dans bucket Storage "video-proofs"
//   5. CRON horaire /api/cron/upgrade-ots-proofs :
//        attemptUpgrade(proofBase64, sha256Hex) → si anchor Bitcoin trouvé
//        → update ots_upgraded_proof + bitcoin_block_height + status='verified'
//   6. /api/verify/[videoId] → verifyProof(proofBase64, sha256Hex) → audit public
//
// Terme UI : « Preuve blockchain Purama » (jamais « OpenTimestamps » ni « Bitcoin »).
// ---------------------------------------------------------------------------

export type StampResult = {
  /** SHA-256 hex lowercase du contenu stampé. 64 chars. */
  sha256Hex: string
  /** Preuve OTS sérialisée (DetachedTimestampFile), encodée base64. */
  proofBase64: string
}

export type UpgradeResult =
  | {
      status: 'upgraded'
      proofBase64: string
      bitcoinBlockHeight: number
      bitcoinTimestamp: Date
    }
  | { status: 'pending'; proofBase64: string }
  | { status: 'failed'; error: string }

export type VerifyResult =
  | {
      verified: true
      bitcoinBlockHeight: number
      bitcoinTimestamp: Date
    }
  | {
      verified: false
      reason: 'not_anchored' | 'sha_mismatch' | 'parse_error'
      detail?: string
    }

// ---------------------------------------------------------------------------
// Helpers SHA-256
// ---------------------------------------------------------------------------

/** SHA-256 binaire + hex d'un buffer. */
function sha256(data: Buffer | Uint8Array | string): { digest: Buffer; hex: string } {
  const h = createHash('sha256')
  h.update(typeof data === 'string' ? Buffer.from(data) : Buffer.from(data))
  const digest = h.digest()
  return { digest, hex: digest.toString('hex') }
}

/** SHA-256 binaire à partir d'un hex (64 chars). Throws si invalide. */
function digestFromHex(sha256Hex: string): Buffer {
  const clean = sha256Hex.toLowerCase().trim()
  if (!/^[0-9a-f]{64}$/.test(clean)) {
    throw new Error(`Invalid sha256 hex (expected 64 lowercase hex chars): ${sha256Hex}`)
  }
  return Buffer.from(clean, 'hex')
}

// ---------------------------------------------------------------------------
// stampMp4 — crée une preuve OTS fraîche (pending Bitcoin, calendars attestés)
// ---------------------------------------------------------------------------

/**
 * Horodate un buffer (MP4 final, PDF règlement, etc.).
 * Hit ~3 calendars OpenTimestamps publics en parallèle. I/O réseau ~1-2s.
 * Le proof renvoyé est « pending » : Bitcoin anchoring arrive 1h-24h plus tard
 * (upgrade via CRON).
 *
 * @throws Error si tous les calendars sont down (très rare).
 */
export async function stampMp4(data: Buffer | Uint8Array): Promise<StampResult> {
  const { digest, hex } = sha256(data)
  const detachedFile = OpenTimestamps.DetachedTimestampFile.fromHash(
    new OpenTimestamps.Ops.OpSHA256(),
    digest,
  )
  await OpenTimestamps.stamp(detachedFile)
  const proofBytes = detachedFile.serializeToBytes()
  return {
    sha256Hex: hex,
    proofBase64: Buffer.from(proofBytes).toString('base64'),
  }
}

// ---------------------------------------------------------------------------
// attemptUpgrade — CRON horaire, ne nécessite que le SHA-256 (pas le MP4)
// ---------------------------------------------------------------------------

/**
 * Tente de promouvoir une preuve « pending » (calendar only) vers Bitcoin-anchored.
 * Noop silencieux si le calendar n'a pas encore inclus le stamp dans un block
 * (délai typique 1h-24h après stampMp4).
 *
 * @param proofBase64 Preuve OTS actuelle (base64).
 * @param sha256Hex   SHA-256 hex du contenu original (pour vérifier anchor).
 */
export async function attemptUpgrade(
  proofBase64: string,
  sha256Hex: string,
): Promise<UpgradeResult> {
  try {
    const proofBytes = Buffer.from(proofBase64, 'base64')
    const digest = digestFromHex(sha256Hex)

    const detachedProof = OpenTimestamps.DetachedTimestampFile.deserialize(proofBytes)
    await OpenTimestamps.upgrade(detachedProof)

    const newBytes = detachedProof.serializeToBytes()
    const newProofBase64 = Buffer.from(newBytes).toString('base64')

    // verify() hit blockstream.info / esplora pour extraire le anchor Bitcoin réel.
    const detachedOriginal = OpenTimestamps.DetachedTimestampFile.fromHash(
      new OpenTimestamps.Ops.OpSHA256(),
      digest,
    )
    const result = await OpenTimestamps.verify(detachedProof, detachedOriginal)

    if (result.bitcoin) {
      return {
        status: 'upgraded',
        proofBase64: newProofBase64,
        bitcoinBlockHeight: result.bitcoin.height,
        bitcoinTimestamp: new Date(result.bitcoin.timestamp * 1000),
      }
    }
    return { status: 'pending', proofBase64: newProofBase64 }
  } catch (err) {
    return {
      status: 'failed',
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

// ---------------------------------------------------------------------------
// verifyProof — audit public, ne nécessite que le SHA-256 (pas le MP4)
// ---------------------------------------------------------------------------

/**
 * Vérifie qu'une preuve OTS correspond bien au SHA-256 donné et est
 * Bitcoin-anchored. Pour l'endpoint public /api/verify/[videoId].
 *
 * Garantie : `sha_mismatch` renvoyé AVANT tout I/O réseau → fast fail
 * pour proofs falsifiés/corrompus.
 */
export async function verifyProof(
  proofBase64: string,
  sha256Hex: string,
): Promise<VerifyResult> {
  try {
    const proofBytes = Buffer.from(proofBase64, 'base64')
    const digest = digestFromHex(sha256Hex)
    const detachedProof = OpenTimestamps.DetachedTimestampFile.deserialize(proofBytes)

    const proofHashHex = Buffer.from(detachedProof.fileDigest()).toString('hex')
    if (proofHashHex !== sha256Hex.toLowerCase()) {
      return {
        verified: false,
        reason: 'sha_mismatch',
        detail: `expected=${sha256Hex} proof_contains=${proofHashHex}`,
      }
    }

    const detachedOriginal = OpenTimestamps.DetachedTimestampFile.fromHash(
      new OpenTimestamps.Ops.OpSHA256(),
      digest,
    )
    const result = await OpenTimestamps.verify(detachedProof, detachedOriginal)

    if (result.bitcoin) {
      return {
        verified: true,
        bitcoinBlockHeight: result.bitcoin.height,
        bitcoinTimestamp: new Date(result.bitcoin.timestamp * 1000),
      }
    }
    return { verified: false, reason: 'not_anchored' }
  } catch (err) {
    return {
      verified: false,
      reason: 'parse_error',
      detail: err instanceof Error ? err.message : String(err),
    }
  }
}

// ---------------------------------------------------------------------------
// Helper exporté — utile pour tests + pipeline storage
// ---------------------------------------------------------------------------

/** SHA-256 hex lowercase d'un buffer. */
export function sha256HexOf(data: Buffer | Uint8Array | string): string {
  return sha256(data).hex
}
