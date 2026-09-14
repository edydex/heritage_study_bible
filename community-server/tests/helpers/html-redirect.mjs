// Next may stream a redirect as an HTML refresh or as a Flight error record.
// Read only those transport records; a link or ordinary page text is not a redirect.
export function htmlRedirectLocation(html) {
  const refresh = html.match(/<meta[^>]*http-equiv="refresh"[^>]*content="[^"]*url=([^"]+)"[^>]*>/i)
  if (refresh) return refresh[1].replaceAll('&amp;', '&')
  for (const script of html.matchAll(/<script\b[^>]*>self\.__next_f\.push\((.*?)\)<\/script>/gs)) {
    const chunk = JSON.parse(script[1])
    if (chunk[0] !== 1 || typeof chunk[1] !== 'string') continue
    for (const line of chunk[1].split('\n')) {
      const error = line.match(/^[\da-f]+:E(\{.*\})$/i)
      if (!error) continue
      const digest = JSON.parse(error[1]).digest
      if (typeof digest !== 'string') continue
      const redirect = digest.match(/^NEXT_REDIRECT;(?:replace|push);(.+);30[378];$/)
      if (redirect) return redirect[1]
    }
  }
  return null
}
