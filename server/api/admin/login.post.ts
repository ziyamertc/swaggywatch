/**
 * Yayıncı oturumu — ADMIN_KEY doğrulaması yapılır, başarılıysa httpOnly cookie
 * yazılır. Çerez olmadan kontrol uçlarına erişilemez.
 */
export default defineEventHandler(async (event) => {
  const adminKey = process.env.ADMIN_KEY
  if (!adminKey) {
    throw createError({ statusCode: 501, statusMessage: 'ADMIN_KEY tanımlı değil' })
  }

  const body = await readBody<{ key?: string }>(event)
  if (!body?.key || body.key !== adminKey) {
    throw createError({ statusCode: 403, statusMessage: 'Anahtar hatalı' })
  }

  setCookie(event, 'sb_admin', adminKey, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7   // 7 gün
  })

  return { ok: true }
})
