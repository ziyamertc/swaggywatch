/** Test verilerini temizler (opsiyonel: --all tüm günleri siler). */
import mongoose from 'mongoose'

await mongoose.connect(process.env.MONGODB_URI, {
  serverSelectionTimeoutMS: 10000,
  dbName: process.env.MONGODB_DB || 'swaggybark'
})
const db = mongoose.connection.db

const all = process.argv.includes('--all')
const res = all
  ? await db.collection('polls').deleteMany({})
  : await db.collection('polls').deleteMany({ votes: { $size: 1 } })

console.log(all ? '🗑 Tüm oylama dokümanları silindi' : '🗑 Test oyları (1 oylu kayıtlar) silindi', res.deletedCount)
await mongoose.disconnect()
