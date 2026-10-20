/**
 * Render'daki MONGODB_URI değerini test eder.
 *
 * Kullanım:
 *   node scripts\db-check.mjs "mongodb+srv://..."       (tırnak içinde, kopyala-yapıştır)
 *
 * Render'da yapılacak: Environment Variables → MONGODB_URI → düzenle → bu komutla
 * test et → sonra kaydet. Böylece neden "bad auth" aldığını anında görürsün.
 */
import { MongoClient } from 'mongodb'

const uri = process.argv[2] || process.env.MONGODB_URI
if (!uri) {
  console.error('❌ URI verilmedi')
  process.exit(1)
}

console.log('🔗 Test edilen URI (şifre gizli):')
console.log('   ' + uri.replace(/\/\/([^:]+):([^@]*)@/, '//$1:***@'))
console.log('   uzunluk:', uri.length, '| boşluk var mı:', /\s/.test(uri) ? 'EVET ⚠️' : 'yok')
console.log('   placeholder var mı:', /<[^>]+>/.test(uri) ? 'EVET ⚠️' : 'yok')

try {
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 12000 })
  await client.connect()
  const db = client.db(process.env.MONGODB_DB || 'swaggybark')
  const cols = await db.listCollections().toArray()
  console.log('✅ BAĞLANTI BAŞARILI')
  console.log('📂 Koleksiyonlar:', cols.map(c => c.name).join(', ') || '(yok)')
  await client.close()
  process.exit(0)
} catch (err) {
  console.error('❌ BAĞLANAMADI:', err?.message || err)
  if (/bad auth/i.test(err?.message || '')) {
    console.error('\n💡 "bad auth" = kullanıcı adı/şifre hatalı. Kontrol et:')
    console.error('   • Atlas → Database Access → "dayico" kullanıcısı var mı?')
    console.error('   • Şifre "dayico3322" mi? (değiştirdiysen yenisini gir)')
    console.error('   • URI içinde boşluk/sekme/satır sonu var mı? (kopyala-yapıştır bozulur)')
    console.error('   • Şifrede özel karakter varsa URL-encode: @→%40  :→%3A  /→%2F  #→%23')
  }
  process.exit(1)
}
