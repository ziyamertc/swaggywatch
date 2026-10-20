import mongoose, { Schema, Model, Document } from 'mongoose'

/**
 * Oylama durumları:
 *  active        → oylama açık, oy verilebilir
 *  closed_stream → yayın sürdüğü için kapandı (yayın bitince OTOMATİK tekrar açılır)
 *  closed_manual → yayıncı elle kapattı (otomatik açılmaz)
 *  ended_day     → gün döndü (03:00), arşive düştü
 */
export type PollStatus = 'active' | 'closed_stream' | 'closed_manual' | 'ended_day'

export interface PollDocument extends Document {
  dayKey: string
  yes: number
  no: number
  votes: {
    h: string
    c: 'yes' | 'no'
    at?: Date
    changeUntil?: Date | null   // oy değiştirme penceresi (1 dk)
  }[]
  votesEpoch: string            // oylar sıfırlandığında yenilenir → eski oy kaydı geçersizleşir
  status: PollStatus
  manualOverride: boolean   // yayıncı yayın sırasında oylamayı açık tuttu
  createdAt: Date
  closedAt: Date | null     // en son kapandığı an
  reopenedAt: Date | null   // en son açıldığı an
  endedAt: Date | null      // gün döndüğü an
  streamStartedAt: string | null // o gün yayının başladığı an
}

const PollSchema = new Schema<PollDocument>({
  dayKey: { type: String, required: true, unique: true },
  yes: { type: Number, required: true, default: 0 },
  no: { type: Number, required: true, default: 0 },
  votes: [{
    _id: false,
    h: { type: String, required: true },
    c: { type: String, required: true, enum: ['yes', 'no'] },
    at: { type: Date, default: Date.now },
    changeUntil: { type: Date, default: null }
  }],
  votesEpoch: { type: String, required: false, default: '' },
  status: { type: String, enum: ['active', 'closed_stream', 'closed_manual', 'ended_day'], default: 'active' },
  manualOverride: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  closedAt: { type: Date, default: null },
  reopenedAt: { type: Date, default: null },
  endedAt: { type: Date, default: null },
  streamStartedAt: { type: String, default: null }
})

/**
 * Gün içi trend anlık görüntüleri — beklenti yüzdesinin zamana göre değişimi.
 * (oy oranı eğrisi için)
 */
export interface SnapshotDocument extends Document {
  dayKey: string
  at: Date
  yes: number
  no: number
}

const SnapshotSchema = new Schema<SnapshotDocument>({
  dayKey: { type: String, required: true, index: true },
  at: { type: Date, required: true, default: Date.now },
  yes: { type: Number, required: true, default: 0 },
  no: { type: Number, required: true, default: 0 }
})
SnapshotSchema.index({ dayKey: 1, at: 1 })

/** Ayarlar (soru metni vb.) */
export interface SettingsDocument extends Document {
  key: string
  value: string
}

const SettingsSchema = new Schema<SettingsDocument>({
  key: { type: String, required: true, unique: true },
  value: { type: String, required: true }
})

/**
 * Oylama logu — admin panelinde görüntülenir.
 * Ham IP + tarayıcı + saat + oy. Yalnızca ADMIN_KEY ile erişilebilir.
 * NOT: IP bir kişisel veridir → "Logu temizle" ile silinebilir.
 */
export interface VoteLogDocument extends Document {
  dayKey: string
  at: Date
  ip: string
  hash: string
  browser: string
  os: string
  device: string
  ua: string
  choice: 'yes' | 'no'
  action: 'added' | 'changed'
}

const VoteLogSchema = new Schema<VoteLogDocument>({
  dayKey: { type: String, required: true, index: true },
  at: { type: Date, required: true, default: Date.now, index: true },
  ip: { type: String, required: true },
  hash: { type: String, required: true },
  browser: { type: String, required: true, default: 'Diğer' },
  os: { type: String, required: true, default: 'Bilinmiyor' },
  device: { type: String, required: true, default: 'Masaüstü' },
  ua: { type: String, default: '' },
  choice: { type: String, required: true, enum: ['yes', 'no'] },
  action: { type: String, required: true, enum: ['added', 'changed'] }
})
VoteLogSchema.index({ dayKey: 1, at: -1 })

const g = globalThis as any

export const mongoConfigured = !!process.env.MONGODB_URI

/** Bağlantı başarısız olursa bellek moduna düşeriz (sistem çökmez, uyarı basar). */
let connFailedAt = 0
let lastError: string | null = null
const RETRY_AFTER = 5 * 60 * 1000

/** Son bağlantı hatasının mesajı (panelde gösterilmek için). */
export function getLastDbError(): string | null {
  return lastError
}

export async function getPollModel(): Promise<Model<PollDocument> | null> {
  if (!mongoConfigured) return null

  // son hatada bağlantı koptuysa, 5 dakika boyunca bellek modunda çalış
  if (connFailedAt && Date.now() - connFailedAt < RETRY_AFTER) return null

  try {
    if (!g.__swaggybark_model) {
      if (!g.__swaggybark_connPromise) {
        g.__swaggybark_connPromise = mongoose.connect(process.env.MONGODB_URI as string, {
          serverSelectionTimeoutMS: 9000,
          dbName: process.env.MONGODB_DB || 'swaggybark'
        })
      }
      await g.__swaggybark_connPromise
      g.__swaggybark_model = mongoose.model<PollDocument>('Poll', PollSchema)
      g.__swaggybark_snapshotModel = mongoose.model<SnapshotDocument>('Snapshot', SnapshotSchema)
      g.__swaggybark_settingsModel = mongoose.model<SettingsDocument>('Setting', SettingsSchema)
      g.__swaggybark_voteLogModel = mongoose.model<VoteLogDocument>('VoteLog', VoteLogSchema)
    }
    connFailedAt = 0
    return g.__swaggybark_model
  } catch (err: any) {
    connFailedAt = Date.now()
    lastError = String(err?.message || err).slice(0, 200)
    g.__swaggybark_connPromise = null
    console.error(
      '[db] MongoDB bağlantısı başarısız — bellek moduna düşülüyor:',
      err?.message || err
    )
    return null
  }
}

export async function getSnapshotModel(): Promise<Model<SnapshotDocument> | null> {
  await getPollModel()
  return g.__swaggybark_snapshotModel ?? null
}

export async function getSettingsModel(): Promise<Model<SettingsDocument> | null> {
  await getPollModel()
  return g.__swaggybark_settingsModel ?? null
}

export async function getVoteLogModel(): Promise<Model<VoteLogDocument> | null> {
  await getPollModel()
  return g.__swaggybark_voteLogModel ?? null
}
