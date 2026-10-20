/**
 * Anlık güncelleme — öncelik WebSocket, yedek olarak SSE.
 *
 * WebSocket: /_ws  → bağlantı anında tam durum, sonrasında her değişiklikte tam durum
 * SSE:        /api/stream → oy olayları (+1 animasyonu için)
 *
 * Böylece sayfa F5'e gerek kalmadan tüm veriler güncel olur.
 */
export interface LiveEvent {
  type: 'vote' | 'state' | 'pong'
  choice?: 'yes' | 'no'
  poll?: any
  state?: any
  live?: boolean
  nextReset?: string
}

export function useLiveUpdates(handler: (evt: LiveEvent) => void) {
  const connected = ref(false)
  const transport = ref<'ws' | 'sse' | 'none'>('none')

  onMounted(() => {
    if (typeof window === 'undefined') return

    // ---------- WebSocket (birincil) ----------
    let ws: WebSocket | null = null
    let wsClosed = false

    const connectWs = () => {
      try {
        const proto = location.protocol === 'https:' ? 'wss:' : 'ws:'
        ws = new WebSocket(`${proto}//${location.host}/_ws`)
      } catch {
        startSse()
        return
      }

      ws.onopen = () => {
        connected.value = true
        transport.value = 'ws'
      }
      ws.onmessage = (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data)
          if (data && data.type) handler(data)
        } catch { /* bozuk paket */ }
      }
      ws.onerror = () => {
        // WS açılamadıysa SSE'ye düş
        if (!connected.value && !wsClosed) startSse()
      }
      ws.onclose = () => {
        connected.value = false
        if (transport.value === 'ws') transport.value = 'none'
        if (!wsClosed) {
          // yeniden dene (5 sn sonra)
          setTimeout(() => { if (!wsClosed) connectWs() }, 5000)
        }
      }
    }

    // ---------- SSE (yedek) ----------
    let es: EventSource | null = null
    const startSse = () => {
      if (es || typeof EventSource === 'undefined') return
      try {
        es = new EventSource('/api/stream')
      } catch { return }
      es.onopen = () => { connected.value = true; transport.value = 'sse' }
      es.onmessage = (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data)
          if (data && data.type) handler(data)
        } catch { /* yoksay */ }
      }
      es.onerror = () => { connected.value = false }
    }

    connectWs()
    // WS açılmazsa 3 sn sonra SSE dene
    setTimeout(() => { if (!connected.value) startSse() }, 3000)

    onBeforeUnmount(() => {
      wsClosed = true
      try { ws?.close() } catch { /* yoksay */ }
      try { es?.close() } catch { /* yoksay */ }
    })
  })

  return { connected, transport }
}
