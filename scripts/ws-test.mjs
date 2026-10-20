/**
 * WebSocket testi: /_ws'e bağlanır, oy atar, tam durumun anında geldiğini doğrular.
 * Kullanım: node scripts/ws-test.mjs [url]
 */
const B = (process.argv[2] || 'http://localhost:3000').replace(/^http/, 'ws')
const WS = B + '/_ws'

console.log(`🔌 WebSocket bağlanılıyor: ${WS}`)
const ws = new WebSocket(WS)

let stateCount = 0
let voteSeen = false
const t0 = Date.now()

const timer = setTimeout(() => {
  console.error('❌ zaman aşımı')
  process.exit(1)
}, 15000)

ws.onopen = () => {
  console.log('✅ bağlandı')
  // 1 sn sonra oy at → sunucu tam durumu yayınlamalı
  setTimeout(async () => {
    const r = await fetch('http://localhost:3000/api/poll/vote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '44.44.44.44' },
      body: JSON.stringify({ choice: 'yes' })
    })
    const j = await r.json().catch(() => ({}))
    console.log('🗳  oy gönderildi →', j.result || j.statusCode)
  }, 800)
}

ws.onmessage = (e) => {
  const d = JSON.parse(e.data)
  stateCount++
  const t = Date.now() - t0
  if (d.type === 'state') {
    console.log(`📨 tam durum geldi (t=${t}ms) → EVET:${d.poll?.yes} HAYIR:${d.poll?.no} | soru: "${d.question}" | yayın: ${d.live}`)
    if (stateCount >= 2) done(t)
  } else if (d.type === 'vote') {
    voteSeen = true
  }
}

ws.onerror = (e) => {
  console.error('❌ WS hatası:', e.message || e.type)
}

function done(t) {
  clearTimeout(timer)
  console.log(`\n✅ WebSocket çalışıyor — ${stateCount} durum mesajı, sonuncusu ${t}ms sonra`)
  process.exit(0)
}
