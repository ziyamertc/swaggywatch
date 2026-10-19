/**
 * Canlı deploy testi — verilen URL'de SSE, oy ve admin kontrolü.
 * Kullanım: node scripts/live-test.mjs https://siteadresi
 */
const B = process.argv[2] || 'https://swaggywatch.swaggywatch.deno.net'
const ADMIN = process.env.ADMIN_KEY || ''

const ok = (label, val) => console.log(`${val ? '✅' : '❌'} ${label}${val === true ? '' : ' → ' + JSON.stringify(val).slice(0, 160)}`)

console.log(`\n🌐 Canlı test: ${B}\n${'─'.repeat(50)}`)

// 1) Ana sayfa
try {
  const r = await fetch(B + '/')
  const html = await r.text()
  ok('Ana sayfa', r.status === 200)
  ok('Soru render edildi', /Dayı bugün yayın açacak mı\?|mega-question/.test(html))
  ok('Kick rozeti', /YAYINDA|OFFLINE/.test(html))
} catch (e) { ok('Ana sayfa', 'HATA: ' + e.message) }

// 2) API
let cur
try {
  const r = await fetch(B + '/api/poll/current')
  cur = await r.json()
  ok('API /api/poll/current', r.status === 200)
  ok('Veritabanı mongo', cur.store === 'mongo' ? true : cur.store)
  ok('Kick algılama', cur.streamOk === true)
  ok('Soru DB\'den', !!cur.question)
} catch (e) { ok('API', 'HATA: ' + e.message) }

// 3) Overlay + admin sayfaları
for (const p of ['/overlay', '/admin']) {
  try {
    const r = await fetch(B + p)
    ok(`Sayfa ${p}`, r.status === 200)
  } catch (e) { ok(`Sayfa ${p}`, 'HATA: ' + e.message) }
}

// 4) SSE (anlık güncelleme)
if (ADMIN) {
  try {
    const ctrl = new AbortController()
    const sse = await fetch(B + '/api/stream', { signal: ctrl.signal, headers: { Accept: 'text/event-stream' } })
    const reader = sse.body.getReader()
    const dec = new TextDecoder()
    let buf = ''
    const events = []
    const t0 = Date.now()

    const voting = (async () => {
      await fetch(B + '/api/poll/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-key': ADMIN },
        body: JSON.stringify({ action: 'open' })
      })
      await fetch(B + '/api/poll/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '4.4.4.4' },
        body: JSON.stringify({ choice: 'yes' })
      })
    })()

    while (events.length < 3 && Date.now() - t0 < 20000) {
      const { value, done } = await reader.read()
      if (done) break
      buf += dec.decode(value, { stream: true })
      const parts = buf.split('\n\n')
      buf = parts.pop() || ''
      for (const p of parts) {
        const line = p.split('\n').find(l => l.startsWith('data: '))
        if (!line) continue
        try {
          const d = JSON.parse(line.slice(6))
          events.push({ ms: Date.now() - t0, ...d })
        } catch { /* ping */ }
      }
    }
    ctrl.abort()
    await voting
    const voteEv = events.find(e => e.type === 'vote')
    ok('SSE bağlantısı', sse.status === 200 ? true : sse.status)
    ok('Anlık oy olayı', voteEv ? `ulaştı (${voteEv.ms}ms)` : 'ulaşmadı')
  } catch (e) { ok('SSE', 'HATA: ' + e.message) }
} else {
  console.log('⚠️  ADMIN_KEY yok — SSE testi atlandı')
}

// 5) Yetkisiz erişim reddi
try {
  const r = await fetch(B + '/api/poll/control', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'open' }) })
  ok('Yetkisiz reddi (403 bekleniyor)', r.status === 403)
} catch (e) { ok('Yetkisiz', 'HATA: ' + e.message) }

console.log('─'.repeat(50))
