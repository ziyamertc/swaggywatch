/**
 * Keep-alive görevi (Nitro scheduled task).
 *
 * Render'ın ücretsiz planı 15 dakika inbound trafik olmazsa instance'ı
 * uyutuyor. Ücretsiz Render cron job'ları aylık en az $1 tutuyor (ve kart
 * istiyor) — o yüzden dışarıdan bir cron kurmadan, uygulamanın kendi içinde
 * periyodik olarak kendi public adresine istek atmasını sağlıyoruz.
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
    // Render public adresi otomatik verir; başka hostlarda elle ayarlanabilir
    const base = (process.env.RENDER_EXTERNAL_URL || process.env.PUBLIC_SITE_URL || '').replace(/\/$/, '')
    if (!base) {
      return { result: 'atlandı: RENDER_EXTERNAL_URL tanımlı değil' }
    }
    try {
      const r = await fetch(`${base}/api/poll/current`, {
        headers: { 'x-keepalive': '1' },
        signal: AbortSignal.timeout(20_000)
      })
      const j: any = await r.json().catch(() => null)
      return {
        result: `ping ${r.status} • durum=${j?.poll?.status ?? '?'} • yayın=${j?.live ? 'evet' : 'hayır'}`
      }
    } catch (err: any) {
      return { result: `ping hatası: ${err?.message || err}` }
    }
  }
})
