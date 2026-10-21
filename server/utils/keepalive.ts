/**
 * Keep-alive (self-ping) durumu.
 *
 * Render'ın ücretsiz planı 15 dakika inbound trafik olmazsa instance'ı uyutuyor.
 * Bu yüzden uygulama periyodik olarak kendi public adresine istek atıyor.
 * Durumu burada tutuyoruz ki admin panelde "çalışıyor mu?" görülebilsin.
 */
export interface KeepAliveState {
  enabled: boolean
  baseUrl: string | null
  lastPingAt: string | null
  lastStatus: number | null
  lastResult: string | null
  lastError: string | null
  pingCount: number
  nextPingIn: number | null      // saniye
}

const g = globalThis as any
if (!g.__sb_keepalive) {
  g.__sb_keepalive = {
    enabled: false,
    baseUrl: null,
    lastPingAt: null,
    lastStatus: null,
    lastResult: null,
    lastError: null,
    pingCount: 0,
    nextPingIn: null
  }
}
const state = g.__sb_keepalive as KeepAliveState

/** Public adresi: Render otomatik verir, elle de ayarlanabilir. */
export function keepAliveBaseUrl(): string | null {
  const candidates = [
    process.env.RENDER_EXTERNAL_URL,
    process.env.PUBLIC_SITE_URL,
    process.env.KEEPALIVE_URL
  ]
  for (const c of candidates) {
    if (c && /^https?:\/\//.test(c)) return c.replace(/\/$/, '')
  }
  return null
}

/** Kendine ping at. */
export async function pingSelf(): Promise<{ ok: boolean; status?: number; error?: string; result?: string }> {
  const base = keepAliveBaseUrl()
  state.baseUrl = base
  state.enabled = !!base

  if (!base) {
    state.lastError = 'public adres tanımlı değil (RENDER_EXTERNAL_URL / PUBLIC_SITE_URL / KEEPALIVE_URL)'
    state.nextPingIn = 300
    return { ok: false, error: state.lastError }
  }

  try {
    const r = await fetch(`${base}/api/poll/current`, {
      headers: { 'x-keepalive': '1' },
      signal: AbortSignal.timeout(20_000)
    })
    const j: any = await r.json().catch(() => null)
    state.lastPingAt = new Date().toISOString()
    state.lastStatus = r.status
    state.lastError = null
    state.pingCount++
    state.nextPingIn = 300
    state.lastResult = `ping ${r.status} • durum=${j?.poll?.status ?? '?'} • yayın=${j?.live ? 'evet' : 'hayır'}`
    return { ok: r.ok, status: r.status, result: state.lastResult }
  } catch (err: any) {
    state.lastPingAt = new Date().toISOString()
    state.lastError = String(err?.message || err).slice(0, 200)
    state.nextPingIn = 300
    state.pingCount++
    return { ok: false, error: state.lastError }
  }
}

export function getKeepAliveState(): KeepAliveState {
  const base = keepAliveBaseUrl()
  state.baseUrl = base
  state.enabled = !!base
  return { ...state }
}
