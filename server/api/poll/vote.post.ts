import { castVote, ensurePoll } from '../../utils/poll-service'
import { syncPollWithStream } from '../../utils/poll-state'
import { getStreamStatus } from '../../utils/kick'
import { ipHash, getClientIp, getUserAgent } from '../../utils/hash'
import { logVote } from '../../utils/vote-log'
import { emitPollEvent } from '../../utils/bus'
import { dayKeyFor } from '~/shared/utils/day'

/**
 * POST /api/poll/vote   body: { choice: "yes" | "no" }
 * - Gün 03:00 TSİ ile hesaplanır
 * - Günde 1 oy: sunucu, IP özüne (hash) göre bakar; tekrar gönderilen oy seçim değişikliği sayılır
 * - Oylama 'active' değilse oy kabul edilmez (yayın sürüyor / yayıncı kapattı)
 *
 * ÖNEMLİ: Oyun kabul edilmeden önce yayın durumu senkronize edilir. Aksi hâlde
 * sunucu yeni başladığında (henüz kimse sayfayı açmamışken) oylama "active"
 * görünür ve yayın sürerken oy alınabilirdi.
 */
export default defineEventHandler(async (event) => {
  const body = await readBody<{ choice?: string }>(event)
  const choice = body?.choice === 'yes' ? 'yes' : body?.choice === 'no' ? 'no' : null

  if (!choice) {
    throw createError({ statusCode: 400, statusMessage: 'Geçersiz seçim: "yes" veya "no" beklendi' })
  }

  const todayKey = dayKeyFor()
  await ensurePoll(todayKey)

  // yayın durumunu güncelle (yayın varsa oylama kapanır)
  const stream = await getStreamStatus()
  await syncPollWithStream(todayKey, {
    live: stream.live,
    ok: stream.ok,
    startedAt: stream.startedAt,
    title: stream.title
  })

  const { poll, result } = await castVote(todayKey, ipHash(event), choice)
  if (!poll) {
    throw createError({ statusCode: 409, statusMessage: 'Oylama kapalı, oy kaydedilmedi' })
  }

  if (result === 'closed') {
    const reason = poll.status === 'closed_stream'
      ? 'Yayın sürüyor — oylama yayın bitince tekrar açılacak'
      : poll.status === 'closed_manual'
        ? 'Yayıncı oylamayı kapattı'
        : 'Bu oylama sona erdi'
    throw createError({ statusCode: 409, statusMessage: reason })
  }

  // 📋 Admin logu: IP, tarayıcı, saat, oy (sadece admin panelinde görünür)
  if (result === 'added' || result === 'changed') {
    try {
      await logVote({
        dayKey: todayKey,
        ip: getClientIp(event),
        hash: ipHash(event),
        ua: getUserAgent(event),
        choice,
        action: result
      })
    } catch (e) {
      console.warn('[log] yazılamadı:', (e as any)?.message || e)
    }
  }

  // 📡 Anlık güncelleme: tüm ekranlara (panel + overlay) bildir
  emitPollEvent({ type: 'vote', choice, poll: poll as any })

  return { ok: true, result, poll }
})
