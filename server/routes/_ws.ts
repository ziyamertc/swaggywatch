import { bus } from '../utils/bus'
import { buildState } from '../utils/state'

/**
 * WebSocket ucu — /_ws
 *
 * Bağlanan her istemciye:
 *   1) bağlantı anında tam durum gönderilir
 *   2) sonrasında oy/yayın/soru/reklam değişikliklerinde anında tam durum gönderilir
 *
 * Böylece sayfa F5'e gerek kalmadan her şey güncel olur.
 */

/** Bağlı istemciler (kendi kaydımız — crossws publish yerine açık gönderim) */
const peers = new Set<any>()

export default defineWebSocketHandler({
  async open(peer) {
    peers.add(peer)
    try {
      peer.send(JSON.stringify(await buildState()))
    } catch (e) {
      console.warn('[ws] ilk durum gönderilemedi:', (e as any)?.message || e)
    }
  },

  message(peer, message) {
    // İstemciden gelen mesaj: sadece "ping" (keep-alive)
    try {
      if (message.text() === 'ping') peer.send(JSON.stringify({ type: 'pong' }))
    } catch { /* yoksay */ }
  },

  close(peer) {
    peers.delete(peer)
  },

  error(peer) {
    peers.delete(peer)
  }
})

/** Durum değiştiğinde tüm bağlı istemcilere tam durumu gönder. */
bus.on('poll', async (evt: any) => {
  if (!peers.size) return
  try {
    const state = evt?.state ?? await buildState()
    const payload = JSON.stringify(state)
    for (const p of peers) {
      try { p.send(payload) } catch { peers.delete(p) }
    }
  } catch (e) {
    console.warn('[ws] yayınlanamadı:', (e as any)?.message || e)
  }
})
