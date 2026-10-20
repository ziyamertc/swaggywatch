import { getPollRaw } from './poll-service.ts'
import { getQuestion, getSlots, getCredit } from './settings.ts'
import { getStreamStatus } from './kick.ts'
import { getChannelInfo } from './kick-channel.ts'
import { dayKeyFor, nextResetIso } from '~/shared/utils/day'
import { emitPollEvent } from './bus.ts'

/**
 * Panelin tam anlık durumu — WebSocket/SSE ile istemcilere gönderilir.
 * (poll + soru + reklam alanları + trend + yayın durumu + imza)
 */
export interface StatePayload {
  type: 'state'
  poll: any
  question: string
  slots: any
  credit: any
  trend: any[]
  live: boolean
  streamOk: boolean
  streamTitle: string | null
  channel: any
  todayKey: string
  nextReset: string
}

export async function buildState(): Promise<StatePayload> {
  const todayKey = dayKeyFor()
  const [poll, question, slots, credit, stream, channel] = await Promise.all([
    getPollRaw(todayKey),
    getQuestion(),
    getSlots(),
    getCredit(),
    getStreamStatus(),
    getChannelInfo()
  ])

  const { getSnapshots } = await import('./poll-service.ts')
  const trend = await getSnapshots(todayKey, 60)

  return {
    type: 'state',
    poll: poll ? {
      dayKey: poll.dayKey,
      yes: poll.yes,
      no: poll.no,
      status: poll.status,
      manualOverride: poll.manualOverride,
      votesEpoch: (poll as any).votesEpoch || '',
      closedAt: poll.closedAt,
      reopenedAt: poll.reopenedAt,
      endedAt: poll.endedAt,
      streamStartedAt: poll.streamStartedAt
    } : null,
    question,
    slots,
    credit,
    trend,
    live: stream.live,
    streamOk: stream.ok,
    streamTitle: stream.title,
    channel: {
      ok: channel.ok,
      avatar: channel.avatar,
      banner: channel.banner,
      username: channel.username,
      followers: channel.followers,
      live: channel.live
    },
    todayKey,
    nextReset: nextResetIso()
  }
}

/** Tam durumu tüm istemcilere yayınlar. */
export async function broadcastState(): Promise<void> {
  try {
    const state = await buildState()
    emitPollEvent({ type: 'state', poll: state.poll, state } as any)
  } catch (e) {
    console.warn('[state] yayınlanamadı:', (e as any)?.message || e)
  }
}
