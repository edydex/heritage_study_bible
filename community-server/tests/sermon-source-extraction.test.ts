import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'
import JSZip from 'jszip'
import {
  extractSermonSource,
  SermonSourceExtractionError,
} from '../src/lib/syncshow/SermonSourceExtraction.ts'
import {
  createSermonSourceUploadToken,
  retainSermonSourceFromToken,
} from '../src/lib/syncshow/SermonSourceUploadToken.ts'
import { sermonMediaCommunityNamespace } from '../src/lib/syncshow/SermonMediaStore.ts'
import { storePrivateSermonObject } from '../src/lib/syncshow/SermonMediaStorage.ts'

function bytes(value: string) {
  return new TextEncoder().encode(value)
}

async function docx(text: string) {
  const zip = new JSZip()
  zip.file('[Content_Types].xml', '<Types/>')
  zip.file('word/document.xml', `<w:document><w:body><w:p><w:r><w:t>${text}</w:t></w:r></w:p></w:body></w:document>`)
  return await zip.generateAsync({ type: 'uint8array' })
}

async function pptx() {
  const zip = new JSZip()
  zip.file('[Content_Types].xml', '<Types/>')
  zip.file('ppt/slides/slide2.xml', '<p:sld><a:p><a:r><a:t>Second point</a:t></a:r></a:p></p:sld>')
  zip.file('ppt/slides/slide1.xml', '<p:sld><a:p><a:r><a:t>Faithful Prayer</a:t></a:r></a:p><a:p><a:r><a:t>Ephesians 3:14-21</a:t></a:r></a:p></p:sld>')
  zip.file('ppt/notesSlides/notesSlide1.xml', '<p:notes><a:p><a:r><a:t>Pastor note</a:t></a:r></a:p></p:notes>')
  return await zip.generateAsync({ type: 'uint8array' })
}

function minimalPdf(text: string) {
  const escaped = text.replace(/([\\()])/gu, '\\$1')
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${escaped.length + 35} >>\nstream\nBT /F1 12 Tf 72 720 Td (${escaped}) Tj ET\nendstream`,
  ]
  let source = '%PDF-1.4\n'
  const offsets = [0]
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(source, 'binary'))
    source += `${index + 1} 0 obj\n${object}\nendobj\n`
  })
  const xref = Buffer.byteLength(source, 'binary')
  source += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  for (const offset of offsets.slice(1)) {
    source += `${String(offset).padStart(10, '0')} 00000 n \n`
  }
  source += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  return new Uint8Array(Buffer.from(source, 'binary'))
}

test('text and Markdown extraction is deterministic and proposes reviewed references', async () => {
  const source = bytes('# Faithful Prayer\r\n\r\nEphesians 3:14-21 and John 15:5.\n')
  const first = await extractSermonSource(source, 'sermon.md')
  const second = await extractSermonSource(source, 'sermon.md')
  assert.deepEqual(second, first)
  assert.equal(first.format, 'markdown')
  assert.equal(first.sha256, createHash('sha256').update(source).digest('hex'))
  assert.equal(first.suggestedTitle, '# Faithful Prayer')
  assert.deepEqual(first.suggestedReferences.map(value => value.passage), [{
    bookId: 'Eph',
    startChapter: 3,
    startVerse: 14,
    endChapter: 3,
    endVerse: 21,
  }, {
    bookId: 'John',
    startChapter: 15,
    startVerse: 5,
    endChapter: 15,
    endVerse: 5,
  }])
})

test('DOCX and PPTX extraction preserves deterministic document order and speaker notes', async () => {
  const word = await extractSermonSource(
    await docx('Pastor manuscript Romans 8:1-2'),
    'pastor.docx',
  )
  assert.match(word.extractedText, /Pastor manuscript Romans 8:1-2/u)
  assert.equal(word.suggestedKind, 'manuscript')

  const slides = await extractSermonSource(await pptx(), 'notes.pptx')
  assert.match(slides.extractedText, /^Slide 1\nFaithful Prayer\nEphesians 3:14-21/u)
  assert.ok(slides.extractedText.indexOf('Slide 1') < slides.extractedText.indexOf('Slide 2'))
  assert.match(slides.extractedText, /Speaker notes 1\nPastor note/u)
  assert.equal(slides.suggestedKind, 'slide-notes')
})

test('PDF extraction reads visible page text without executing PDF code', async () => {
  const extraction = await extractSermonSource(
    minimalPdf('Faithful Prayer Romans 8:1-2'),
    'pastor.pdf',
  )
  assert.match(extraction.extractedText, /Page 1/u)
  assert.match(extraction.extractedText, /Faithful Prayer Romans 8:1-2/u)
  assert.equal(extraction.format, 'pdf')
})

test('private upload token reopens the exact retained extraction only in its Community', async t => {
  const root = await mkdtemp(path.join(tmpdir(), 'heritage-sermon-source-'))
  const previousRoot = process.env.HERITAGE_SERMON_MEDIA_PATH
  const previousSecret = process.env.PAYLOAD_SECRET
  process.env.HERITAGE_SERMON_MEDIA_PATH = root
  process.env.PAYLOAD_SECRET = 'test-only-payload-secret-that-is-long-enough'
  t.after(async () => {
    if (previousRoot === undefined) delete process.env.HERITAGE_SERMON_MEDIA_PATH
    else process.env.HERITAGE_SERMON_MEDIA_PATH = previousRoot
    if (previousSecret === undefined) delete process.env.PAYLOAD_SECRET
    else process.env.PAYLOAD_SECRET = previousSecret
    await rm(root, { recursive: true, force: true })
  })
  const original = bytes('Faithful Prayer\nRomans 8:1-2')
  const extraction = await extractSermonSource(original, 'pastor.txt')
  const namespace = sermonMediaCommunityNamespace(7)
  await storePrivateSermonObject({
    bytes: original,
    communityNamespace: namespace,
    expectedSha256: extraction.sha256,
  })
  await storePrivateSermonObject({
    bytes: bytes(extraction.extractedText),
    communityNamespace: namespace,
    expectedSha256: extraction.extractedTextSha256,
  })
  const token = createSermonSourceUploadToken(extraction, 7)
  const retained = await retainSermonSourceFromToken(token, 7)
  assert.equal(retained.extractedText, extraction.extractedText)
  assert.equal(retained.payload.sha256, extraction.sha256)
  await assert.rejects(
    retainSermonSourceFromToken(token, 8),
    /retained pastor source token is invalid/i,
  )
})

test('unsupported, mislabeled, and textless sources fail closed', async () => {
  await assert.rejects(
    extractSermonSource(bytes('not a PDF'), 'pastor.pdf'),
    (error: unknown) => (
      error instanceof SermonSourceExtractionError
      && error.code === 'INVALID_PDF'
    ),
  )
  await assert.rejects(
    extractSermonSource(bytes('ordinary text'), 'pastor.rtf'),
    (error: unknown) => (
      error instanceof SermonSourceExtractionError
      && error.code === 'UNSUPPORTED_SOURCE_TYPE'
    ),
  )
})
