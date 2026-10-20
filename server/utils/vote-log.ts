import { getVoteLogModel, type VoteLogDocument } from './db.ts'
import { parseUserAgent } from './user-agent.ts'

export interface LogEntry {
  id: string
  dayKey: string
  at: string
  ip: string
  browser: string
  os: string
  device: string
  choice: 'yes' | 'no'
  action: 'added' | 'changed'
}

export interface LogStats {
  toplam: number
  benzersizIp: number
  yes: number
  no: number
  tarayici: { ad: string; adet: number }[]
  cihaz: { ad: string; adet: number }[]
}

/* Bellek deposu (MongoDB yoksa, yerel test modu) */
const g = globalThis as any
if (!g.__swaggybark_logMem) g.__swaggybark_logMem = { items: [] as any[] }
const mem = g.__swaggybark_logMem as { items: any[] }

/** Oyu logla (admin panelinde görüntülenecek). */
export async function logVote(opts: {
  dayKey: string
  ip: string
  hash: string
  ua: string
  choice: 'yes' | 'no'
  action: 'added' | 'changed'
}): Promise<void> {
  const { browser, os, device } = parseUserAgent(opts.ua)
  const Model = await getVoteLogModel()

  if (!Model) {
    mem.items.push({
      _id: String(Date.now() + Math.random()),
      dayKey: opts.dayKey,
      at: new Date(),
      ip: opts.ip,
      hash: opts.hash,
      browser, os, device,
      ua: opts.ua,
      choice: opts.choice,
      action: opts.action
    })
    if (mem.items.length > 2000) mem.items.splice(0, mem.items.length - 2000)
    return
  }

  try {
    await Model.create({
      dayKey: opts.dayKey,
      at: new Date(),
      ip: opts.ip,
      hash: opts.hash,
      browser, os, device,
      ua: opts.ua,
      choice: opts.choice,
      action: opts.action
    })
  } catch (e) {
    console.warn('[log] kayıt başarısız:', (e as any)?.message || e)
  }
}

/** Log kayıtlarını getir (dayKey verilmezse tüm günler). */
export async function getVoteLog(
  dayKey: string | null,
  limit = 200
): Promise<{ entries: LogEntry[]; stats: LogStats }> {
  const Model = await getVoteLogModel()

  let raw: any[]
  if (!Model) {
    raw = mem.items
      .filter(i => !dayKey || i.dayKey === dayKey)
      .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
      .slice(0, limit)
  } else {
    const q: any = dayKey ? { dayKey } : {}
    raw = await Model.find(q).sort({ at: -1 }).limit(limit).lean<any[]>()
  }

  const entries: LogEntry[] = raw.map((d: any) => ({
    id: String(d._id),
    dayKey: d.dayKey,
    at: new Date(d.at).toISOString(),
    ip: d.ip,
    browser: d.browser,
    os: d.os,
    device: d.device,
    choice: d.choice,
    action: d.action
  }))

  // istatistikler tüm kayıtlar üzerinden (limit uygulanmadan)
  const all = await getAllForStats(dayKey)
  const stats: LogStats = {
    toplam: all.length,
    benzersizIp: new Set(all.map((i: any) => i.ip)).size,
    yes: all.filter((i: any) => i.choice === 'yes').length,
    no: all.filter((i: any) => i.choice === 'no').length,
    tarayici: countBy(all.map((i: any) => i.browser)),
    cihaz: countBy(all.map((i: any) => i.device))
  }

  return { entries, stats }
}

async function getAllForStats(dayKey: string | null): Promise<any[]> {
  const Model = await getVoteLogModel()
  if (!Model) {
    return mem.items.filter(i => !dayKey || i.dayKey === dayKey)
  }
  const q: any = dayKey ? { dayKey } : {}
  return await Model.find(q).lean<any[]>()
}

function countBy(items: string[]): { ad: string; adet: number }[] {
  const m = new Map<string, number>()
  for (const i of items) m.set(i, (m.get(i) || 0) + 1)
  return [...m.entries()]
    .map(([ad, adet]) => ({ ad, adet }))
    .sort((a, b) => b.adet - a.adet)
}

/** Logu temizle (dayKey verilmezse tümü). */
export async function clearVoteLog(dayKey: string | null): Promise<number> {
  const Model = await getVoteLogModel()
  if (!Model) {
    const before = mem.items.length
    mem.items = dayKey ? mem.items.filter(i => i.dayKey !== dayKey) : []
    return before - mem.items.length
  }
  const q: any = dayKey ? { dayKey } : {}
  const res = await Model.deleteMany(q)
  return res.deletedCount || 0
}
