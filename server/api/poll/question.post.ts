import { setSetting, getQuestion } from '../../utils/settings'
import { broadcastState } from '../../utils/state'

/**
 * POST /api/poll/question   header: x-admin-key: <ADMIN_KEY>
 * body: { question: "Dayı bugün yayın açacak mı?" }
 * Oylama sorusunu değiştirir (panelde ve overlay'da görünür).
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

  const body = await readBody<{ question?: string }>(event)
  const question = String(body?.question ?? '').trim().slice(0, 160)
  if (!question) {
    throw createError({ statusCode: 400, statusMessage: 'Soru boş olamaz' })
  }

  await setSetting('question', question)
  broadcastState()
  return { ok: true, question: await getQuestion() }
})
