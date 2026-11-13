import { isDeepStrictEqual } from 'node:util'

/** One burned-in cue. Timing is a placement on the montage, not a speech alignment. */
export interface CaptionCue {
  text: string
  start: number
  end: number
}

/** These modes never claim that a cue follows measured speech. */
export type CaptionSync = 'manual-scene-lines' | 'estimated-equal-split' | 'prior-checkpoint'

export interface CaptionProof {
  version: 1
  /** The MP4 probe is a separate gate. This record does not repeat it. */
  file: 'unchecked'
  /** Presence of an audio stream is not a measurement of speech or loudness. */
  audio: 'stream-only'
  speechMeasured: false
  sync: CaptionSync
  syncIsSpeechAligned: false
}

export interface CaptionBuild {
  cues: CaptionCue[]
  proof: CaptionProof
}

export interface CreateCaptionInput {
  mode: 'manual' | 'estimated'
  narration: string
  totalDuration: number
  sceneDurations: number[]
}

const MIN_CUE_SECONDS = 1 / 30

function proof(sync: CaptionSync): CaptionProof {
  return {
    version: 1,
    file: 'unchecked',
    audio: 'stream-only',
    speechMeasured: false,
    sync,
    syncIsSpeechAligned: false,
  }
}

function finiteCue(text: string, start: number, end: number): CaptionCue {
  if (!text.trim() || !Number.isFinite(start) || !Number.isFinite(end) || end - start < MIN_CUE_SECONDS - 1e-9) {
    throw new Error('SUTRA_CAPTION_DURATION')
  }
  return { text, start, end }
}

/** Same line split as the manual scene builder: one non-empty line, one scene. */
export function manualScriptLines(narration: string): string[] {
  return narration.split('\n').map(line => line.trim()).filter(line => line.length > 0)
}

/**
 * Place each manual line on the scene that already owns it.
 * Punctuation stays. A line with several sentences does not cross the next scene.
 */
export function manualSceneCues(narration: string, sceneDurations: number[]): CaptionCue[] {
  const lines = manualScriptLines(narration)
  if (lines.length !== sceneDurations.length) throw new Error('SUTRA_CAPTION_SCENE_MISMATCH')
  let start = 0
  return lines.map((text, index) => {
    const duration = sceneDurations[index] ?? Number.NaN
    const cue = finiteCue(text, start, start + duration)
    start = cue.end
    return cue
  })
}

/**
 * Historical automatic placement: equal slices of the estimated duration, punctuation removed.
 * Kept only so an already described automatic job does not change its cue count.
 * The proof says this is not speech sync.
 */
export function estimatedSentenceCues(narration: string, totalDuration: number): CaptionCue[] {
  const sentences = narration.split(/[.!?]+/).map(sentence => sentence.trim()).filter(sentence => sentence.length > 0)
  if (sentences.length === 0) return []
  const segmentDuration = totalDuration / sentences.length
  return sentences.map((text, index) => finiteCue(text, index * segmentDuration, (index + 1) * segmentDuration))
}

export function buildCreateSubtitles(input: CreateCaptionInput): CaptionBuild {
  if (input.mode === 'manual') {
    return { cues: manualSceneCues(input.narration, input.sceneDurations), proof: proof('manual-scene-lines') }
  }
  return {
    cues: estimatedSentenceCues(input.narration, input.totalDuration),
    proof: proof('estimated-equal-split'),
  }
}

/** A resumed job keeps its stored cues. The proof must not describe a rule that did not produce them. */
export function proofForCheckpoint(current: CaptionBuild, checkpointCues: unknown): CaptionProof {
  if (isDeepStrictEqual(current.cues, checkpointCues)) return current.proof
  return proof('prior-checkpoint')
}

export type ExportFileProof = 'accepted' | 'rejected'
export type ExportAudioProof = 'absent' | 'stream-only' | 'silent-stream' | 'audible-unaligned'

export interface ExportProofSeparation {
  file: ExportFileProof
  audio: ExportAudioProof
  subtitles: CaptionSync
  speechMeasured: false
  /** Accepting the container never certifies subtitle sync or spoken audio. */
  readyImpliesAlignedSpeech: false
}

/** -50 dBFS is digital near-silence. It is not a speech detector. */
export const SILENT_STREAM_DB = -50

export function separateExportProofs(input: {
  fileAccepted: boolean
  hasAudioStream: boolean
  meanVolumeDb: number | null
  sync: CaptionSync
}): ExportProofSeparation {
  let audio: ExportAudioProof
  if (!input.hasAudioStream) audio = 'absent'
  else if (input.meanVolumeDb === null) audio = 'stream-only'
  else if (!Number.isFinite(input.meanVolumeDb) || input.meanVolumeDb <= SILENT_STREAM_DB) audio = 'silent-stream'
  else audio = 'audible-unaligned'
  return {
    file: input.fileAccepted ? 'accepted' : 'rejected',
    audio,
    subtitles: input.sync,
    speechMeasured: false,
    readyImpliesAlignedSpeech: false,
  }
}
