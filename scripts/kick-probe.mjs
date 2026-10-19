const url = 'https://kick.com/api/v2/channels/swaggybark'

const browserHeaders = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Referer': 'https://kick.com/swaggybark',
  'Origin': 'https://kick.com',
  'sec-ch-ua': '"Chromium";v="126", "Not;A=Brand";v="24", "Google Chrome";v="126"',
  'sec-ch-ua-mobile': '?0',
  'sec-ch-ua-platform': '"Windows"',
  'Sec-Fetch-Dest': 'empty',
  'Sec-Fetch-Mode': 'cors',
  'Sec-Fetch-Site': 'same-origin'
}

const tests = {
  'browser-full': browserHeaders,
  'minimal-ua': { 'User-Agent': browserHeaders['User-Agent'] },
  'curl-ua': { 'User-Agent': 'curl/8.4.0' },
  'no-ua': {},
  'kick-api-host': { ...browserHeaders, 'Host': 'kick.com' },
  'xhr': { ...browserHeaders, 'X-Requested-With': 'XMLHttpRequest' }
}

const altUrls = [
  'https://api.kick.com/public/v1/channels/swaggybark',
  'https://kick.com/api/v2/channels/swaggybark/stream'
]

;(async () => {
  for (const [name, h] of Object.entries(tests)) {
    try {
      const r = await fetch(url, { headers: h })
      const t = await r.text()
      let live = 'parse-fail'
      try { live = !!JSON.parse(t).livestream } catch {}
      console.log(name.padEnd(16), '->', r.status, 'live=', live, r.status !== 200 ? t.slice(0, 120).replace(/\s+/g, ' ') : '')
    } catch (e) {
      console.log(name.padEnd(16), 'HATA', e.message)
    }
  }

  console.log('--- alternatif endpointler ---')
  for (const u of altUrls) {
    try {
      const r = await fetch(u, { headers: browserHeaders })
      const t = await r.text()
      let live = 'parse-fail'
      try { live = !!JSON.parse(t).livestream } catch {}
      console.log(u.padEnd(52), '->', r.status, 'live=', live, r.status !== 200 ? t.slice(0, 100).replace(/\s+/g, ' ') : '')
    } catch (e) {
      console.log(u, 'HATA', e.message)
    }
  }
})()
