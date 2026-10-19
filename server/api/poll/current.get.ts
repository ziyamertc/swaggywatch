import { activeStoreMode, getSnapshots } from '../../utils/poll-service'
import { getQuestion, getSlots } from '../../utils/settings'
import { syncPollWithStream } from '../../utils/poll-state'
import { getStreamStatus } from '../../utils/kick'
import { getChannelInfo } from '../../utils/kick-channel'
import { dayKeyFor, nextResetIso } from '~/shared/utils/day'

/**
 * GET /api/poll/current
 * Bugünün oylaması + Kick canlı durumu + otomatik senkronizasyon.
 *
 * Senkronizasyon mantığı (poll-state.ts):
 *  yayın açık  → oylama kapanır (closed_stream)
 *  yayın kapalı→ kapalı oylama TEKRAR açılır (oylar korunur)
 *  Kick hata   → hiçbir şeye dokunulmaz
 */
export default defineEventHandler(async () => {
  const todayKey = dayKeyFor()

  // canlı çekilme: 30 sn önbellekli
  const stream = await getStreamStatus()

  const { poll, changed, reason } = await syncPollWithStream(todayKey, {
    live: stream.live,
    ok: stream.ok,
    startedAt: stream.startedAt,
    title: stream.title
  })

  if (changed !== 'none') {
    console.log(`[poll] durum değişti: ${changed} (${reason}) — ${todayKey}`)
  }

  return {
    poll,
    live: stream.live,
    streamOk: stream.ok,
    streamError: stream.error,
    streamTitle: stream.title,
    streamStartedAt: stream.startedAt,
    channel: await getChannelInfo(),
    question: await getQuestion(),
    slots: await getSlots(),
    trend: await getSnapshots(todayKey),
    todayKey,
    nextReset: nextResetIso(),
    store: await activeStoreMode()
  }
})
