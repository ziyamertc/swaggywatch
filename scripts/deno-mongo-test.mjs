/**
 * Deno uyumluluk testi — MongoDB sürücüsü Deno'da çalışıyor mu?
 * Deno Deploy (kart gerektirmeyen host) için ön kontrol.
 */
import { MongoClient } from 'npm:mongodb@6'

const uri = Deno.env.get('MONGODB_URI')
if (!uri) {
  console.error('❌ MONGODB_URI yok')
  Deno.exit(1)
}

console.log('🔗 MongoDB\'ye bağlanılıyor (Deno + npm:mongodb)...')
try {
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 10000 })
  await client.connect()
  const res = await client.db(Deno.env.get('MONGODB_DB') || 'swaggybark')
    .collection('polls').find({}).limit(1).toArray()
  await client.close()
  console.log('✅ BAŞARILI — Deno MongoDB ile çalışıyor. Bulunan kayıt:', res.length)
  Deno.exit(0)
} catch (err) {
  console.error('❌ BAŞARISIZ:', err?.message || err)
  Deno.exit(1)
}
