import { validateCinemaProject, type CinemaProject } from './cinema-project'
import { getResolution } from './ffmpeg-filters'

export function makeMotionData(project: CinemaProject) {
  const film = validateCinemaProject(project)
  const [width, height] = getResolution(film.format, '1080p').split('x').map(Number)
  return {
    title: film.title,
    width,
    height,
    fps: film.fps,
    voiceover: null,
    scenes: film.scenes.map(scene => ({
      id: scene.id,
      text: scene.description,
      visualPrompt: scene.visual_prompt,
      frames: scene.timeline.durationFrames,
      entrance: scene.transition,
      media: null,
    })),
  }
}

export const MOTION_DRAWING_PATH = '/motion/storyboard-frame.mjs'

/** The drawing source comes from the same static module used by the in-app renderer. */
export function exportRemotionProject(project: CinemaProject, drawingSource: string): string {
  if (!drawingSource.startsWith('// SUTRA storyboard frame v1\n')) {
    throw new Error('Le dessin du storyboard est indisponible. Recharge la page et réessaie.')
  }
  const literal = JSON.stringify(makeMotionData(project), null, 2)
    .replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029')

  return `// SUTRA • Composition Remotion éditable
// Dans un nouveau dossier contenant ce fichier et avec Node.js installé, lance :
//   npm init -y
//   npm install --save-exact remotion@4.0.544 @remotion/cli@4.0.544 react@19.2.4 react-dom@19.2.4
//   npx remotion studio sutra.remotion.jsx
// Pour produire le MP4 local :
//   npx remotion render sutra.remotion.jsx SutraStoryboard sutra-preview.mp4
// Conditions de licence Remotion : https://www.remotion.dev/docs/terms
//
// Édite "text" pour changer le texte à l'écran. "visualPrompt" conserve la direction visuelle.
// Les descriptions sont présentées en cartons animés jusqu'à l'ajout de tes prises de vues.
// Pour intégrer une sortie MotionLab ou un autre média, place le fichier dans public/
// à côté de cette composition et renseigne "media" dans le plan concerné, par exemple :
//   {"type":"video","file":"plan-01.mp4"}  ou  {"type":"image","file":"produit.png"}
// Prévois un clip au moins aussi long que le plan. Une voix off peut être fournie de la
// même façon en remplaçant "voiceover": null par "voiceover": "narration.mp3".
// Si une voix off est fournie, elle remplace l'audio des clips.
import React, {useLayoutEffect, useRef} from 'react';
import {
  AbsoluteFill, Composition, Html5Audio, Img, OffthreadVideo, registerRoot,
  Series, staticFile, useCurrentFrame,
} from 'remotion';

const project = ${literal};

const mediaStyle = {width: '100%', height: '100%', objectFit: 'cover'};

${drawingSource}
function Shot({scene, index}) {
  const frame = useCurrentFrame();
  const surface = useRef(null);
  useLayoutEffect(() => {
    const context = surface.current.getContext('2d');
    drawStoryboardFrame(context, project, scene, index, frame);
  }, [scene, index, frame]);
  return (
    <AbsoluteFill>
      {scene.media?.type === 'video' && <OffthreadVideo src={staticFile(scene.media.file)} muted={Boolean(project.voiceover)} style={mediaStyle} />}
      {scene.media?.type === 'image' && <Img src={staticFile(scene.media.file)} style={mediaStyle} />}
      <canvas ref={surface} width={project.width} height={project.height}
        style={{position: 'absolute', inset: 0, width: '100%', height: '100%'}} />
    </AbsoluteFill>
  );
}

function Film() {
  return (
    <AbsoluteFill>
      {project.voiceover && <Html5Audio src={staticFile(project.voiceover)} />}
      <Series>
        {project.scenes.map((scene, index) => (
          <Series.Sequence key={scene.id} durationInFrames={scene.frames} name={scene.id}>
            <Shot scene={scene} index={index} />
          </Series.Sequence>
        ))}
      </Series>
    </AbsoluteFill>
  );
}

function Root() {
  return <Composition id="SutraStoryboard" component={Film}
    width={project.width} height={project.height}
    fps={project.fps.numerator / project.fps.denominator}
    durationInFrames={project.scenes.reduce((sum, scene) => sum + scene.frames, 0)} />;
}

registerRoot(Root);
`
}
