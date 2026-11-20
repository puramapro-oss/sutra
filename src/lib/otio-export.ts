import { validateCinemaProject, type CinemaProject } from './cinema-project'

/** One editable OTIO video track. Media files can be assigned by the finishing editor. */
export function exportOtioProject(project: CinemaProject): string {
  const { title, format, fps, scenes, timeline, productionStatus } = validateCinemaProject(project)
  const rate = fps.numerator / fps.denominator
  const time = (value: number) => ({ OTIO_SCHEMA: 'RationalTime.1', value, rate })
  const range = (start: number, duration: number) => ({
    OTIO_SCHEMA: 'TimeRange.1', start_time: time(start), duration: time(duration),
  })
  const names = scenes.map((scene, i) => {
    const firstLine = scene.description.trim().split(/\r?\n/, 1)[0]
    return `Plan ${i + 1} — ${firstLine || scene.id}`
  })
  const clips = scenes.map((scene, i) => ({
    // Clip.1's single media reference is readable by older OTIO editors as well.
    OTIO_SCHEMA: 'Clip.1', name: names[i], enabled: true,
    source_range: range(scene.source.inFrame, scene.timeline.durationFrames),
    media_reference: {
      OTIO_SCHEMA: 'MissingReference.1', name: scene.id, available_range: null, metadata: {},
    },
    metadata: { sutra: {
      sceneId: scene.id, description: scene.description, visual_prompt: scene.visual_prompt,
      requestedSeconds: scene.duration_seconds, requestedTransition: scene.transition,
    } },
    effects: [], markers: [],
  }))
  const markers = scenes.map((scene, i) => ({
    OTIO_SCHEMA: 'Marker.2', name: names[i], color: 'BLUE', comment: scene.visual_prompt,
    marked_range: range(scene.timeline.startFrame, 0), metadata: { sutra: { sceneId: scene.id } },
  }))
  const result = {
    OTIO_SCHEMA: 'Timeline.1', name: title, global_start_time: time(0),
    metadata: { sutra: { format, fps, totalFrames: timeline.totalFrames, productionStatus } },
    tracks: {
      OTIO_SCHEMA: 'Stack.1', name: 'Pistes', source_range: null, enabled: true,
      metadata: {}, effects: [], markers,
      children: [{
        OTIO_SCHEMA: 'Track.1', name: 'Plans SUTRA', kind: 'Video', source_range: null,
        enabled: true, metadata: {}, effects: [], markers: [], children: clips,
      }],
    },
  }
  return `${JSON.stringify(result, null, 2)}\n`
}
