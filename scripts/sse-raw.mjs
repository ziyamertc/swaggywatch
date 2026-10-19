/** SSE ham çıktısını gösterir (format teşhisi). */
const B = process.argv[2] || 'http://localhost:3000'
const ctrl = new AbortController()
const res = await fetch(B + '/api/stream', { signal: ctrl.signal, headers: { Accept: 'text/event-stream' } })
console.log('status:', res.status, '| content-type:', res.headers.get('content-type'))
const reader = res.body.getReader()
const dec = new TextDecoder()
let raw = ''
const t0 = Date.now()
while (Date.now() - t0 < 6000) {
  const { value, done } = await reader.read()
  if (done) break
  raw += dec.decode(value, { stream: true })
  if (raw.length > 600) break
}
ctrl.abort()
console.log('--- HAM ÇIKTI ---')
console.log(JSON.stringify(raw.slice(0, 500)))
console.log('--- AYRIŞTIRILMIŞ ---')
console.log(raw.split('\n\n').filter(Boolean).map(b => JSON.stringify(b)).join('\n'))
