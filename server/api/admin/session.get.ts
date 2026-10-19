/** Oturum kontrolü — çerez geçerliyse yayıncı paneli açılır. */
export default defineEventHandler((event) => {
  const adminKey = process.env.ADMIN_KEY
  if (!adminKey) return { authed: false }
  const given = getCookie(event, 'sb_admin')
  return { authed: !!given && given === adminKey }
})
