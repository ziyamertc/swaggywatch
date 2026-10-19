/**
 * MongoDB bağlantı testi — env'deki URI ile bağlanıp ping atar.
 * Kullanım: node scripts/db-check.mjs
 */
import mongoose from 'mongoose'

const uri = process.env.MONGODB_URI
if (!uri) {
  console.error('❌ MONGODB_URI yok (.env dosyasını kontrol et)')
  process.exit(1)
}

const redacted = uri.replace(/\/\/([^:]+):([^@]+)@/, '//$1:***@')
console.log('🔗 Bağlanılıyor:', redacted)

try {
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000, dbName: process.env.MONGODB_DB || 'swaggybark' })
  const admin = mongoose.connection.db.admin()
  const info = await admin.command({ ping: 1 })
  const dbs = await admin.listDatabases()
  console.log('✅ Ping:', JSON.stringify(info))
  console.log('✅ Bağlantı başarılı — sunucu:', mongoose.connection.host)
  console.log('📂 Veritabanları:', dbs.databases.map(d => d.name).join(', '))
  const colls = await mongoose.connection.db.listCollections().toArray()
  console.log('📁 Koleksiyonlar:', colls.length ? colls.map(c => c.name).join(', ') : '(henüz yok)')
  await mongoose.disconnect()
  process.exit(0)
} catch (err) {
  console.error('❌ Bağlantı hatası:', err.message)
  console.error('   → Şifre doğru mu? (URI içindeki <db_password> kısmını gerçek şifre ile değiştir)')
  await mongoose.disconnect().catch(() => {})
  process.exit(1)
}
