import { manualControl } from '../../utils/poll-state'
import { emitPollEvent } from '../../utils/bus'
import { dayKeyFor } from '~/shared/utils/day'

/**
 * POST /api/poll/control   header: x-admin-key: <ADMIN_KEY>  (veya admin çerezi)
 * body: { action: "open" | "close" | "auto" }
 *
 *  open  → oylamayı AÇ (yayın sırasında da açık tutmak için override)
 *  close → oylamayı elle kapat (otomatik olarak açılmaz)
 *  auto  → otomatik moda dön (yayın durumuna göre kendi kararını versin)
 */
export default defineEventHandler(async (event) => {
  const adminKey = process.env.ADMIN_KEY
  if (!adminKey) {
    throw createError({ statusCode: 501, statusMessage: 'ADMIN_KEY tanımlı değil — uzaktan kontrol kapalı' })
  }

  const given = getHeader(event, 'x-admin-key') || getCookie(event, 'sb_admin')
  if (!given || given !== adminKey) {
    throw createError({ statusCode: 403, statusMessage: 'Yetkisiz' })
  }

  const body = await readBody<{ action?: string }>(event)
  const action = body?.action
  if (action !== 'open' && action !== 'close' && action !== 'auto') {
    throw createError({ statusCode: 400, statusMessage: 'action: "open" | "close" | "auto" olmalı' })
  }

  const todayKey = dayKeyFor()
  const poll = await manualControl(todayKey, action)

  // 📡 Anlık güncelleme (panel + overlay)
  emitPollEvent({ type: 'state', poll: poll as any })

  return { ok: true, action, poll }
})
