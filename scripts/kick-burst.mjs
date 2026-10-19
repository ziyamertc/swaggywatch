const url = 'https://kick.com/api/v2/channels/swaggybark'
const UA = 'swaggybark-panel/1.0'

;(async () => {
  const results = []
  for (let i = 0; i < 10; i++) {
    const t0 = Date.now()
    const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } })
    const txt = await r.text()
    let live = 'parse-fail'
    try { live = !!JSON.parse(txt).livestream } catch {}
    results.push(`${i}:${r.status}/live=${live}/${Date.now() - t0}ms`)
    await new Promise(r => setTimeout(r, 300))
  }
  console.log(results.join('  '))
})()
