import { useEffect, useRef, useState } from 'react'
import { writeTextToClipboard } from '../utils/verseSelection'

export default function SongShareDialog({ share, onClose }) {
  const dialog = useRef(null)
  const [qr, setQr] = useState('')
  const [qrError, setQrError] = useState(false)
  const [status, setStatus] = useState(share.copied ? 'Link copied' : 'Copy the link or scan the code')
  useEffect(() => {
    const node = dialog.current
    node.showModal()
    return () => node.close()
  }, [])
  useEffect(() => {
    let active = true
    import('qrcode').then(({ default: QRCode }) => QRCode.toDataURL(share.url, { width: 280, margin: 4, errorCorrectionLevel: 'M' }))
      .then(value => { if (active) setQr(value) })
      .catch(() => { if (active) setQrError(true) })
    return () => { active = false }
  }, [share.url])
  async function copyLink() {
    try { await writeTextToClipboard(share.url); setStatus('Link copied') }
    catch { setStatus('Could not copy automatically. Select the link below to copy it.') }
  }
  async function shareElsewhere() {
    try { await navigator.share({ title: share.title, url: share.url }); setStatus('Song link shared') }
    catch (error) { if (error.name !== 'AbortError') setStatus('Could not open sharing. You can copy the link instead.') }
  }
  return <dialog ref={dialog} onCancel={event => { event.preventDefault(); onClose() }} onClick={event => { if (event.target === dialog.current) onClose() }} aria-labelledby="song-share-heading" className="m-auto w-[calc(100%-2rem)] max-w-sm rounded-2xl border border-gray-200 bg-white p-6 text-gray-900 shadow-2xl backdrop:bg-black/50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100">
    <div className="flex items-center justify-between gap-3"><h2 id="song-share-heading" className="text-xl font-bold">Share song</h2><button type="button" autoFocus onClick={onClose} aria-label="Close share song" className="rounded-lg px-3 py-2">✕</button></div>
    <p role="status" className="mt-2 font-semibold text-emerald-700 dark:text-emerald-300">{status}</p>
    <p className="mt-2 text-sm">{share.title}</p>
    {qr ? <img src={qr} alt="QR code for this song link" width="280" height="280" className="mx-auto my-4 h-auto max-w-full rounded-lg bg-white" /> : <p className="my-6 text-sm">{qrError ? 'The QR code could not be created. The link below still works.' : 'Creating QR code…'}</p>}
    <p className="text-center text-sm text-gray-600 dark:text-gray-300">Scan to open this song{share.memberOnly ? ' · Church sign-in required' : ''}</p>
    <label className="mt-4 block text-sm">Song link<input readOnly value={share.url} onFocus={event => event.target.select()} className="mt-1 w-full rounded-lg border border-gray-300 bg-transparent p-2 text-sm dark:border-gray-600" /></label>
    <div className="mt-4 flex flex-wrap gap-2"><button type="button" onClick={copyLink} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white">Copy link</button>{Boolean(navigator.share) && <button type="button" onClick={shareElsewhere} className="rounded-lg border px-4 py-2 text-sm">Share elsewhere…</button>}</div>
  </dialog>
}
