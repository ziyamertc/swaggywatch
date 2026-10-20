import { createEventStream } from 'h3'
import { bus, type PollEvent } from '../utils/bus'
import { getStreamStatus } from '../utils/kick'
import { syncPollWithStream } from '../utils/poll-state'
import { dayKeyFor, nextResetIso } from '~/shared/utils/day'

/**
 * GET /api/stream  —  Server-Sent Events (anlık güncelleme)
 *
 * Oyun verildiği anda tüm ekranlara (panel + OBS overlay) bildirilir.
 * Yoklama (30 sn) sadece yedek yoldur.
 *
 * NOT: h3'ün createEventStream() kullanılıyor — runtime'dan bağımsız çalışır.
 * Node'un (node:http) res.write() yöntemi Deno Deploy'da 503 döndürüyordu;
 * Web standardı ReadableStream her ikisinde de çalışıyor.
 */
export default defineEventHandler(async (event) => {
  const eventStream = createEventStream(event, { autoclose: true })

  const send = (data: any) => {
    try {
      eventStream.push({ event: 'message', data: JSON.stringify(data) })
    } catch { /* bağlantı kapandı */ }
  }

  // ilk durum
  try {
    const todayKey = dayKeyFor()
    const stream = await getStreamStatus()
    const { poll } = await syncPollWithStream(todayKey, {
      live: stream.live, ok: stream.ok, startedAt: stream.startedAt, title: stream.title
    })
    send({ type: 'state', poll, live: stream.live, nextReset: nextResetIso() })
  } catch { /* ilk gönderim başarısız olabilir */ }

  const onPoll = (evt: PollEvent) => send(evt)
  bus.on('poll', onPoll)

  // bağlantı canlılığı (proxy time-out koruması)
  // 'ping' adlı ayrı bir event: istemcinin onmessage'i tetiklenmez, sadece
  // bağlantı canlı kalır. Aralık 45 sn: proxy'lerin 60 sn'lik okuma timeout'ına
  // takılmaz, ama instance'ı sürekli uyandırmaz.
  const ping = setInterval(() => {
    try { eventStream.push({ event: 'ping', data: '' }) } catch { /* yoksay */ }
  }, 45_000)

  const cleanup = () => {
    clearInterval(ping)
    bus.off('poll', onPoll)
  }

  // bağlantı kapandığında temizle (Node + Web standardı)
  const req = (event.node as any)?.req
  req?.on?.('close', cleanup)
  req?.on?.('error', cleanup)
  const signal = (event as any)?.web?.request?.signal
  signal?.addEventListener?.('abort', cleanup)

  return eventStream.send()
})
