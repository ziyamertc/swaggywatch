import { bus, type PollEvent } from '../utils/bus'
import { getStreamStatus } from '../utils/kick'
import { syncPollWithStream } from '../utils/poll-state'
import { dayKeyFor, nextResetIso } from '~/shared/utils/day'

/**
 * GET /api/stream  —  Server-Sent Events (anlık güncelleme)
 *
 * Oyun verildiği anda tüm ekranlara (panel + OBS overlay) bildirilir.
 * Yoklama (30 sn) sadece yedek yol olarak çalışır.
 */
export default defineEventHandler(async (event) => {
  setHeader(event, 'Content-Type', 'text/event-stream; charset=utf-8')
  setHeader(event, 'Cache-Control', 'no-cache, no-transform')
  setHeader(event, 'Connection', 'keep-alive')
  setHeader(event, 'X-Accel-Buffering', 'no')

  const res = event.node.res
  let closed = false

  const send = (data: any) => {
    if (closed || res.writableEnded) return
    try { res.write(`data: ${JSON.stringify(data)}\n\n`) } catch { /* bağlantı kapandı */ }
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
  const ping = setInterval(() => {
    if (closed || res.writableEnded) return
    try { res.write(': ping\n\n') } catch { /* yoksay */ }
  }, 20_000)

  const cleanup = () => {
    closed = true
    clearInterval(ping)
    bus.off('poll', onPoll)
  }

  event.node.req.on('close', cleanup)
  event.node.req.on('error', cleanup)

  // h3'ün isteği kapatmasına izin ver
  await new Promise<void>((resolve) => {
    event.node.req.on('close', () => resolve())
    event.node.res.on('close', () => resolve())
  })
  cleanup()
})
