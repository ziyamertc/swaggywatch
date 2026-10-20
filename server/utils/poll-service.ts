import type { PollDocument, PollStatus } from './db.ts'
import { getPollModel, mongoConfigured, getSnapshotModel } from './db.ts'

/* Uç taşıma için hafif veri şekli (tarihler ISO string) */
export interface PollDTO {
  dayKey: string
  yes: number
  no: number
  status: PollStatus
  manualOverride: boolean
  closedAt: string | null
  reopenedAt: string | null
  endedAt: string | null
  streamStartedAt: string | null
}

export function toDTO(p: PollDocument | MemPoll): PollDTO {
  return {
    dayKey: p.dayKey,
    yes: p.yes,
    no: p.no,
    status: p.status,
    manualOverride: !!p.manualOverride,
    closedAt: p.closedAt ? new Date(p.closedAt).toISOString() : null,
    reopenedAt: p.reopenedAt ? new Date(p.reopenedAt).toISOString() : null,
    endedAt: p.endedAt ? new Date(p.endedAt).toISOString() : null,
    streamStartedAt: p.streamStartedAt ?? null
  }
}

export type VoteResult = 'added' | 'changed' | 'unchanged' | 'closed'

export const storeMode = (): 'mongo' | 'memory' => (mongoConfigured ? 'mongo' : 'memory')

/** Gerçekte hangi depoda çalıştığımız (bağlantı kurulamadıysa bellek). */
export async function activeStoreMode(): Promise<'mongo' | 'memory'> {
  const Model = await getPollModel()
  return Model ? 'mongo' : 'memory'
}

/* ---------------- Bellek deposu (yalnızca MONGODB_URI verilmediğinde): yerel test modu ---------------- */

export interface MemPoll extends PollDTO {
  votes: { h: string; c: 'yes' | 'no' }[]
}

const g = globalThis as any
if (!g.__swaggybark_mem) {
  g.__swaggybark_mem = { polls: new Map<string, MemPoll>() }
}
const mem = g.__swaggybark_mem as { polls: Map<string, MemPoll> }

/* ---------------- Performans: gereksiz DB sorgularını kıs ----------------
   Ücretsiz hostlarda (Deno/Netlify) CPU kotası var. Her istekte 2-3 MongoDB
   sorgusu yapmak kotaları hızlıca tüketiyordu. Aşağıdaki throttle'lar aynı
   davranışı korur ama sorguları seyreltir. */

/** closeStalePolls en fazla bu aralıkla çalışır. */
if (!g.__swaggybark_staleAt) g.__swaggybark_staleAt = { value: 0 }
const staleState = g.__swaggybark_staleAt as { value: number }

/** recordSnapshot için son kontrol zamanı (bellek içi). */
if (!g.__swaggybark_snapAt) g.__swaggybark_snapAt = { value: 0 }
const snapState = g.__swaggybark_snapAt as { value: number }

/* ---------------- Ortak işlemler ---------------- */

export async function ensurePoll(dayKey: string): Promise<PollDTO> {
  const Model = await getPollModel()

  if (!Model) {
    let p = mem.polls.get(dayKey)
    if (!p) {
      p = {
        dayKey, yes: 0, no: 0, status: 'active', manualOverride: false,
        closedAt: null, reopenedAt: null, endedAt: null, streamStartedAt: null,
        votes: []
      }
      mem.polls.set(dayKey, p)
    }
    return toDTO(p)
  }

  const existing = await Model.findOne({ dayKey }).lean<PollDocument>()
  if (existing) return toDTO(existing)

  try {
    await Model.create({ dayKey })
  } catch (err: any) {
    if (err?.code !== 11000) throw err // 11000 = duplicate key, sorun değil
  }
  const created = await Model.findOne({ dayKey }).lean<PollDocument>()
  return toDTO(created!)
}

export async function getPollRaw(dayKey: string): Promise<PollDTO | MemPoll | null> {
  const Model = await getPollModel()
  if (!Model) return mem.polls.get(dayKey) ?? null
  return Model.findOne({ dayKey }).lean<PollDocument>()
}

/**
 * Oy ver / değiştir. Günde 1 oy kuralı sunucuda, oyUNCU kimliği =
 * IP'nin HMAC özeti (hash). Aynı gün içinde ikinci oy = mevcudun güncellenmesi.
 * Oylama 'active' değilse oy kabul edilmez.
 */
export async function castVote(
  dayKey: string,
  hash: string,
  choice: 'yes' | 'no'
): Promise<{ poll: PollDTO | null; result: VoteResult }> {
  const raw = await getPollRaw(dayKey)
  if (!raw) return { poll: null, result: 'closed' }
  if (raw.status !== 'active') return { poll: toDTO(raw), result: 'closed' }

  const Model = await getPollModel()

  if (!Model) {
    const p = raw as MemPoll
    const existing = p.votes.find(v => v.h === hash)
    if (existing) {
      if (existing.c === choice) return { poll: toDTO(p), result: 'unchanged' }
      p[existing.c] = Math.max(0, p[existing.c] - 1)
      p[choice]++
      existing.c = choice
      return { poll: toDTO(p), result: 'changed' }
    }
    p.votes.push({ h: hash, c: choice })
    p[choice]++
    return { poll: toDTO(p), result: 'added' }
  }

  const existing = (raw as PollDocument).votes.find(v => v.h === hash)
  if (existing) {
    if (existing.c === choice) return { poll: toDTO(raw as PollDocument), result: 'unchanged' }
    const inc = { [choice]: +1 } as Record<string, number>
    inc[existing.c] = -1
    const updated = await Model.findOneAndUpdate(
      { dayKey, 'votes.h': hash },
      { $set: { 'votes.$.c': choice }, $inc: inc },
      { new: true, lean: true }
    ).lean<PollDocument>()
    return { poll: updated ? toDTO(updated) : null, result: 'changed' }
  }

  const updated = await Model.findOneAndUpdate(
    { dayKey, votes: { $not: { $elemMatch: { h: hash } } } },
    { $push: { votes: { h: hash, c: choice } }, $inc: { [choice]: 1 } },
    { new: true, lean: true }
  ).lean<PollDocument>()

  if (!updated) {
    // eşzamanlı istek olabilir → tekrar dene
    const again = await getPollRaw(dayKey)
    if (again && again.status === 'active') return castVote(dayKey, hash, choice)
    return { poll: again ? toDTO(again as PollDocument) : null, result: 'closed' }
  }
  return { poll: toDTO(updated), result: 'added' }
}

/** Oylamayı kapat (yayın nedeniyle / elle). */
export async function closePoll(
  dayKey: string,
  status: 'closed_stream' | 'closed_manual',
  opts: { manualOverride?: boolean } = {}
): Promise<PollDTO> {
  const now = new Date()
  const Model = await getPollModel()

  if (!Model) {
    const p = mem.polls.get(dayKey)
    if (p) {
      p.status = status
      p.closedAt = now.toISOString()
      if (opts.manualOverride !== undefined) p.manualOverride = opts.manualOverride
    }
    return toDTO(p!)
  }

  const set: any = { status, closedAt: now }
  if (opts.manualOverride !== undefined) set.manualOverride = opts.manualOverride

  const updated = await Model.findOneAndUpdate(
    { dayKey, status: { $ne: 'ended_day' } },
    { $set: set },
    { new: true, lean: true }
  ).lean<PollDocument>()
  if (updated) return toDTO(updated)
  const cur = await Model.findOne({ dayKey }).lean<PollDocument>()
  return toDTO(cur!)
}

/** Oylamayı tekrar aç (oylar korunur, sayaçlar sıfırlanmaz). */
export async function reopenPoll(dayKey: string): Promise<PollDTO> {
  const now = new Date()
  const Model = await getPollModel()

  if (!Model) {
    const p = mem.polls.get(dayKey)
    if (p) {
      p.status = 'active'
      p.reopenedAt = now.toISOString()
      p.closedAt = null
    }
    return toDTO(p!)
  }

  const updated = await Model.findOneAndUpdate(
    { dayKey, status: { $ne: 'ended_day' } },
    { $set: { status: 'active', reopenedAt: now, closedAt: null } },
    { new: true, lean: true }
  ).lean<PollDocument>()
  if (updated) return toDTO(updated)
  const cur = await Model.findOne({ dayKey }).lean<PollDocument>()
  return toDTO(cur!)
}

/** Gün döngüsü: dünkü günler arşive düşer (ended_day). En fazla 60 sn'de bir çalışır. */
export async function closeStalePolls(todayKey: string): Promise<void> {
  const now = Date.now()
  if (now - staleState.value < 60_000) return
  staleState.value = now

  const Model = await getPollModel()
  if (!Model) {
    for (const p of mem.polls.values()) {
      if (p.dayKey < todayKey && p.status !== 'ended_day') {
        p.status = 'ended_day'
        p.endedAt = new Date().toISOString()
      }
    }
    return
  }
  await Model.updateMany(
    { dayKey: { $lt: todayKey }, status: { $ne: 'ended_day' } },
    { $set: { status: 'ended_day', endedAt: new Date() } }
  )
}

/** Arbitrary alan güncellemesi (yayıncı kontrolleri için). */
export async function applyPollUpdate(
  dayKey: string,
  set: Partial<Pick<PollDocument, 'status' | 'manualOverride' | 'closedAt' | 'reopenedAt' | 'endedAt' | 'streamStartedAt'>>
): Promise<PollDTO> {
  const Model = await getPollModel()
  const now = new Date()

  if (!Model) {
    const p = mem.polls.get(dayKey)
    if (p) Object.assign(p, set)
    return toDTO(p!)
  }
  const payload: any = { ...set }
  if (payload.closedAt === undefined && payload.status && payload.status !== 'active') {
    payload.closedAt = now
  }
  if (payload.reopenedAt === undefined && payload.status === 'active') {
    payload.reopenedAt = now
  }
  const u = await Model.findOneAndUpdate(
    { dayKey },
    { $set: payload },
    { new: true, lean: true }
  ).lean<PollDocument>()
  return toDTO(u!)
}

/** Bitmiş (arşiv) oylamalar — yeniden eskiye. */
export async function listEndedPolls(limit = 60): Promise<PollDTO[]> {
  const Model = await getPollModel()
  if (!Model) {
    return [...mem.polls.values()]
      .filter(p => p.status !== 'active')
      .sort((a, b) => (a.dayKey < b.dayKey ? 1 : -1))
      .slice(0, limit)
      .map(toDTO)
  }
  const docs = await Model.find({ status: { $ne: 'active' } })
    .sort({ dayKey: -1 })
    .limit(limit)
    .lean<PollDocument[]>()
  return docs.map(toDTO)
}

/* ---------------- Gün içi trend (beklenti eğrisi) ---------------- */

export interface SnapshotDTO {
  at: string
  yes: number
  no: number
}

const SNAP_MIN_GAP = 10 * 60 * 1000   // en sık 10 dakikada bir nokta
const SNAP_MIN_DELTA = 2              // oran %2'den fazla değiştiyse yeni nokta

interface MemSnapshot { dayKey: string; at: number; yes: number; no: number }

if (!g.__swaggybark_snapMem) g.__swaggybark_snapMem = { items: [] as MemSnapshot[] }
const snapMem = g.__swaggybark_snapMem as { items: MemSnapshot[] }

/**
 * Günün beklenti eğrisini kaydeder. Çok sık çağrılabilir; sadece anlamlı
 * değişikliklerde yeni nokta ekler (10 dk aralık veya %2'lik oran değişimi).
 */
export async function recordSnapshot(dayKey: string, yes: number, no: number): Promise<void> {
  if (yes + no <= 0) return
  const now = Date.now()

  const Model = await getSnapshotModel()
  if (!Model) {
    const items = snapMem.items.filter(s => s.dayKey === dayKey)
    const last = items[items.length - 1]
    if (last) {
      const gap = now - last.at
      const delta = Math.abs((yes / (yes + no)) - (last.yes / (last.yes + last.no)))
      if (gap < SNAP_MIN_GAP && delta * 100 < SNAP_MIN_DELTA) return
    }
    snapMem.items.push({ dayKey, at: now, yes, no })
    return
  }

  // Bellekte son kontrol zamanını tutuyoruz → her istekte findOne yapmayalım
  if (now - snapState.value < 45_000) return
  snapState.value = now

  const last = await Model.findOne({ dayKey }).sort({ at: -1 }).lean<any>()
  if (last) {
    const gap = now - new Date(last.at).getTime()
    const lastTotal = (last.yes || 0) + (last.no || 0)
    const delta = lastTotal > 0
      ? Math.abs((yes / (yes + no)) - (last.yes / lastTotal))
      : 1
    if (gap < SNAP_MIN_GAP && delta * 100 < SNAP_MIN_DELTA) return
  }
  await Model.create({ dayKey, at: new Date(now), yes, no })
}

/** Bir günün trend noktaları (zaman sırasıyla). */
export async function getSnapshots(dayKey: string, limit = 200): Promise<SnapshotDTO[]> {
  const Model = await getSnapshotModel()
  if (!Model) {
    return snapMem.items
      .filter(s => s.dayKey === dayKey)
      .sort((a, b) => a.at - b.at)
      .slice(-limit)
      .map(s => ({ at: new Date(s.at).toISOString(), yes: s.yes, no: s.no }))
  }
  const docs = await Model.find({ dayKey }).sort({ at: 1 }).limit(limit).lean<any[]>()
  return docs.map(d => ({ at: new Date(d.at).toISOString(), yes: d.yes, no: d.no }))
}
