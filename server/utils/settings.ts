import type { SettingsDocument } from './db.ts'
import { getSettingsModel } from './db.ts'

export const DEFAULT_QUESTION = 'Dayı bugün yayın açacak mı?'

const g = globalThis as any
if (!g.__swaggybark_settingsMem) g.__swaggybark_settingsMem = { map: new Map<string, string>() }
const mem = g.__swaggybark_settingsMem as { map: Map<string, string> }

/**
 * Ayar önbelleği — her istekte 3 Mongo okuması yapılmasın diye.
 * 30 sn yeterli: soru/reklam değişiklikleri zaten anında görünmesi gereken
 * şeyler, admin panelinden kaydedildikten sonra bu süre içinde yayına girer.
 */
if (!g.__swaggybark_settingsCache) g.__swaggybark_settingsCache = new Map<string, { value: string; at: number }>()
const cache = g.__swaggybark_settingsCache as Map<string, { value: string; at: number }>
const SETTINGS_TTL = 30_000

/** Ayarları oku (yoksa varsayılan). */
export async function getSetting(key: string, fallback: string): Promise<string> {
  const now = Date.now()
  const hit = cache.get(key)
  if (hit && now - hit.at < SETTINGS_TTL) return hit.value

  const Model = await getSettingsModel()
  let value: string
  if (!Model) {
    value = mem.map.get(key) ?? fallback
  } else {
    try {
      const doc = await Model.findOne({ key }).lean<SettingsDocument>()
      value = doc?.value ?? fallback
    } catch {
      value = fallback
    }
  }
  cache.set(key, { value, at: now })
  return value
}

/** Ayarı yaz (önbellek de düşer). */
export async function setSetting(key: string, value: string): Promise<void> {
  cache.set(key, { value, at: Date.now() })
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

/* ---------------- Geliştirici imzası (alt bilgi) ---------------- */

export interface CreditConfig {
  visible: boolean
  label: string   // "Developed by"
  name: string    // "zmchampion" (parlak yazılır)
  url: string     // tıklanınca gidilecek adres
}

export const DEFAULT_CREDIT: CreditConfig = {
  visible: true,
  label: 'Developed by',
  name: 'zmchampion',
  url: 'https://guns.lol/zmchampion'
}

export async function getCredit(): Promise<CreditConfig> {
  try {
    const raw = await getSetting('credit', '')
    if (!raw) return { ...DEFAULT_CREDIT }
    const c = JSON.parse(raw)
    return {
      visible: c.visible !== false,
      label: String(c.label ?? DEFAULT_CREDIT.label).slice(0, 40),
      name: String(c.name ?? DEFAULT_CREDIT.name).slice(0, 40),
      url: String(c.url ?? DEFAULT_CREDIT.url).slice(0, 500)
    }
  } catch {
    return { ...DEFAULT_CREDIT }
  }
}

export async function setCredit(config: Partial<CreditConfig>): Promise<CreditConfig> {
  const clean: CreditConfig = {
    visible: config.visible !== false,
    label: String(config.label ?? DEFAULT_CREDIT.label).slice(0, 40),
    name: String(config.name ?? DEFAULT_CREDIT.name).slice(0, 40),
    url: String(config.url ?? DEFAULT_CREDIT.url).slice(0, 500)
  }
  await setSetting('credit', JSON.stringify(clean))
  return clean
}
