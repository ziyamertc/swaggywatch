import { openChangeWindow } from '../../utils/poll-service'
import { ipHash } from '../../utils/hash'
import { dayKeyFor } from '~/shared/utils/day'

/**
 * POST /api/poll/change-window
 *
 * Oy veren kullanıcı için 60 saniyelik "oyumu değiştirebilirim" penceresi açar.
 * Pencere açılmadan oy değiştirme isteği reddedilir (409).
 */
export default defineEventHandler(async (event) => {
  const todayKey = dayKeyFor()
  const { until, poll } = await openChangeWindow(todayKey, ipHash(event), 60)

  if (!until) {
    throw createError({
      statusCode: 409,
      statusMessage: 'Önce oy vermelisin — değiştirme penceresi açılamadı'
    })
  }

  return { ok: true, until, seconds: Math.round((until - Date.now()) / 1000), poll }
})
