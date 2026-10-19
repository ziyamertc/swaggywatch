import { createHmac } from 'node:crypto'

/**
 * Oy verenin kimliği: IP'nin HMAC-SHA256 özeti.
 * Ham IP asla kaydedilmez; sadece karıştırılmış özeti tutulur.
 * Vercel vb. platformlarda x-forwarded-for OKS gelir.
 */
export function ipHash(event: any): string {
  const req = event.node?.req ?? event.req
  const h = req?.headers || {}
  const ip =
    (h['x-forwarded-for']?.split(',')[0]?.trim()) ||
    h['x-real-ip'] ||
    h['cf-connecting-ip'] ||
    'anonim'

  const secret = process.env.VOTE_SECRET || 'swaggybark-geçici-anahtar-DEĞİŞTİR'
  return createHmac('sha256', secret).update(String(ip)).digest('hex').slice(0, 32)
}
