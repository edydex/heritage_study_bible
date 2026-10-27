import type { Endpoint } from 'payload'
import { authorize, connections, oauthHandler, revoke, token } from '../lib/calendarMcp/oauth.ts'
import { handleMcp } from '../lib/calendarMcp/mcp.ts'
export const calendarMcpEndpoints: Endpoint[] = [
  ...(['get','post'] as const).map(method => ({ path:'/community/calendar/oauth/authorize', method, handler:(req: Parameters<typeof authorize>[0]) => oauthHandler(req,authorize) })),
  ...(['get','post'] as const).map(method => ({ path:'/community/calendar/oauth/connections', method, handler:(req: Parameters<typeof connections>[0]) => oauthHandler(req,connections) })),
  { path:'/community/calendar/oauth/token', method:'post', handler:req => oauthHandler(req,token) },
  { path:'/community/calendar/oauth/revoke', method:'post', handler:req => oauthHandler(req,revoke) },
  ...(['get','post','delete','put','patch'] as const).map(method => ({ path:'/community/calendar/mcp', method, handler:handleMcp })),
]
