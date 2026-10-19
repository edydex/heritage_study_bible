type UnknownRecord = Record<string, unknown>

function memberMediaProjection(value: unknown) {
  if (!Array.isArray(value)) return []
  return value.map(item => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      return { id: String(item || '') }
    }
    const media = item as UnknownRecord
    return {
      id: String(media.id || ''),
      url: String(media.url || ''),
      filename: String(media.filename || ''),
      mimeType: String(media.mimeType || ''),
      filesize: Number.isFinite(Number(media.filesize))
        ? Number(media.filesize)
        : null,
      width: Number.isFinite(Number(media.width)) ? Number(media.width) : null,
      height: Number.isFinite(Number(media.height)) ? Number(media.height) : null,
      alt: String(media.alt || ''),
      credit: String(media.credit || ''),
    }
  })
}

/**
 * Explicit signed-in-member projection. Sync documents, receipt pointers,
 * permission evidence, internal rights notes, source URLs, audit metadata, and
 * Payload bookkeeping are intentionally absent.
 */
export function memberSongContentProjection(raw: UnknownRecord) {
  return {
    id: String(raw.id || ''),
    syncId: String(raw.syncId || ''),
    title: String(raw.title || ''),
    description: String(raw.description || ''),
    russianTitle: String(raw.russianTitle || ''),
    alternateTitles: Array.isArray(raw.alternateTitles)
      ? raw.alternateTitles.map(String)
      : [],
    authors: Array.isArray(raw.authors) ? raw.authors.map(String) : [],
    lyrics: String(raw.lyrics || ''),
    chordSheet: String(raw.chordSheet || ''),
    russianLyrics: String(raw.russianLyrics || ''),
    russianChordSheet: String(raw.russianChordSheet || ''),
    key: String(raw.key || ''),
    tempo: Number.isFinite(Number(raw.tempo)) ? Number(raw.tempo) : null,
    ccliNumber: String(raw.ccliNumber || ''),
    license: String(raw.license || ''),
    copyright: String(raw.copyright || ''),
    choirScores: memberMediaProjection(raw.choirScores),
    recordings: memberMediaProjection(raw.recordings),
  }
}
