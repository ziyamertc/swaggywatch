import { clearVoteLog } from '../../utils/vote-log'

/**
 * DELETE /api/poll/log?day=YYYY-MM-DD   (header: x-admin-key VEYA admin çerezi)
 * Logu temizler (day verilmezse tüm log).
 * NOT: IP kayıtları kişisel veridir — silmek hukuki açıdan da doğru olan.
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
  const day = q.day ? String(q.day) : null
  const deleted = await clearVoteLog(day)
  return { ok: true, deleted, day: day || 'tüm günler' }
})
