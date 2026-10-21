import { createHmac } from 'node:crypto'

/**
 * Oy verenin kimliği.
 *
 * ⚠️ Neden IP değil? Türkiye'de mobil operatörler (CGNAT) yüzlerce/binlerce
 * aboneyi TEK bir public IP üzerinden çıkarır. IP'ye göre "günde 1 oy"
 * kuralı telefondan oy atan izleyicilerin çoğunu engellerdi.
 *
 * Bu yüzden birincil kimlik = **cihaz kimliği** (tarayıcıda üretilen
 * rastgele UUID, sunucuda HMAC ile özetlenir). IP sadece kötüye kullanım
 * (toplu oy) sınırı için kullanılır.
 */
export function ipHash(event: any): string {
  const secret = process.env.VOTE_SECRET || 'swaggybark-geçici-anahtar-DEĞİŞTİR'
  return createHmac('sha256', secret).update(getClientIp(event)).digest('hex').slice(0, 32)
}

/**
 * Oyuncu kimliği: cihazın rastgele UUID'si (x-client-id başlığı).
 * Eski istemciler (başlık yoksa) IP'ye düşer — geriye dönük uyum.
 */
export function voterHash(event: any): string {
  const req = event.node?.req ?? event.req
  const h = req?.headers || {}
  const clientId = String(h['x-client-id'] || '').trim()
  const secret = process.env.VOTE_SECRET || 'swaggybark-geçici-anahtar-DEĞİŞTİR'
  if (clientId && clientId.length >= 8 && clientId.length <= 64) {
    return createHmac('sha256', secret).update('device:' + clientId).digest('hex').slice(0, 32)
  }
  // başlık yoksa IP'ye düş
  return createHmac('sha256', secret).update('ip:' + getClientIp(event)).digest('hex').slice(0, 32)
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
