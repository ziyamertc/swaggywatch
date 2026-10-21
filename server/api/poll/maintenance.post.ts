import { setMaintenance, getMaintenance } from '../../utils/settings'
import { broadcastState } from '../../utils/state'

/**
 * POST /api/poll/maintenance   header: x-admin-key: <ADMIN_KEY>
 * body: { enabled: boolean, message?: string }
 *
 * Bakım modu: açılınca tüm sayfalarda kepenk iner.
 */
export default defineEventHandler(async (event) => {
  const adminKey = process.env.ADMIN_KEY
  if (!adminKey) {
    throw createError({ statusCode: 501, statusMessage: 'ADMIN_KEY tanımlı değil' })
  }
  const given = getHeader(event, 'x-admin-key') || getCookie(event, 'sb_admin')
  if (!given || given !== adminKey) {
    throw createError({ statusCode: 403, statusMessage: 'Yetkisiz' })
  }

  const body = await readBody<{ enabled?: boolean; message?: string }>(event)
  const maintenance = await setMaintenance({
    enabled: body?.enabled === true,
    message: body?.message
  })

  // herkese anında bildir (kepenk iner / çıkar)
  await broadcastState()

  return { ok: true, maintenance }
})
