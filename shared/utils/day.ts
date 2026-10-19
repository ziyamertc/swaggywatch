/**
 * Gün anahtarı — TSİ (Europe/Istanbul) bazlı, gece 03:00'te gün döner.
 * 00:00–02:59 arası hâlâ "önceki gün" sayılır.
 * İstemci ve sunucu tarafında aynı kural geçerlidir.
 */
export function dayKeyFor(date = new Date()): string {
  const parts = new Intl.DateTimeFormat('tr-TR', {
    timeZone: 'Europe/Istanbul',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', hour12: false
  }).formatToParts(date)

  const get = (t: string) => {
    const p = parts.find(x => x.type === t)
    return p ? p.value : ''
  }

  const h = parseInt(get('hour'), 10)
  let y = get('year'), m = get('month'), d = get('day')

  if (h < 3) {                       // 00:00–02:59 arası hâlâ "önceki gün" sayılır
    const dt = new Date(Date.UTC(+y, +m - 1, +d))
    dt.setUTCDate(dt.getUTCDate() - 1)
    y = String(dt.getUTCFullYear())
    m = String(dt.getUTCMonth() + 1).padStart(2, '0')
    d = String(dt.getUTCDate()).padStart(2, '0')
  }
  return `${y}-${m}-${d}`
}

export function trDateName(key: string): string {
  const p = key.split('-')
  const dt = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2]))
  const mn = dt.toLocaleDateString('tr-TR', { month: 'short', timeZone: 'UTC' })
  const dn = dt.toLocaleDateString('tr-TR', { weekday: 'short', timeZone: 'UTC' })
  return `${+p[2]} ${mn} ${dn}`
}

/**
 * Bir sonraki gün sıfırlaması (TSİ 03:00) — ISO string.
 * Türkiye kalıcı UTC+3 (DST yok) olduğu için 03:00 TSİ = 00:00 UTC.
 */
export function nextResetIso(date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Istanbul',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', hour12: false
  }).formatToParts(date)

  const get = (t: string) => {
    const p = parts.find(x => x.type === t)
    return p ? p.value : ''
  }
  const h = parseInt(get('hour'), 10)
  const y = +get('year'), m = +get('month'), d = +get('day')
  const utcMs = Date.UTC(y, m - 1, d) + (h < 3 ? 0 : 24 * 3600 * 1000)
  return new Date(utcMs).toISOString()
}
