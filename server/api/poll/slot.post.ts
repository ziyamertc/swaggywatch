import { setSlot, getSlots, type SlotSide } from '../../utils/settings'
import { broadcastState } from '../../utils/state'

/**
 * POST /api/poll/slot   header: x-admin-key: <ADMIN_KEY>
 * body: { side: "left" | "right", config: { enabled, url, link, title, width, radius, opacity } }
 * Panelin sol/sağ boşluklarındaki reklam alanlarını yönetir.
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

  const body = await readBody<{ side?: string; config?: any }>(event)
  const side = body?.side as SlotSide
  if (side !== 'left' && side !== 'right') {
    throw createError({ statusCode: 400, statusMessage: 'side: "left" | "right" olmalı' })
  }

  const clean = await setSlot(side, body?.config ?? {})
  broadcastState()
  return { ok: true, side, slot: clean, slots: await getSlots() }
})
