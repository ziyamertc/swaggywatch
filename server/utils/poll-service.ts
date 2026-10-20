import type { PollDocument, PollStatus } from './db.ts'
import { getPollModel, mongoConfigured, getSnapshotModel, getVoteLogModel } from './db.ts'
import { clearVoteLog } from './vote-log.ts'

/* Uç taşıma için hafif veri şekli (tarihler ISO string) */
export interface PollDTO {
  dayKey: string
  yes: number
  no: number
  status: PollStatus
  manualOverride: boolean
  votesEpoch: string
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
    votesEpoch: (p as any).votesEpoch || '',
    closedAt: p.closedAt ? new Date(p.closedAt).toISOString() : null,
    reopenedAt: p.reopenedAt ? new Date(p.reopenedAt).toISOString() : null,
    endedAt: p.endedAt ? new Date(p.endedAt).toISOString() : null,
    streamStartedAt: p.streamStartedAt ?? null
  }
}

export type VoteResult = 'added' | 'changed' | 'unchanged' | 'closed' | 'locked'

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
  if (existing) {
    // eski kayıtlarda votesEpoch yok → bir kez ata (istemcilerin oyunu
    // geçersizleştirebilmesi için şart)
    if (!existing.votesEpoch) {
      const ep = newEpoch()
      await Model.updateOne({ dayKey }, { $set: { votesEpoch: ep } })
      existing.votesEpoch = ep
    }
    return toDTO(existing)
  }

  try {
    await Model.create({ dayKey, votesEpoch: newEpoch() })
  } catch (err: any) {
    if (err?.code !== 11000) throw err // 11000 = duplicate key, sorun değil
  }
  const created = await Model.findOne({ dayKey }).lean<PollDocument>()
  return toDTO(created!)
}

/** Oylar sıfırlandığında değişen kimlik (istemcilerin eski oyunu geçersizleştirmesi için). */
export function newEpoch(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
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
      // değiştirme penceresi açık mı?
      const until = existing.changeUntil ? new Date(existing.changeUntil).getTime() : 0
      if (until < Date.now()) return { poll: toDTO(p), result: 'locked' }
      p[existing.c] = Math.max(0, p[existing.c] - 1)
      p[choice]++
      existing.c = choice
      existing.changeUntil = null
      return { poll: toDTO(p), result: 'changed' }
    }
    p.votes.push({ h: hash, c: choice, at: new Date() })
    p[choice]++
    return { poll: toDTO(p), result: 'added' }
  }

  const existing = (raw as PollDocument).votes.find(v => v.h === hash)
  if (existing) {
    if (existing.c === choice) return { poll: toDTO(raw as PollDocument), result: 'unchanged' }
    // 🔒 oy değiştirmek için önce 1 dakikalık pencere açılmalı
    const until = existing.changeUntil ? new Date(existing.changeUntil).getTime() : 0
    if (until < Date.now()) {
      return { poll: toDTO(raw as PollDocument), result: 'locked' }
    }
    const inc = { [choice]: +1 } as Record<string, number>
    inc[existing.c] = -1
    const updated = await Model.findOneAndUpdate(
      { dayKey, 'votes.h': hash },
      { $set: { 'votes.$.c': choice, 'votes.$.changeUntil': null }, $inc: inc },
      { new: true, lean: true }
    ).lean<PollDocument>()
    return { poll: updated ? toDTO(updated) : null, result: 'changed' }
  }

  const updated = await Model.findOneAndUpdate(
    { dayKey, votes: { $not: { $elemMatch: { h: hash } } } },
    { $push: { votes: { h: hash, c: choice, at: new Date(), changeUntil: null } }, $inc: { [choice]: 1 } },
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

/**
 * Bu kullanıcının (IP hash'i) oy durumu — "ben oy verdim mi, ne zaman,
 * değiştirme pencerem var mı" bilgisi. Tüm zamanlama sunucuda tutulur,
 * böylece istemci ile sunucu asla senkronize olmaz.
 */
export interface MyVoteInfo {
  choice: 'yes' | 'no'
  at: number          // oyun verildiği an
  changeUntil: number // değiştirme penceresinin bitişi (0 = kapalı)
  pressUntil: number  // "Oyumu Değiştir" butonuna basma süresi (at + 20 sn)
}

export const PRESS_WINDOW_MS = 20_000

export async function getMyVote(dayKey: string, hash: string): Promise<MyVoteInfo | null> {
  const raw = await getPollRaw(dayKey)
  if (!raw) return null
  const v = (raw as any).votes?.find((x: any) => x.h === hash)
  if (!v) return null
  const at = v.at ? new Date(v.at).getTime() : Date.now()
  return {
    choice: v.c,
    at,
    changeUntil: v.changeUntil ? new Date(v.changeUntil).getTime() : 0,
    pressUntil: at + PRESS_WINDOW_MS
  }
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

/**
 * Oy değiştirme penceresini açar.
 * Pencerenin süresi 10 saniyedir: butona basıldıktan sonra oy bu süre içinde
 * değiştirilmelidir, aksi hâlde değiştirme reddedilir.
 */
export async function openChangeWindow(
  dayKey: string,
  hash: string,
  seconds = 10
): Promise<{ until: number; poll: PollDTO | null }> {
  const raw = await getPollRaw(dayKey)
  if (!raw) return { until: 0, poll: null }
  const until = new Date(Date.now() + seconds * 1000)
  const Model = await getPollModel()

  if (!Model) {
    const p = raw as MemPoll
    const v = p.votes.find(x => x.h === hash)
    if (!v) return { until: 0, poll: toDTO(p) }
    v.changeUntil = until.toISOString()
    return { until: until.getTime(), poll: toDTO(p) }
  }

  const updated = await Model.findOneAndUpdate(
    { dayKey, 'votes.h': hash },
    { $set: { 'votes.$.changeUntil': until } },
    { new: true, lean: true }
  ).lean<PollDocument>()

  if (!updated) return { until: 0, poll: toDTO(raw as PollDocument) }
  return { until: until.getTime(), poll: toDTO(updated) }
}

/**
 * Oyları sil / sıfırla.
 *  scope='today' → bugünün oyları, oy kayıtları ve trend noktaları temizlenir
 *                 (gün satırı kalır, arşiv bozulmaz)
 *  scope='all'   → tüm günlerin oyları + log + trend tamamen silinir
 *
 * votesEpoch yenilenir → tarayıcıdaki eski oy kaydı geçersizleşir, kullanıcı tekrar oy verebilir.
 */
export async function clearVotes(
  scope: 'today' | 'all',
  todayKey: string
): Promise<{ polls: number; logs: number; snapshots: number }> {
  const Model = await getPollModel()
  const LogModel = await getVoteLogModel()
  const SnapModel = await getSnapshotModel()
  const epoch = newEpoch()
  let polls = 0, logs = 0, snapshots = 0

  if (scope === 'today') {
    if (Model) {
      const r = await Model.updateOne(
        { dayKey: todayKey },
        { $set: { yes: 0, no: 0, votes: [], votesEpoch: epoch, reopenedAt: new Date() } }
      )
      polls = r.modifiedCount || 0
    } else {
      const p = mem.polls.get(todayKey)
      if (p) {
        p.yes = 0; p.no = 0; p.votes = []
        ;(p as any).votesEpoch = epoch
        polls = 1
      }
    }
    if (LogModel) {
      const r = await LogModel.deleteMany({ dayKey: todayKey })
      logs = r.deletedCount || 0
    } else {
      logs = await clearVoteLog(todayKey)
    }
    if (SnapModel) {
      const r = await SnapModel.deleteMany({ dayKey: todayKey })
      snapshots = r.deletedCount || 0
    } else {
      const before = snapMem.items.length
      snapMem.items = snapMem.items.filter(i => i.dayKey !== todayKey)
      snapshots = before - snapMem.items.length
    }
  } else {
    if (Model) {
      const r = await Model.deleteMany({})
      polls = r.deletedCount || 0
    } else {
      polls = mem.polls.size
      mem.polls.clear()
    }
    if (LogModel) {
      const r = await LogModel.deleteMany({})
      logs = r.deletedCount || 0
    } else {
      logs = await clearVoteLog(null)
    }
    if (SnapModel) {
      const r = await SnapModel.deleteMany({})
      snapshots = r.deletedCount || 0
    } else {
      snapshots = snapMem.items.length
      snapMem.items = []
    }
  }

  return { polls, logs, snapshots }
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
