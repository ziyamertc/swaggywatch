/**
 * Anlık güncelleme (SSE) — oy verildiği anda ekrana yansır.
 * Bağlantı kurulamazsa yoklama (polling) devreye girer.
 */
export interface LiveEvent {
  type: 'vote' | 'state'
  choice?: 'yes' | 'no'
  poll: any
  live?: boolean
  nextReset?: string
}

export function useLiveUpdates(handler: (evt: LiveEvent) => void) {
  const connected = ref(false)

  onMounted(() => {
    if (typeof EventSource === 'undefined') return
    let es: EventSource | null = null
    try {
      es = new EventSource('/api/stream')
    } catch {
      connected.value = false
      return
    }

    es.onopen = () => { connected.value = true }
    es.onmessage = (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data) as LiveEvent
        if (data && data.type) handler(data)
      } catch { /* bozuk paket */ }
    }
    es.onerror = () => {
      // EventSource otomatik yeniden bağlanmayı dener
      connected.value = false
    }

    onBeforeUnmount(() => {
      es?.close()
    })
  })

  return { connected }
}
