import test, { beforeEach, mock } from 'node:test'
import assert from 'node:assert/strict'

let authenticated = true
let authError = false
let authFailure = false
let translationCalls = 0

globalThis.fetch = async () => { throw new Error('UNEXPECTED_NETWORK') }

mock.module('../src/lib/supabase-server.ts', {
  namedExports: {
    createServerClient: async () => {
      if (authFailure) throw new Error('Synthetic authentication service failure')
      return {
        auth: {
          getUser: async () => ({
            data: { user: authenticated ? { id: 'synthetic-subtitle-user' } : null },
            error: authError ? { message: 'Synthetic authentication refusal' } : null,
          }),
        },
      }
    },
  },
})
mock.module('../src/lib/claude.ts', {
  namedExports: {
    askClaude: async () => {
      translationCalls++
      return 'Hello world.'
    },
  },
})

// The real handler, subtitle generators, SRT serializer and NextResponse execute.
// Only authentication and the external translation boundary are synthetic.
const { POST } = await import('../src/app/api/subtitles/route.ts')
const { POST: exportSubtitles } = await import('../src/app/api/subtitles/export/route.ts')
const { parseSRT } = await import('../src/lib/subtitles.ts')

beforeEach(() => {
  authenticated = true
  authError = false
  authFailure = false
  translationCalls = 0
})

const request = (body: string) => new Request('https://subtitle-test.invalid/api/subtitles', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body,
})
const submit = (body: unknown) => POST(request(JSON.stringify(body)))

for (const refusedBy of ['missing user', 'authentication error'] as const) {
  test(`authentication precedes JSON parsing: ${refusedBy}`, async () => {
    authenticated = refusedBy !== 'missing user'
    authError = refusedBy === 'authentication error'
    const req = request('{')
    let bodyReads = 0
    mock.method(req, 'json', async () => { bodyReads++; throw new Error('Body must remain unread') })
    const response = await POST(req)
    assert.equal(response.status, 401)
    assert.equal(bodyReads, 0)
    assert.equal(translationCalls, 0)
  })
}

test('an authentication service failure remains a server error', async () => {
  authFailure = true
  assert.equal((await POST(request('{'))).status, 500)
  assert.equal(translationCalls, 0)
})

for (const [name, body] of [
  ['empty', ''],
  ['truncated', '{"narration":'],
  ['trailing comma', '{"narration":"synthetic-private-marker","duration":3,}'],
] as const) {
  test(`malformed JSON is a client error: ${name}`, async () => {
    const response = await POST(request(body))
    assert.equal(response.status, 400)
    const data = await response.json()
    assert.equal(data.error, 'Corps JSON invalide')
    assert.doesNotMatch(JSON.stringify(data), /synthetic-private-marker|SyntaxError|JSON\.parse/)
    assert.equal(translationCalls, 0)
  })
}

for (const body of [null, [], 'Bonjour.', true, 42]) {
  test(`a JSON object is required: ${JSON.stringify(body)}`, async () => {
    assert.equal((await submit(body)).status, 400)
    assert.equal(translationCalls, 0)
  })
}

for (const narration of [undefined, '', '  \n\t ', null, 42]) {
  test(`invalid narration is rejected before translation: ${JSON.stringify(narration)}`, async () => {
    const response = await submit({ narration, duration: 3, targetLang: 'en' })
    assert.equal(response.status, 400)
    assert.equal(translationCalls, 0)
  })
}

for (const [name, duration] of [
  ['missing', undefined],
  ['null', null],
  ['zero', 0],
  ['negative', -1],
  ['numeric string', '3'],
  ['boolean', true],
  ['finite seconds overflowing milliseconds', 1e308],
  ['milliseconds beyond exact integer precision', (Number.MAX_SAFE_INTEGER + 1) / 1000],
] as const) {
  test(`invalid duration is rejected before translation: ${name}`, async () => {
    const response = await submit({ narration: 'Bonjour.', duration, targetLang: 'en' })
    assert.equal(response.status, 400)
    assert.equal(translationCalls, 0)
  })
}

test('a JSON exponent overflowing to Infinity is rejected before translation', async () => {
  const response = await POST(request('{"narration":"Bonjour.","duration":1e309,"targetLang":"en"}'))
  assert.equal(response.status, 400)
  assert.equal(translationCalls, 0)
})

const styleCases = [
  {
    style: 'classic',
    subtitles: [{ text: 'Bonjour monde.', start: 0, end: 3 }],
    srt: '1\n00:00:00,000 --> 00:00:03,000\nBonjour monde.',
  },
  {
    style: 'tiktok',
    subtitles: [{ text: 'BONJOUR MONDE.', start: 0, end: 3 }],
    srt: '1\n00:00:00,000 --> 00:00:03,000\nBONJOUR MONDE.',
  },
  {
    style: 'karaoke',
    subtitles: [{ text: 'Bonjour', start: 0, end: 1.5 }, { text: 'monde.', start: 1.5, end: 3 }],
    srt: '1\n00:00:00,000 --> 00:00:01,500\nBonjour\n\n2\n00:00:01,500 --> 00:00:03,000\nmonde.',
  },
  {
    style: 'minimal',
    subtitles: [{ text: 'Bonjour monde.', start: 0, end: 3 }],
    srt: '1\n00:00:00,000 --> 00:00:03,000\nBonjour monde.',
  },
] as const

for (const { style, subtitles, srt } of styleCases) {
  test(`valid ${style} subtitles and SRT follow their style contract`, async () => {
    const response = await submit({ narration: 'Bonjour monde.', duration: 3, style })
    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), { subtitles, srt })
    assert.equal(translationCalls, 0)
  })
}

test('omitting the style preserves the classic default', async () => {
  const response = await submit({ narration: 'Bonjour monde.', duration: 3 })
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), {
    subtitles: styleCases[0].subtitles,
    srt: styleCases[0].srt,
  })
  assert.equal(translationCalls, 0)
})

test('positive fractional durations remain accepted with millisecond rounding', async () => {
  const response = await submit({ narration: 'Bonjour.', duration: 1 / 3, style: 'karaoke' })
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), {
    subtitles: [{ text: 'Bonjour.', start: 0, end: 0.333 }],
    srt: '1\n00:00:00,000 --> 00:00:00,333\nBonjour.',
  })
})

test('representable long durations are accepted without a business duration ceiling', async () => {
  for (const duration of [360_000, Number.MAX_SAFE_INTEGER / 1000]) {
    const response = await submit({ narration: 'Bonjour.', duration, style: 'karaoke' })
    assert.equal(response.status, 200)
    const data = await response.json()
    assert.deepEqual(data.subtitles, [{ text: 'Bonjour.', start: 0, end: duration }])
    assert.doesNotMatch(data.srt, /NaN|Infinity|e\+/)
    assert.match(data.srt, /^1\n00:00:00,000 --> \d{2,}:\d{2}:\d{2},\d{3}\nBonjour\.$/)
  }
})

test('valid translation still uses the real subtitle pipeline once', async () => {
  const response = await submit({ narration: 'Bonjour monde.', duration: 3, targetLang: 'en' })
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), {
    subtitles: [{ text: 'Hello world.', start: 0, end: 3 }],
    srt: '1\n00:00:00,000 --> 00:00:03,000\nHello world.',
  })
  assert.equal(translationCalls, 1)
})

type Cue = { text: string; start: number; end: number }
type GeneratedSubtitles = { subtitles: Cue[]; srt: string }
const normalizeWhitespace = (text: string) => text.trim().split(/\s+/).join(' ')

function assertCompleteMinimalTimeline(subtitles: Cue[], narration: string, duration: number) {
  assert.ok(subtitles.length > 0)
  assert.equal(subtitles.map(cue => cue.text).join(' '), normalizeWhitespace(narration))
  let previousEnd = 0
  for (const cue of subtitles) {
    assert.ok(cue.text.trim())
    assert.ok(cue.text.split(/\s+/).length <= 6, 'a minimal cue contains at most six words')
    assert.ok(Number.isFinite(cue.start) && Number.isFinite(cue.end))
    assert.equal(cue.start, previousEnd, 'no artificial gaps or overlaps')
    assert.ok(cue.start >= 0 && cue.end >= cue.start && cue.end <= duration)
    previousEnd = cue.end
  }
  assert.equal(previousEnd, duration, 'the numerical timeline covers the supplied duration')
}

test('minimal retains the end of a long sentence instead of discarding its words', async () => {
  const narration = 'Merci de garder tous les mots de ma phrase sans omission.'
  const response = await submit({ narration, duration: 6, style: 'minimal' })
  assert.equal(response.status, 200)
  const data = await response.json() as GeneratedSubtitles
  assertCompleteMinimalTimeline(data.subtitles, narration, 6)
  assert.deepEqual(data.subtitles, [
    { text: 'Merci de garder tous les mots', start: 0, end: 3 },
    { text: 'de ma phrase sans omission.', start: 3, end: 6 },
  ])
  assert.equal(translationCalls, 0)
})

for (const narration of [
  'Un deux trois quatre cinq six.',
  'Un deux trois quatre cinq six sept !',
  '  Je\tne veux pas perdre ces mots.\nNi les suivants… « Merci ! »  ',
  'Écrire, lire et comprendre : chaque mot compte, y compris « non », 42 et l’apostrophe.',
]) {
  test(`minimal preserves punctuation and all words: ${narration.trim()}`, async () => {
    const response = await submit({ narration, duration: 12, style: 'minimal' })
    assert.equal(response.status, 200)
    const data = await response.json() as GeneratedSubtitles
    assertCompleteMinimalTimeline(data.subtitles, narration, 12)
    assert.equal(parseSRT(data.srt).map(cue => cue.text).join(' '), normalizeWhitespace(narration))
    assert.equal(translationCalls, 0)
  })
}

for (const duration of [Number.MIN_VALUE, 0.0001, 0.001, 1 / 3, 6, 3599.9996, Number.MAX_SAFE_INTEGER / 1000]) {
  test(`minimal keeps the existing positive-duration contract: ${duration}`, async () => {
    const narration = 'Un deux trois quatre cinq six sept huit neuf dix onze douze treize.'
    const response = await submit({ narration, duration, style: 'minimal' })
    assert.equal(response.status, 200)
    const data = await response.json() as GeneratedSubtitles
    assertCompleteMinimalTimeline(data.subtitles, narration, duration)
    assert.doesNotMatch(data.srt, /NaN|Infinity|e\+/)
    assert.equal(translationCalls, 0)
  })
}

test('minimal generation and the existing export endpoint keep the complete text', async () => {
  const narration = 'La première phrase garde ses sept mots. La deuxième garde aussi sa ponctuation !'
  const generated = await submit({ narration, duration: 10, style: 'minimal' })
  assert.equal(generated.status, 200)
  const data = await generated.json() as GeneratedSubtitles
  const exported = await exportSubtitles(new Request('https://subtitle-test.invalid/api/subtitles/export', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subtitles: data.subtitles }),
  }))
  assert.equal(exported.status, 200)
  assert.equal(exported.headers.get('Content-Disposition'), 'attachment; filename="subtitles.srt"')
  const srt = await exported.text()
  assert.equal(srt, data.srt)
  const exportedCues = parseSRT(srt)
  assert.equal(exportedCues.map(cue => cue.text).join(' '), narration)
  assert.equal(exportedCues[0].start, 0)
  assert.equal(exportedCues.at(-1)?.end, 10)
  assert.equal(translationCalls, 0)
})

for (const [duration, endTime] of [
  [0.9996, '00:00:01,000'],
  [59.9996, '00:01:00,000'],
  [3599.9996, '01:00:00,000'],
] as const) {
  test(`minimal SRT rounding carries milliseconds correctly at ${duration}s`, async () => {
    const response = await submit({ narration: 'Bonjour.', duration, style: 'minimal' })
    assert.equal(response.status, 200)
    const data = await response.json() as GeneratedSubtitles
    assert.equal(data.subtitles[0].end, duration)
    assert.equal(data.srt, `1\n00:00:00,000 --> ${endTime}\nBonjour.`)
  })
}

const importedSRT = [
  '1',
  '00:00:01,125 --> 00:00:03,500',
  'Ne traversez pas.',
  'Attendez  ici !',
  '',
  '2',
  '00:00:04,250 --> 00:00:06,750',
  'Merci,\tÉlodie… سلام',
].join('\n')
const importedCues: Cue[] = [
  { text: 'Ne traversez pas.\nAttendez  ici !', start: 1.125, end: 3.5 },
  { text: 'Merci,\tÉlodie… سلام', start: 4.25, end: 6.75 },
]

for (const [name, source] of [
  ['LF', importedSRT],
  ['LF with a UTF-8 BOM', '\uFEFF' + importedSRT],
  ['CRLF', importedSRT.replace(/\n/g, '\r\n')],
  ['CRLF with a UTF-8 BOM', '\uFEFF' + importedSRT.replace(/\n/g, '\r\n')],
  ['CR', importedSRT.replace(/\n/g, '\r')],
  ['blank LF separator lines containing spaces and tabs', importedSRT.replace('\n\n', '\n \t\n\t \n')],
  ['blank CRLF separator lines containing spaces and tabs', importedSRT.replace('\n\n', '\n \t\n\t \n').replace(/\n/g, '\r\n')],
  ['mixed line endings', importedSRT.replace('1\n', '1\r\n').replace('\n\n', '\r\n\r\n')],
] as const) {
  test(`SRT import preserves cue text and timestamps with ${name}`, () => {
    assert.deepEqual(parseSRT(source), importedCues)
    assert.equal(translationCalls, 0)
  })
}

test('empty SRT files and a BOM with only blank lines contain no cues', () => {
  for (const source of ['', '\uFEFF', '\uFEFF\r\n \t\r\n\r\n']) {
    assert.deepEqual(parseSRT(source), [])
  }
})

test('a Windows SRT import can be exported without merging cues or changing their timings', async () => {
  const subtitles = parseSRT('\uFEFF' + importedSRT.replace(/\n/g, '\r\n'))
  const response = await exportSubtitles(new Request('https://subtitle-test.invalid/api/subtitles/export', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subtitles }),
  }))
  assert.equal(response.status, 200)
  assert.equal(await response.text(), importedSRT)
  assert.equal(translationCalls, 0)
})
