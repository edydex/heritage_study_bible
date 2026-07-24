import {
  CCLI_LICENSE_URL,
  SOVEREIGN_GRACE_PERMISSIONS_URL,
  getSongRightsExplanation,
  getSongTakedownMailto,
} from '../utils/songRights'

function resolveHttpUrl(value, baseUrl) {
  if (typeof value !== 'string' || !value.trim()) return ''
  try {
    const url = new URL(value.trim(), baseUrl)
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return ''
    return url.href
  } catch {
    return ''
  }
}

function friendlyStatus(value) {
  return String(value || '')
    .split('-')
    .filter(Boolean)
    .map(word => word[0]?.toUpperCase() + word.slice(1))
    .join(' ')
}

export default function SongRightsDisclosure({ document, songTitle, contentUrl }) {
  if (!document || typeof document !== 'object') return null
  const explanation = getSongRightsExplanation(document)
  const sourceUrl = resolveHttpUrl(document.sourceUrl, contentUrl)
  const permissionUrl = resolveHttpUrl(document.permissionUrl, contentUrl)
  const communityUrl = resolveHttpUrl(document.communityRightsContact?.communityUrl, contentUrl)
  const takedownMailto = getSongTakedownMailto(document, songTitle, contentUrl)
  const rightsRecord = document.rightsNotes
    || document.rightsLabel
    || document.copyright
    || document.license
    || friendlyStatus(document.rightsStatus)
  const ccliNumber = String(document.ccliNumber || '').trim()
  const ccliLicenseNumber = String(document.communityRightsContact?.ccliLicenseNumber || '').trim()

  return (
    <details className="group rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-950 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-100">
      <summary className="cursor-pointer list-none font-semibold underline decoration-dotted underline-offset-4">
        License, source, and sharing explanation
      </summary>
      <div className="mt-3 space-y-3 leading-relaxed">
        {rightsRecord && <p><strong>Church rights record:</strong> {rightsRecord}</p>}
        {ccliNumber && <p><strong>CCLI Song #:</strong> {ccliNumber}</p>}
        {explanation.ccli && ccliLicenseNumber && <p><strong>Church CCLI License #:</strong> {ccliLicenseNumber}</p>}
        {explanation.paragraphs.map(paragraph => <p key={paragraph}>{paragraph}</p>)}
        <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs font-semibold">
          {explanation.ccli && <a href={CCLI_LICENSE_URL} target="_blank" rel="noreferrer" className="underline">CCLI license description</a>}
          {explanation.sovereignGrace && <a href={SOVEREIGN_GRACE_PERMISSIONS_URL} target="_blank" rel="noreferrer" className="underline">Sovereign Grace permissions</a>}
          {sourceUrl && <a href={sourceUrl} target="_blank" rel="noreferrer" className="underline">Text/source record</a>}
          {permissionUrl && permissionUrl !== CCLI_LICENSE_URL && permissionUrl !== SOVEREIGN_GRACE_PERMISSIONS_URL && (
            <a href={permissionUrl} target="_blank" rel="noreferrer" className="underline">Church permission record</a>
          )}
        </div>
        <p className="border-t border-blue-200 pt-3 text-xs dark:border-blue-800">
          <strong>Rights holder?</strong>{' '}
          {takedownMailto ? (
            <a href={takedownMailto} className="font-semibold underline">
              Request an attribution correction or takedown review
            </a>
          ) : communityUrl ? (
            <>
              <a href={communityUrl} target="_blank" rel="noreferrer" className="font-semibold underline">Contact the publishing Community</a>
              {' '}to request an attribution correction or removal.
            </>
          ) : (
            'Contact the publishing church or Heritage to request an attribution correction or removal.'
          )}
        </p>
      </div>
    </details>
  )
}
