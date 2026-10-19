/**
 * SSE testi: /api/stream'e bağlanır, sonra oy atar ve
 * olayın ne kadar sürede ulaştığını ölçer.
 */
const B = 'http://localhost:3000'
const ADMIN = process.env.ADMIN_KEY
if (!ADMIN) {
  console.error('❌ ADMIN_KEY tanımlı değil (--env-file=.env ile çalıştır)')
  process.exit(1)
}

const controller = new AbortController()
const res = await fetch(B + '/api/stream', { signal: controller.signal, headers: { Accept: 'text/event-stream' } })
console.log('📡 SSE bağlandı, status:', res.status, res.headers.get('content-type'))

const reader = res.body.getReader()
const decoder = new TextDecoder()
let buffer = ''
const messages = []

const t0 = Date.now()

// 1 sn sonra oy at
setTimeout(async () => {
  await fetch(B + '/api/poll/control', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-admin-key': ADMIN },
    body: JSON.stringify({ action: 'open' })
  })
  await fetch(B + '/api/poll/vote', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '9.9.9.9' },
    body: JSON.stringify({ choice: 'yes' })
  })
  console.log('🗳  oy gönderildi (t=' + (Date.now() - t0) + 'ms)')
}, 1000)

while (messages.length < 3 && Date.now() - t0 < 15000) {
  const { value, done } = await reader.read()
  if (done) break
  buffer += decoder.decode(value, { stream: true })
  const parts = buffer.split('\n\n')
  buffer = parts.pop() || ''
  for (const p of parts) {
    if (p.startsWith('data: ')) {
      const d = JSON.parse(p.slice(6))
      messages.push({ ms: Date.now() - t0, ...d })
    }
  }
}

controller.abort()
console.log('\n📨 Alınan olaylar:')
for (const m of messages) {
  console.log(`   t=${m.ms}ms  tip=${m.type}  choice=${m.choice ?? '-'}  EVET=${m.poll?.yes} HAYIR=${m.poll?.no}`)
}
const voteMsg = messages.find(m => m.type === 'vote')
console.log(voteMsg
  ? `\n✅ Anlık güncelleme çalışıyor: oy ${voteMsg.ms}ms içinde ulaştı`
  : '\n❌ Oy olayı ulaşmadı')
process.exit(voteMsg ? 0 : 1)
