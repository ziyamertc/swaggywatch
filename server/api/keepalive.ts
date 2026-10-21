import { getKeepAliveState, pingSelf } from '../utils/keepalive'

/**
 * GET  /api/keepalive → keep-alive durumu
 * POST /api/keepalive → şimdi ping at (test için)
 */
export default defineEventHandler(async (event) => {
  if (event.method === 'POST') {
    const r = await pingSelf()
    return { ok: r.ok, ...getKeepAliveState(), result: r.result, error: r.error }
  }
  return getKeepAliveState()
})
