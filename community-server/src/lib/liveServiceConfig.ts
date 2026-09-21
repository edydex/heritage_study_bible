const videoIdPattern = /^[A-Za-z0-9_-]{11}$/
const channelIdPattern = /^UC[A-Za-z0-9_-]{22}$/

function youtubeUrl(value: unknown): URL | null {
  if (typeof value !== 'string' || value.length > 2048) return null
  try {
    const url = new URL(value.trim())
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return null
    if (!['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be'].includes(url.hostname)) return null
    return url
  } catch { return null }
}

export function youtubeVideoId(value: unknown): string | null {
  const url = youtubeUrl(value)
  if (!url) return null
  const parts = url.pathname.split('/').filter(Boolean)
  const id = url.hostname === 'youtu.be' && parts.length === 1 ? parts[0]
    : url.pathname === '/watch' ? url.searchParams.get('v')
      : ['live', 'embed', 'shorts'].includes(parts[0] || '') && parts.length === 2 ? parts[1] : null
  return id && videoIdPattern.test(id) ? id : null
}

export function youtubeChannel(value: unknown): { url: string; handle?: string; id?: string } | null {
  const url = youtubeUrl(value)
  if (!url || url.hostname === 'youtu.be') return null
  const parts = url.pathname.split('/').filter(Boolean)
  if (parts[0] === 'channel' && parts.length === 2 && channelIdPattern.test(parts[1]!)) {
    return { url: `https://www.youtube.com/channel/${parts[1]}`, id: parts[1] }
  }
  let handle: string
  try { handle = decodeURIComponent(parts[0] || '') } catch { return null }
  if (parts.length === 1 && /^@[\p{L}\p{N}_.-]{3,50}$/u.test(handle)) {
    return { url: `https://www.youtube.com/${parts[0]}`, handle }
  }
  return null
}

export function publicTranslationUrl(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 2048) return null
  if (value === '/translate') return value
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) return null
    return url.href
  } catch { return null }
}

export type LiveServiceSettings = {
  churchName: string
  channelUrl: string | null
  videoId: string | null
  translationUrl: string | null
  broadcastDelaySeconds: number
}

/** Explicit public shape: operator/provider credentials never belong in church settings. */
export function publicLiveServiceSettings(community: Record<string, unknown>): LiveServiceSettings {
  const live = community.liveService && typeof community.liveService === 'object'
    ? community.liveService as Record<string, unknown> : {}
  const delay = Number(live.broadcastDelaySeconds)
  return {
    churchName: typeof community.name === 'string' ? community.name : 'Church community',
    channelUrl: youtubeChannel(live.youtubeChannelUrl)?.url ?? null,
    videoId: youtubeVideoId(live.youtubeVideoUrl),
    translationUrl: publicTranslationUrl(live.translationUrl),
    broadcastDelaySeconds: Number.isFinite(delay) && delay >= 0 && delay <= 180 ? delay : 0,
  }
}
