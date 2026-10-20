import { getVoteLog } from '../../utils/vote-log'
import { dayKeyFor } from '~/shared/utils/day'

/**
 * GET /api/poll/log?day=YYYY-MM-DD&limit=200   (header: x-admin-key VEYA admin çerezi)
 *
 * Oylama logu: IP, tarayıcı, işletim sistemi, saat, oy.
 * YALNIZCA admin erişebilir — anahtar/çerez yoksa 403.
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

  const q = getQuery(event)
  // boş string "tüm günler" demektir (istemci henüz bugünü bilmiyor olabilir)
  const dayRaw = q.day ? String(q.day).trim() : ''
  const day = dayRaw.length ? dayRaw : null
  const limit = Math.min(500, Math.max(1, Number(q.limit) || 200))

  const { entries, stats } = await getVoteLog(day, limit)
  return { entries, stats, today: dayKeyFor(), allDays: !day }
})
