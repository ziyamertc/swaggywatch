/**
 * Farklı kullanıcıları simüle eder (x-forwarded-for) → gün içi trend eğrisi üretir.
 * Test amaçlıdır: gerçek oyları simüle eder ve MongoDB'ye yazar.
 */
const B = 'http://localhost:3000'
const ADMIN = process.env.ADMIN_KEY
if (!ADMIN) {
  console.error('❌ ADMIN_KEY tanımlı değil (--env-file=.env ile çalıştır)')
  process.exit(1)
}

const post = (path, body, headers = {}) => fetch(B + path, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', ...headers },
  body: JSON.stringify(body)
})

// oylamayı aç
await post('/api/poll/control', { action: 'open' }, { 'x-admin-key': ADMIN })
console.log('✔ oylama açıldı')

const voters = [
  ['yes', '1.1.1.1'], ['yes', '1.1.1.2'], ['yes', '1.1.1.3'],
  ['no', '1.1.1.4'], ['no', '1.1.1.5'],
  ['yes', '1.1.1.6'], ['yes', '1.1.1.7'],
  ['no', '1.1.1.8'], ['no', '1.1.1.9'], ['no', '1.1.1.10'],
  ['yes', '1.1.1.11'], ['yes', '1.1.1.12'],
  ['yes', '1.1.1.13'], ['yes', '1.1.1.14'], ['yes', '1.1.1.15'],
  ['no', '1.1.1.16'], ['no', '1.1.1.17'],
  ['yes', '1.1.1.18'], ['yes', '1.1.1.19'], ['yes', '1.1.1.20'],
  ['yes', '1.1.1.21'], ['yes', '1.1.1.22'], ['yes', '1.1.1.23']
]

let i = 0
for (const [choice, ip] of voters) {
  const r = await post('/api/poll/vote', { choice }, { 'x-forwarded-for': ip })
  const j = await r.json()
  i++
  // her oy sonrası senkron → eğriye nokta düşer
  const cur = await (await fetch(B + '/api/poll/current')).json()
  console.log(
    `${String(i).padStart(2)}. ${choice.toUpperCase().padEnd(3)} ${ip.padEnd(9)} → ` +
    `EVET ${j.poll?.yes} / HAYIR ${j.poll?.no}  (eğri noktası: ${cur.trend.length})`
  )
}

const cur = await (await fetch(B + '/api/poll/current')).json()
console.log('\n📈 Gün içi eğri noktaları:', cur.trend.length)
for (const p of cur.trend) {
  const t = p.yes + p.no ? Math.round((p.yes / (p.yes + p.no)) * 100) : 0
  console.log(`   ${new Date(p.at).toLocaleTimeString('tr-TR', { timeZone: 'Europe/Istanbul' })} → %${t} EVET (${p.yes}/${p.no})`)
}
console.log('\nSkor:', cur.poll.yes + cur.poll.no, 'oy')
