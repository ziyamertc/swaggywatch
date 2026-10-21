import { openChangeWindow } from '../../utils/poll-service'
import { voterHash } from '../../utils/hash'
import { dayKeyFor } from '~/shared/utils/day'

/**
 * POST /api/poll/change-window
 *
 * Oy veren kullanıcı için 10 saniyelik "oyumu değiştirebilirim" penceresi açar.
 * Pencere açılmadan oy değiştirme isteği reddedilir (409).
 */
export default defineEventHandler(async (event) => {
  const todayKey = dayKeyFor()
  // Oyuncu kimliği cihaza bağlı (IP değil) — oyla aynı hash kullanılmalı
  const { until, poll } = await openChangeWindow(todayKey, voterHash(event), 10)

  if (!until) {
    throw createError({
      statusCode: 409,
      statusMessage: 'Önce oy vermelisin — değiştirme penceresi açılamadı'
    })
  }

  return { ok: true, until, seconds: Math.round((until - Date.now()) / 1000), poll }
})
