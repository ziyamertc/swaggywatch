import { createHmac } from 'node:crypto'

/**
 * Oy verenin kimliği: IP'nin HMAC-SHA256 özeti.
 * Ham IP asla bu hash'e eklenmez; günlük tablosunda ayrıca saklanır (moderasyon için).
 */
export function ipHash(event: any): string {
  const secret = process.env.VOTE_SECRET || 'swaggybark-geçici-anahtar-DEĞİŞTİR'
  return createHmac('sha256', secret).update(getClientIp(event)).digest('hex').slice(0, 32)
}

/** İstemcinin ham IP adresi (x-forwarded-for → x-real-ip → cf-connecting-ip). */
export function getClientIp(event: any): string {
  const req = event.node?.req ?? event.req
  const h = req?.headers || {}
  const ip =
    (h['x-forwarded-for']?.split(',')[0]?.trim()) ||
    h['x-real-ip'] ||
    h['cf-connecting-ip'] ||
    req?.socket?.remoteAddress ||
    'bilinmiyor'
  return String(ip).replace(/^::ffff:/, '')
}

/** İstemcinin User-Agent başlığı. */
export function getUserAgent(event: any): string {
  const req = event.node?.req ?? event.req
  const h = req?.headers || {}
  return String(h['user-agent'] || 'bilinmiyor').slice(0, 400)
}
