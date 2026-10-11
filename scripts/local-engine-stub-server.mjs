// Serveur STUB du moteur local — logs de démarrage autorisés.
/* eslint-disable no-console */
// -----------------------------------------------------------------------------
// Serveur STUB du moteur local (contrat local-engine.ts), à usage TEST uniquement.
// Génère de VRAIS fichiers MP4 via ffmpeg (vidéo testsrc2 + piste audio sine)
// aux dimensions/durée demandées, puis les sert.
//
//   node scripts/local-engine-stub-server.mjs [port=7860]
//
// Endpoints :
//   GET  /health        → 200 quand prêt
//   POST /              → { prompt, width, height, num_frames, fps }
//                        → { video_url } (mp4 h264 + aac)
//   GET  /files/<name>  → le mp4 généré
//
// Ce stub N'EST PAS un moteur d'inférence : il valide le PARCOURS (contrat,
// fichier réel, mesures). Les performances réelles du M4 Max restent à
// benchmarker avec le moteur choisi (Draw Things ou autre).
// -----------------------------------------------------------------------------
import http from 'node:http'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { randomUUID } from 'node:crypto'
import { mkdirSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const run = promisify(execFile)
const port = Number(process.argv[2] ?? 7860)
const dir = join(tmpdir(), 'sutra-local-engine-stub')
mkdirSync(dir, { recursive: true })

const server = http.createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'text/plain' })
    res.end('ok')
    return
  }

  if (req.method === 'GET' && req.url?.startsWith('/files/')) {
    const name = req.url.slice('/files/'.length).replace(/[^a-z0-9.-]/gi, '')
    try {
      const data = readFileSync(join(dir, name))
      res.writeHead(200, { 'Content-Type': 'video/mp4' })
      res.end(data)
    } catch {
      res.writeHead(404)
      res.end('not found')
    }
    return
  }

  if (req.method === 'POST' && req.url === '/') {
    let body = ''
    for await (const chunk of req) body += chunk
    try {
      const { width, height, num_frames, fps } = JSON.parse(body)
      const duration = num_frames / (fps || 16)
      const name = `${randomUUID()}.mp4`
      const out = join(dir, name)
      const t0 = Date.now()
      // Vraie vidéo + vraie piste audio : testsrc2 (h264) + sine 440 Hz (aac),
      // dimensions et durée EXACTES de la demande.
      await run('ffmpeg', [
        '-y',
        '-f', 'lavfi', '-i', `testsrc2=size=${width}x${height}:rate=${fps}:duration=${duration.toFixed(3)}`,
        '-f', 'lavfi', '-i', `sine=frequency=440:duration=${duration.toFixed(3)}`,
        '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p',
        '-c:a', 'aac', '-shortest',
        out,
      ])
      const computeMs = Date.now() - t0
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({
        video_url: `http://127.0.0.1:${port}/files/${name}`,
        // Provenance honnête : ce fichier vient de ffmpeg, PAS d'un modèle IA.
        generator: 'ffmpeg-testsrc2+sine',
        compute_ms: computeMs,
      }))
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: String(err) }))
    }
    return
  }

  res.writeHead(404)
  res.end()
})

server.listen(port, '127.0.0.1', () => {
  console.log(`stub moteur local prêt sur http://127.0.0.1:${port}`)
})
