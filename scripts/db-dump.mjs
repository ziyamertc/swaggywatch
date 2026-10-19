/** MongoDB'deki oylama dokümanını gösterir (şifre dahil değil). */
import mongoose from 'mongoose'

await mongoose.connect(process.env.MONGODB_URI, {
  serverSelectionTimeoutMS: 10000,
  dbName: process.env.MONGODB_DB || 'swaggybark'
})
const db = mongoose.connection.db

const colls = await db.listCollections().toArray()
console.log('📂 Koleksiyonlar:', colls.map(c => c.name).join(', ') || '(yok)')

const docs = await db.collection('polls').find({}).sort({ dayKey: -1 }).toArray()
console.log('📄 Oylama dokümanları:', docs.length)
for (const d of docs) {
  console.log(JSON.stringify({
    dayKey: d.dayKey,
    yes: d.yes,
    no: d.no,
    status: d.status,
    manualOverride: d.manualOverride,
    oySayisi: (d.votes || []).length,
    oyKayitlari: (d.votes || []).map(v => ({ hash: String(v.h).slice(0, 12) + '…', secim: v.c })),
    streamStartedAt: d.streamStartedAt,
    createdAt: d.createdAt,
    closedAt: d.closedAt
  }, null, 2))
}

// index kontrolü
const idx = await db.collection('polls').indexes()
console.log('🗂️ İndeksler:', idx.map(i => `${i.name} (${i.key && Object.keys(i.key).join(',')})`).join(' | '))

await mongoose.disconnect()
