const fail = (message) => {
  throw new Error(message)
}
const string = (value, max = 10000) =>
  typeof value === 'string' && value.length <= max
    ? value
    : fail('Invalid book text.')
const finite = (value) =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0
export function normalizeReadAlong(value) {
  if (
    value?.schema !== 'heritage-book-readalong/v1' ||
    !Array.isArray(value.chapters) ||
    !value.chapters.length ||
    value.chapters.length > 200
  )
    fail('Choose a read-along book with 1–200 chapters.')
  let totalWords = 0,
    totalText = 0
  const ids = new Set()
  const chapters = value.chapters.map((ch) => {
    if (!/^[a-zA-Z0-9_-]{1,80}$/.test(ch.id) || ids.has(ch.id))
      fail('Chapter identities must be unique.')
    ids.add(ch.id)
    if (
      !finite(ch.duration) ||
      ch.duration > 43200 ||
      !/^[a-f0-9]{64}$/.test(ch.audioSha256) ||
      !Number.isSafeInteger(ch.audioSize) ||
      ch.audioSize < 1 ||
      ch.audioSize > 100 * 1024 * 1024
    )
      fail('Invalid chapter audio metadata.')
    if (
      !Array.isArray(ch.paragraphs) ||
      !Array.isArray(ch.words) ||
      ch.paragraphs.length > 20000
    )
      fail('Invalid chapter text.')
    totalWords += ch.words.length
    if (totalWords > 500000) fail('This book has too many timed words.')
    const paragraphs = ch.paragraphs.map((p) => ({
      id: string(p.id, 100),
      text: string(p.text, 100000),
      kind: p.kind === 'heading' ? 'heading' : 'paragraph',
    }))
    const byId = new Map(paragraphs.map((p) => [p.id, p]))
    if (byId.size !== paragraphs.length)
      fail('Paragraph identities must be unique.')
    totalText += paragraphs.reduce((n, p) => n + p.text.length, 0)
    if (totalText > 5000000) fail('This book is too large.')
    let lastStart = -1
    const words = ch.words.map((w) => {
      const p = byId.get(w.paragraphId)
      if (
        !p ||
        !finite(w.start) ||
        !finite(w.end) ||
        w.start < lastStart ||
        w.end < w.start ||
        w.end > ch.duration + 0.5 ||
        !Number.isInteger(w.sourceStart) ||
        !Number.isInteger(w.sourceEnd) ||
        w.sourceStart < 0 ||
        w.sourceEnd <= w.sourceStart ||
        w.sourceEnd > p.text.length
      )
        fail('A word timestamp or text location is invalid.')
      lastStart = w.start
      return {
        paragraphId: p.id,
        start: w.start,
        end: w.end,
        sourceStart: w.sourceStart,
        sourceEnd: w.sourceEnd,
      }
    })
    return {
      id: ch.id,
      title: string(ch.title, 300),
      duration: ch.duration,
      audioSha256: ch.audioSha256,
      audioSize: ch.audioSize,
      paragraphs,
      words,
    }
  })
  return {
    schema: 'heritage-book-readalong/v1',
    language: string(value.language, 20),
    voice: string(value.voice || '', 200),
    synthetic: value.synthetic === true,
    license: string(value.license || '', 1000),
    chapters,
  }
}

/** Read the supplied folder without importing the PDF, experiments, or voice training files. */
export async function readAlongFolder(files) {
  const all = Array.from(files),
    manifestFile = all.find((f) => f.name === 'manifest.json')
  if (!manifestFile)
    fail('Choose the folder containing manifest.json, audio, and timings.')
  const manifest = JSON.parse(await manifestFile.text())
  if (manifest.schema !== 'heritage-private-audiobook/v1')
    fail('Unsupported read-along manifest.')
  const base = (manifestFile.webkitRelativePath || manifestFile.name).replace(
    /manifest\.json$/,
    '',
  )
  const get = (name) => {
    if (typeof name !== 'string' || name.includes('..') || name.startsWith('/'))
      fail('Invalid package filename.')
    const file = all.find(
      (f) => (f.webkitRelativePath || f.name) === base + name,
    )
    if (!file) fail(`Missing ${name}`)
    return file
  }
  const audioFiles = new Map(),
    chapters = []
  for (const ch of manifest.chapters || []) {
    const audio = get(ch.audio),
      timing = JSON.parse(await get(ch.timings).text())
    if (timing.audioSha256 !== ch.audioSha256 || timing.id !== ch.id)
      fail('Chapter timings do not match the recording.')
    chapters.push({
      ...ch,
      audioSize: audio.size,
      paragraphs: timing.paragraphs,
      words: timing.words,
    })
    audioFiles.set(ch.id, audio)
  }
  return {
    readAlong: normalizeReadAlong({
      ...manifest,
      schema: 'heritage-book-readalong/v1',
      chapters,
    }),
    audioFiles,
  }
}

export function canReadBook(book, access) {
  return Boolean(
    access.manager ||
    (book.status === 'published' &&
      (book.visibility === 'public' || access.authenticated)),
  )
}
export function bookProjection(book) {
  return {
    schemaVersion: 1,
    contentType: 'books',
    id: String(book.id),
    title: book.title,
    author: book.author,
    description: book.description,
    license: book.license,
    publishedYear: book.publishedYear,
    body: book.body,
    files: book.files || [],
    visibility: book.visibility,
    readAlong: book.readAlong || null,
  }
}
