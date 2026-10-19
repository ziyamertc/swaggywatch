/** Çerez ile oturumu kapatır. */
export default defineEventHandler((event) => {
  deleteCookie(event, 'sb_admin', { path: '/' })
  return { ok: true }
})
