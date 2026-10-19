const url = 'https://kick.com/api/v2/channels/swaggybark'
const uas = [
  ['varsayilan (node)', undefined],
  ['swaggybark-panel/1.0', 'swaggybark-panel/1.0'],
  ['kick-monitor/1.0', 'kick-monitor/1.0'],
  ['node', 'node'],
  ['python-requests/2.31', 'python-requests/2.31'],
  ['okhttp/4.12.0', 'okhttp/4.12.0'],
  ['Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15', 'safari-mac']
]

async function probe(ua) {
  const headers = ua === undefined ? {} : { 'User-Agent': ua }
  const r = await fetch(url, { headers })
  const t = await r.text()
  let live = 'parse-fail'
  try { live = !!JSON.parse(t).livestream } catch {}
  return { status: r.status, live }
}

;(async () => {
  for (const [name, ua] of uas) {
    const results = []
    for (let i = 0; i < 3; i++) results.push(await probe(ua))
    const ok = results.every(r => r.status === 200)
    console.log(name.padEnd(24), ok ? '✅' : '❌', results.map(r => `${r.status}/live=${r.live}`).join('  '))
  }
})()
