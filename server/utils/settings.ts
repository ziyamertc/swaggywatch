import type { SettingsDocument } from './db.ts'
import { getSettingsModel } from './db.ts'

export const DEFAULT_QUESTION = 'Dayı bugün yayın açacak mı?'

const g = globalThis as any
if (!g.__swaggybark_settingsMem) g.__swaggybark_settingsMem = { map: new Map<string, string>() }
const mem = g.__swaggybark_settingsMem as { map: Map<string, string> }

/** Ayarları oku (yoksa varsayılan). */
export async function getSetting(key: string, fallback: string): Promise<string> {
  const Model = await getSettingsModel()
  if (!Model) return mem.map.get(key) ?? fallback
  try {
    const doc = await Model.findOne({ key }).lean<SettingsDocument>()
    return doc?.value ?? fallback
  } catch {
    return fallback
  }
}

/** Ayarı yaz. */
export async function setSetting(key: string, value: string): Promise<void> {
  const Model = await getSettingsModel()
  if (!Model) {
    mem.map.set(key, value)
    return
  }
  await Model.findOneAndUpdate({ key }, { $set: { value } }, { upsert: true })
}

/** Oylama sorusu (admin panelinden değiştirilir). */
export async function getQuestion(): Promise<string> {
  return (await getSetting('question', DEFAULT_QUESTION)) || DEFAULT_QUESTION
}

/* ---------------- Yan reklam alanları (slot) ---------------- */

export interface SlotConfig {
  enabled: boolean
  url: string        // görsel / GIF adresi
  link: string       // tıklanınca açılacak adres (reklam)
  title: string      // alt metin / ipucu
  width: number      // genişlik (px)
  radius: number     // köşe yuvarlaklığı
  opacity: number    // 0.2 - 1
}

export const DEFAULT_SLOT: SlotConfig = {
  enabled: false,
  url: '',
  link: '',
  title: '',
  width: 260,
  radius: 16,
  opacity: 1
}

export type SlotSide = 'left' | 'right'

function clampSlot(c: Partial<SlotConfig>): SlotConfig {
  return {
    enabled: !!c.enabled,
    url: String(c.url ?? '').slice(0, 800),
    link: String(c.link ?? '').slice(0, 800),
    title: String(c.title ?? '').slice(0, 120),
    width: Math.min(520, Math.max(140, Number(c.width) || DEFAULT_SLOT.width)),
    radius: Math.min(48, Math.max(0, Number(c.radius) || 0)),
    opacity: Math.min(1, Math.max(0.2, Number(c.opacity) || 1))
  }
}

export async function getSlot(side: SlotSide): Promise<SlotConfig> {
  try {
    const raw = await getSetting(`slot_${side}`, JSON.stringify(DEFAULT_SLOT))
    return clampSlot(JSON.parse(raw))
  } catch {
    return { ...DEFAULT_SLOT }
  }
}

export async function getSlots(): Promise<Record<SlotSide, SlotConfig>> {
  const [left, right] = await Promise.all([getSlot('left'), getSlot('right')])
  return { left, right }
}

export async function setSlot(side: SlotSide, config: Partial<SlotConfig>): Promise<SlotConfig> {
  const clean = clampSlot(config)
  await setSetting(`slot_${side}`, JSON.stringify(clean))
  return clean
}
