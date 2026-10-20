import { clearVotes } from '../../../utils/poll-service'
import { dayKeyFor } from '~/shared/utils/day'

/**
 * POST /api/poll/votes/clear   header: x-admin-key: <ADMIN_KEY>
 * body: { scope: "today" | "all" }
 *
 *  today → bugünün oyları sıfırlanır (sayaclar 0, oy kayıtları ve trend noktaları silinir,
 *          gün satırı arşivde kalır)
 *  all   → tüm günlerin oyları, log kayıtları ve trend tamamen silinir
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

  const body = await readBody<{ scope?: string }>(event)
  const scope = body?.scope === 'all' ? 'all' : 'today'

  const todayKey = dayKeyFor()
  const result = await clearVotes(scope, todayKey)

  return { ok: true, scope, todayKey, ...result }
})
