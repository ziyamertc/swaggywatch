import { pingSelf } from '../../utils/keepalive'

/**
 * Keep-alive görevi (Nitro scheduled task) — 5 dakikada bir.
 *
 * Render'ın ücretsiz planı 15 dakika inbound trafik olmazsa instance'ı uyutuyor.
 * Ücretsiz Render cron job'ları aylık en az $1 tutuyor (ve kart istiyor) —
 * o yüzden dışarıdan bir cron kurmadan, uygulamanın kendi içinde periyodik
 * olarak kendi public adresine istek atmasını sağlıyoruz.
 *
 * Aralık 5 dk (Render eşiği 15 dk): 10 dk'da bir atsaydık tek ping düşmesinde
 * site uyurdu. 5 dk 3 kat güvenlik payı bırakır.
 *
 * Bu istek aynı zamanda:
 *   - gece 03:00 rollover kontrolünü tetikler
 *   - Kick yayın durumunu tazeler
 *   - oylama durumunu (yayın açıksa kapanır) günceller
 */
export default defineTask({
  meta: {
    name: 'poll:keepalive',
    description: 'Ücretsiz planlarda instance\'ı uyanık tutar + gün/yayın durumunu tazeler'
  },
  async run() {
    const r = await pingSelf()
    return { result: r.ok ? (r.result || 'ok') : `hata: ${r.error}` }
  }
})
