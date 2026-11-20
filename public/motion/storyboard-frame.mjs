// SUTRA storyboard frame v1
// Shared by the browser MP4 encoder and the editable Remotion export.
export function drawStoryboardFrame(context, project, scene, index, frame) {
  const { width, height } = project;
  const edge = Math.min(width, height);
  const travel = frame / Math.max(1, scene.frames - 1);
  context.clearRect(0, 0, width, height);
  context.save();
  if (scene.media) {
    const shade = context.createLinearGradient(0, height * 0.2, 0, height);
    shade.addColorStop(0, 'rgba(4,14,16,0)');
    shade.addColorStop(1, 'rgba(4,14,16,0.92)');
    context.fillStyle = shade;
    context.fillRect(0, 0, width, height);
  } else {
    const backdrop = context.createRadialGradient(width * 0.76, height * 0.14, 0, width * 0.72, height * 0.15, Math.max(width, height) * 0.85);
    backdrop.addColorStop(0, '#294b4d');
    backdrop.addColorStop(1, '#10191f');
    context.fillStyle = backdrop;
    context.fillRect(0, 0, width, height);
    const colors = ['#426b70', '#6a9a96', '#acdbca'];
    for (let layer = 0; layer < colors.length; layer++) {
      context.save();
      const side = edge * 0.78;
      context.translate(width * (1.16 - layer * 0.08) - side / 2, height * (0.06 + layer * 0.04 + travel * 0.02) + side / 2);
      context.rotate(((index % 2 === 0 ? -18 : 18) + travel * 6 + layer * 3) * Math.PI / 180);
      context.strokeStyle = colors[layer];
      context.lineWidth = edge * 0.0022;
      context.beginPath();
      context.roundRect(-side / 2, -side / 2, side, side, edge * 0.09);
      context.stroke();
      context.restore();
    }
  }

  const caption = scene.text.trim() || project.title;
  const fontSize = edge * (caption.length > 110 ? 0.066 : 0.091);
  const padding = edge * 0.09;
  const available = width - padding * 2;
  const headingSize = edge * 0.034;
  const lineHeight = fontSize * 1.12;
  const enterFrames = Math.min(Math.round(project.fps.numerator / project.fps.denominator * 0.32), scene.frames - 1);
  const ease = enterFrames > 0 ? 1 - Math.pow(1 - Math.min(1, frame / enterFrames), 3) : 1;
  context.translate(padding, height - padding);
  if (scene.entrance === 'fade') context.globalAlpha = ease;
  if (scene.entrance === 'slide') context.translate(0, (1 - ease) * edge * 0.10);
  if (scene.entrance === 'zoom') context.scale(0.89 + ease * 0.11, 0.89 + ease * 0.11);
  context.textBaseline = 'bottom';
  context.font = 'bold ' + fontSize + 'px Arial, sans-serif';

  // Restrict the on-screen caption to six lines. The editable source keeps all text.
  const lines = [];
  let line = '';
  for (const word of caption.split(/\s+/u)) {
    const candidate = line ? line + ' ' + word : word;
    if (line && context.measureText(candidate).width > available) {
      lines.push(line);
      line = word;
      if (lines.length === 6) break;
    } else {
      line = candidate;
    }
  }
  if (lines.length < 6) {
    lines.push(line);
  } else {
    lines[5] += '…';
  }
  context.fillStyle = '#faf7ee';
  for (let i = 0; i < lines.length; i++) {
    context.fillText(lines[i], 0, -(lines.length - 1 - i) * lineHeight, available);
  }
  if (caption !== project.title) {
    context.font = 'bold ' + headingSize + 'px Arial, sans-serif';
    context.fillStyle = '#a1f3dd';
    context.fillText(project.title, 0, -lines.length * lineHeight - edge * 0.016, available);
  }
  context.restore();
}
