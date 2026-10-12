// ---------------------------------------------------------------------------
// LTX Video 2.3 — Types
// ---------------------------------------------------------------------------

export type LtxModel = 'ltx-2-3-pro' | 'ltx-2-3-fast'

export type CameraMotion =
  | 'dolly_in' | 'dolly_out' | 'dolly_left' | 'dolly_right'
  | 'jib_up' | 'jib_down' | 'static' | 'focus_shift'

export type VideoEngine = 'ltx-pro' | 'ltx-fast' | 'wan-classic'

export interface LtxTextToVideoRequest {
  prompt: string
  model: LtxModel
  duration: number
  resolution: string
  fps?: number
  generate_audio?: boolean
  /** Retained only to match PR3 checkpoint fingerprints; new V2 requests reject it. */
  seed?: number
  camera_motion?: CameraMotion
}

export interface LtxImageToVideoRequest {
  image_uri: string
  prompt: string
  model: LtxModel
  duration: number
  resolution: string
  fps?: number
  generate_audio?: boolean
  last_frame_uri?: string
  camera_motion?: CameraMotion
}

export interface LtxResult {
  videoBuffer: ArrayBuffer
  provenance?: Omit<import('./ltx-v2').LtxJob, 'output'> | import('./runpod').RunpodProvenance
  engine: VideoEngine
  model: LtxModel | 'wan-2.2' | 'local-m4max'
  duration: number
  resolution: string
}
