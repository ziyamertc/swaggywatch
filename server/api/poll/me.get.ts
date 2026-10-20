import { getMyVote, PRESS_WINDOW_MS } from '../../utils/poll-service'
import { ipHash } from '../../utils/hash'
import { dayKeyFor } from '~/shared/utils/day'

/**
 * GET /api/poll/me
 *
 * Bu kullanıcının oy durumu (sunucu kaynaklı, istemciyle senkron sorun yaşanmaz):
 *   choice       → EVET / HAYIR
 *   pressUntil   → "Oyumu Değiştir" butonuna basma süresi (oydan itibaren 20 sn)
 *   changeUntil  → değiştirme penceresinin bitişi (butona basılınca 10 sn)
 */
export default defineEventHandler(async (event) => {
  const todayKey = dayKeyFor()
  const me = await getMyVote(todayKey, ipHash(event))
  return {
    dayKey: todayKey,
    pressWindowMs: PRESS_WINDOW_MS,
    me
  }
})
