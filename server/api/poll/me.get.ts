import { getMyVote, PRESS_WINDOW_MS } from '../../utils/poll-service'
import { voterHash } from '../../utils/hash'
import { dayKeyFor } from '~/shared/utils/day'

/**
 * GET /api/poll/me
 *
 * Bu kullanıcının oy durumu (cihaz kimliğine göre — oyla AYNI hash kullanılmalı,
 * yoksa sunucu "bu kişi oy vermiş" kaydını bulamaz ve butonlar açık kalır):
 *   choice       → EVET / HAYIR
 *   pressUntil   → "Oyumu Değiştir" butonuna basma süresi (oydan itibaren 20 sn)
 *   changeUntil  → değiştirme penceresinin bitişi (butona basılınca 10 sn)
 */
export default defineEventHandler(async (event) => {
  const todayKey = dayKeyFor()
  const me = await getMyVote(todayKey, voterHash(event))
  return {
    dayKey: todayKey,
    pressWindowMs: PRESS_WINDOW_MS,
    me
  }
})
