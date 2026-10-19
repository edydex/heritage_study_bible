import { parseCommunitySongMemberRoute } from './communitySongLinks.js'

const HERITAGE_WEB_HOST = 'heritage.faith'
const PLAN_NOTES_HOST = 'plannotes.heritage.faith'
const HERITAGE_APP_SCHEME = 'faith.heritage.app:'

function isSupportedRoute(route) {
  const rawRoute = String(route || '')
  const pathname = rawRoute.split(/[?#]/, 1)[0]
  if (pathname === '/community-song') {
    const query = rawRoute.includes('?') ? rawRoute.slice(rawRoute.indexOf('?') + 1) : ''
    return Boolean(parseCommunitySongMemberRoute(query))
  }
  return pathname === '/community/callback'
    || pathname === '/reading-plan-join'
}

export function getNativeRouteFromUrl(value) {
  let url
  try {
    url = new URL(String(value || ''))
  } catch {
    return ''
  }

  if (url.protocol === HERITAGE_APP_SCHEME) {
    const route = `/${url.hostname}${url.pathname}${url.search}`
    return isSupportedRoute(route) ? route : ''
  }

  if (!['http:', 'https:'].includes(url.protocol)) return ''

  if (url.hostname === HERITAGE_WEB_HOST) {
    const route = url.hash.startsWith('#/') ? url.hash.slice(1) : ''
    return isSupportedRoute(route) ? route : ''
  }

  if (url.hostname === PLAN_NOTES_HOST) {
    const route = `${url.pathname}${url.search}`
    return isSupportedRoute(route) ? route : ''
  }

  return ''
}

export function buildHeritageAppUrl(value) {
  const route = getNativeRouteFromUrl(value)
  if (!route) return ''

  const routeUrl = new URL(route, 'https://heritage.faith')
  const pathParts = routeUrl.pathname.replace(/^\/+/, '').split('/')
  const host = pathParts.shift()
  const path = pathParts.length ? `/${pathParts.join('/')}` : ''
  return `faith.heritage.app://${host}${path}${routeUrl.search}`
}
