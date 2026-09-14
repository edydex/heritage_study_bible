import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { validateOggOpusRecording } from '../src/lib/syncshow/OggOpusRecording.ts'

const tone = await readFile(new URL('./fixtures/recording-tone.opus', import.meta.url))
const validate = (bytes: Buffer) => validateOggOpusRecording(async (offset, size) =>
  offset + size <= bytes.length ? bytes.subarray(offset, offset + size) : null, bytes.length)

test('accepts a complete FFmpeg-encoded recording without decoding or whole-file buffering', async () => {
  let largestRead = 0
  assert.equal(await validateOggOpusRecording(async (offset, size) => {
    largestRead = Math.max(largestRead, size)
    return offset + size <= tone.length ? tone.subarray(offset, offset + size) : null
  }, tone.length), true)
  assert.ok(largestRead <= 65_307)
})

test('rejects damage, truncation, missing headers/end, another serial and appended streams', async () => {
  for (const bytes of [tone.subarray(0, -1), tone.subarray(47), Buffer.concat([tone, tone])]) {
    assert.equal(await validate(bytes), false)
  }
  for (const index of [0, 4, 5, 14, 18, 22, 28, tone.length - 1]) {
    const changed = Buffer.from(tone)
    changed[index] ^= 1
    assert.equal(await validate(changed), false, `Corruption at ${index}`)
  }
})

test('rejects arbitrary renamed and empty content', async () => {
  for (const bytes of [Buffer.alloc(0), Buffer.from('<script>alert(1)</script>'), Buffer.alloc(256)]) {
    assert.equal(await validate(bytes), false)
  }
})

// Recompute page CRCs independently so these cases exercise header semantics,
// rather than all failing at the first damaged checksum.
function editPage(index: number, change: (page: Buffer) => void) {
  const bytes = Buffer.from(tone)
  let offset = 0
  for (let current = 0; offset < bytes.length; current++) {
    const count = bytes[offset + 26]
    const laces = bytes.subarray(offset + 27, offset + 27 + count)
    const size = 27 + count + laces.reduce((sum, n) => sum + n, 0)
    if (current === index) {
      const page = bytes.subarray(offset, offset + size)
      change(page)
      page.writeUInt32LE(0, 22)
      let crc = 0
      for (const byte of page) {
        crc ^= byte << 24
        for (let bit = 0; bit < 8; bit++) crc = (crc << 1) ^ ((crc & 0x80000000) ? 0x04c11db7 : 0)
      }
      page.writeUInt32LE(crc >>> 0, 22)
      return bytes
    }
    offset += size
  }
  throw new Error('Fixture page not found')
}

test('valid checksums do not excuse invalid Opus headers or Ogg stream structure', async () => {
  const cases = [
    editPage(0, page => { page[28 + 8] = 16 }), // incompatible Opus version
    editPage(0, page => { page[28 + 9] = 0 }), // missing channel
    editPage(0, page => { page[28 + 18] = 1 }), // unsupported mapping family
    editPage(1, page => { page.writeUInt32LE(0xffffffff, 28 + 8) }), // oversized tag vendor
    editPage(1, page => { page.writeUInt32LE(70, 18) }), // out-of-order page
    editPage(1, page => { page.writeUInt32LE(page.readUInt32LE(14) ^ 1, 14) }), // another stream
    editPage(2, page => { page[5] &= ~4 }), // absent end-of-stream
    editPage(2, page => { page[5] |= 1 }), // continuation without an earlier packet
    editPage(2, page => { page.writeBigInt64LE(0n, 6) }), // no playable samples
  ]
  for (let index = 0; index < cases.length; index++) assert.equal(await validate(cases[index]), false, `Case ${index}`)
})
