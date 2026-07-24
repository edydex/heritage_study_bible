export const CCLI_LICENSE_URL = 'https://ccli.com/us/en/church-copyright-license'
export const SOVEREIGN_GRACE_PERMISSIONS_URL = 'https://sovereigngracemusic.com/about/permissions/'

function text(value) {
  return String(value || '').trim()
}

function joinedRightsText(document) {
  return [
    document?.license,
    document?.copyright,
    document?.rightsNotes,
    document?.sourceUrl,
    document?.permissionUrl,
  ].map(text).join(' ').toLowerCase()
}

export function getSongRightsExplanation(document) {
  const rightsText = joinedRightsText(document)
  const ccli = Boolean(
    text(document?.ccliNumber)
    || text(document?.rightsStatus) === 'licensed'
    || rightsText.includes('ccli'),
  )
  const sovereignGrace = rightsText.includes('sovereign grace')
    || rightsText.includes('sovereigngracemusic.com')

  const paragraphs = []
  if (ccli) {
    paragraphs.push(
      'This church includes these lyrics under its good-faith reading of the CCLI Church Copyright License: copies displayed or printed to assist congregational singing include this unlisted, phone-friendly song sheet when it is used in the church’s services and home groups. The church—not Heritage—holds the license and remains responsible for its scope and reporting.',
    )
  }
  if (sovereignGrace) {
    paragraphs.push(
      'Sovereign Grace Music also expressly permits copying its free sheet music for individual, family, small-group, home-group, and Bible-study worship. That permission does not extend to songs Sovereign Grace recorded but does not own; co-published and outside copyrights can require permission from their owner or administrator.',
    )
  }
  if (!paragraphs.length && text(document?.rightsStatus).startsWith('public-domain')) {
    paragraphs.push(
      'The publishing church records this text as public domain. Modern tunes, arrangements, translations, scores, and recordings can have separate rights.',
    )
  }
  if (!paragraphs.length && text(document?.rightsStatus) === 'community-translation') {
    paragraphs.push(
      'The publishing church records this as a community or orally circulated translation and is responsible for its source notes and decision to publish it.',
    )
  }
  if (!paragraphs.length) {
    paragraphs.push(
      'This rights record is supplied by the publishing church. Heritage displays the church’s record but does not grant a copyright license.',
    )
  }

  return {
    ccli,
    sovereignGrace,
    paragraphs,
  }
}

export function getSongTakedownMailto(document, songTitle, songUrl) {
  const email = text(document?.communityRightsContact?.email)
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return ''
  const subject = `Song rights review: ${text(songTitle) || 'Community song'}`
  const body = [
    'I am a rights holder or representative requesting a correction or takedown review for this Community song:',
    text(songUrl),
    '',
    'Please describe the work, your relationship to it, and the requested correction or removal:',
  ].join('\n')
  return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}
