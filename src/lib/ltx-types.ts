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
  camera_motion?: CameraMotion
  seed?: number
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
  engine: VideoEngine
  model: LtxModel | 'wan-2.2'
  duration: number
  resolution: string
}
