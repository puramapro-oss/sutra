/** SIMULATED metadata for dependency-injected contract tests. Never runtime media proof. */
import { compositionPlan, type CompositionContract } from '../../src/lib/composition-contract.ts'
import { mediaValidation } from '../../src/lib/media-validation.ts'

export function simulatedValidation(contract: CompositionContract) {
  const plan = compositionPlan(contract)
  return mediaValidation(contract, {
    sha256: '0'.repeat(64), bytes: 1000, duration: plan.total, bitrate: 1000000, fullDecode: true,
    video: { width: plan.width, height: plan.height, fps: 30, nominalFps: 30, codec: 'h264', pixelFormat: 'yuv420p',
      sar: '1:1', rotation: 0, bitrate: 900000, start: 0, duration: plan.total, frames: Math.round(plan.total * 30),
      orientation: plan.width === plan.height ? 'square' : plan.width > plan.height ? 'landscape' : 'portrait' },
    audio: plan.audioRequired ? [{ codec: 'aac', channels: 2, sampleRate: 48000, bitrate: 192000, start: 0, duration: plan.total }] : [],
    subtitleStreams: 0,
  }, [])
}
