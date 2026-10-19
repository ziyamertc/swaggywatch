import {
  ensurePoll, closePoll, reopenPoll, closeStalePolls, getPollRaw, applyPollUpdate, recordSnapshot,
  type PollDTO
} from './poll-service.ts'
import { getPollModel } from './db.ts'

export interface StreamInfo {
  live: boolean
  ok: boolean
  startedAt: string | null
  title: string | null
}

export interface SyncResult {
  poll: PollDTO
  changed: 'opened' | 'closed' | 'none'
  reason: 'stream_off' | 'stream_on' | 'manual' | 'error' | 'same'
}

/**
 * Oylama durumu ⇄ yayın durumu senkronizasyonu.
 *
 * Kurallar:
 *  • Yayın AÇIK   → oylama kapanır (closed_stream) — yayın bitince OTOMATİK açılır
 *  • Yayın KAPALI → kapalı olan oylama (closed_stream) tekrar açılır, oylar KORUNUR
 *  • Yayıncı elle kapattıysa (closed_manual) otomatik açılmaz
 *  • Yayıncı yayın sırasında açık tutmak istiyorsa (manualOverride) kapatılmaz
 *  • Kick kontrolü başarısızsa hiçbir şeye dokunulmaz (oylar boşa gitmez)
 *  • Dünkü günler (gece 03:00) arşive düşer
 */
export async function syncPollWithStream(
  todayKey: string,
  stream: StreamInfo
): Promise<SyncResult> {
  // 1) gün döngüsü: dünkü oylamalar arşive
  await closeStalePolls(todayKey)

  let poll = await ensurePoll(todayKey)
  let changed: SyncResult['changed'] = 'none'
  let reason: SyncResult['reason'] = 'same'

  // 2) o günün yayın başlangıcını not et
  if (stream.live && stream.startedAt && poll.streamStartedAt !== stream.startedAt) {
    const Model = await getPollModel()
    if (Model) {
      await Model.updateOne({ dayKey: todayKey }, { $set: { streamStartedAt: stream.startedAt } })
    }
    poll = (await getPollRaw(todayKey)) as PollDTO
  }

  // 3) Kick kontrolü başarısızsa dokunma
  if (!stream.ok) {
    reason = 'error'
  }
  // 4) yayıncı override'ı varsa karışma
  else if (poll.manualOverride) {
    reason = 'manual'
    if (poll.status === 'closed_stream') {
      poll = await reopenPoll(todayKey)
      changed = 'opened'
    }
  }
  // 5) otomatik senkron
  else if (stream.live) {
    reason = 'stream_on'
    if (poll.status === 'active') {
      poll = await closePoll(todayKey, 'closed_stream')
      changed = 'closed'
    }
  } else {
    // yayın kapandı → yayın nedeniyle kapanmış oylamayı tekrar aç
    if (poll.status === 'closed_stream') {
      poll = await reopenPoll(todayKey)
      changed = 'opened'
      reason = 'stream_off'
    } else if (poll.status === 'closed_manual') {
      reason = 'manual'
    } else {
      reason = 'same'
    }
  }

  // 6) gün içi beklenti eğrisini kaydet
  await recordSnapshot(todayKey, poll.yes, poll.no)

  return { poll, changed, reason }
}

/** Yayıncı komutları: oylamayı elle aç / kapat / otomatik moda döndür. */
export async function manualControl(
  todayKey: string,
  action: 'open' | 'close' | 'auto'
): Promise<PollDTO> {
  await ensurePoll(todayKey)

  if (action === 'open') {
    // yayın sırasında da açık tutmak için override
    return applyPollUpdate(todayKey, {
      status: 'active',
      manualOverride: true,
      closedAt: null,
      reopenedAt: new Date()
    })
  }

  if (action === 'close') {
    return applyPollUpdate(todayKey, {
      status: 'closed_manual',
      manualOverride: false,
      closedAt: new Date()
    })
  }

  // auto: override kaldırılır, otomatik senkron bir sonraki istekte devralır
  return applyPollUpdate(todayKey, { manualOverride: false })
}
