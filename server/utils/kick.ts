/**
 * Kick.com canlı yayın durumu.
 *
 * ÖNEMLİ: Kick'in edge ağı, "sahte tarayıcı" User-Agent'ları (Chrome/Safari + sec-ch-ua,
 * Referer, Origin) sunucu/datacenter IP'lerinden gelen istekleri 403 "Request blocked by
 * security policy" ile reddediyor. Nötr bir UA (örn. swaggybark-panel/1.0) ile istekler
 * sorunsuz 200 dönüyor. Bu yüzden burada bilerek tarayıcı taklidi yapılmıyor.
 *
 * Sonuçlar 30 sn önbelleklenir; hata durumunda "bilinmiyor" döner ve panel uyarı gösterir.
 */
const CHANNEL = process.env.KICK_CHANNEL || 'swaggybark'
const UA = process.env.KICK_UA || 'swaggybark-panel/1.0'
// Önbellek süresi: yayın durumu dakikalar içinde değişmez.
// Uzun tutmak hem Kick'e yük bindirir hem de ücretsiz hostların CPU kotasını yiyor.
const TTL = Number(process.env.KICK_TTL_MS || 120_000)

export interface StreamStatus {
  live: boolean
  startedAt: string | null
  title: string | null
  ok: boolean          // kontrol başarılı mı
  error: string | null // hata varsa mesaj
  checkedAt: string
}

const g = globalThis as any
if (!g.__swaggybark_streamCache) g.__swaggybark_streamCache = { at: 0, value: null }
const cache = g.__swaggybark_streamCache as { at: number; value: StreamStatus | null }

function headers() {
  const h: Record<string, string> = { Accept: 'application/json' }
  if (UA) h['User-Agent'] = UA
  return h
}

/** Kick'e tek istek atar. 403 alınırsa UA'sız tekrar dener (edge politikası sonrası). */
async function requestOnce(useUa: boolean): Promise<any> {
  const h = useUa ? headers() : { Accept: 'application/json' }
  return await $fetch<any>(`https://kick.com/api/v2/channels/${CHANNEL}`, {
    headers: h,
    timeout: 8000,
    retry: 0,
    ignoreResponseError: true
  }).then((res: any) => {
    if (res && res.__status && res.__status !== 200) {
      throw new Error(`Kick ${res.__status}: ${JSON.stringify(res).slice(0, 120)}`)
    }
    return res
  })
}

export async function getStreamStatus(): Promise<StreamStatus> {
  const now = Date.now()
  if (cache.value && now - cache.at < TTL) return cache.value

  let value: StreamStatus = {
    live: false,
    startedAt: null,
    title: null,
    ok: false,
    error: null,
    checkedAt: new Date().toISOString()
  }

  try {
    let data: any
    try {
      data = await requestOnce(true)
    } catch (e: any) {
      // UA engellendiyse nötr isteklerle tekrar dene
      const raw: any = await $fetch.raw(`https://kick.com/api/v2/channels/${CHANNEL}`, {
        headers: { Accept: 'application/json' },
        timeout: 8000,
        retry: 0
      })
      if (raw._data && raw._data.error) throw new Error(String(raw._data.error))
      data = raw._data
    }

    const ls = data?.livestream ?? null
    value = {
      live: !!ls,
      startedAt: ls?.created_at ?? null,
      title: ls?.session_title ?? null,
      ok: true,
      error: null,
      checkedAt: new Date().toISOString()
    }
  } catch (err: any) {
    value = {
      live: false,
      startedAt: null,
      title: null,
      ok: false,
      error: String(err?.message || err).slice(0, 160),
      checkedAt: new Date().toISOString()
    }
    console.warn('[kick] yayın durumu alınamadı:', value.error)
  }

  cache.at = now
  cache.value = value
  return value
}
