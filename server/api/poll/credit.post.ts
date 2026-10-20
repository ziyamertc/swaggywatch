import { setCredit, getCredit } from '../../utils/settings'
import { broadcastState } from '../../utils/state'

/**
 * POST /api/poll/credit   header: x-admin-key: <ADMIN_KEY>
 * body: { visible, label, name, url }
 *
 * Sayfanın en altındaki "Developed by ..." imzasını düzenler.
 *  label → ön ek (düz yazı)   name → nickname (parlak)   url → tıklanınca gidilecek adres
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

  const body = await readBody<any>(event)
  const credit = await setCredit({
    visible: body?.visible,
    label: body?.label,
    name: body?.name,
    url: body?.url
  })

  // anında tüm ekranlara yansı
  broadcastState()

  return { ok: true, credit }
})
