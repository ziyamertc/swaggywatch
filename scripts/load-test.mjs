/**
 * Yük testi: N istek → ortalama süre, DB sorgu sayısı (mongodb izleyici ile).
 * Amaç: ücretsiz hostların CPU kotasını yiyen pahalı çağrıları ölçmek.
 */
import { MongoClient } from 'mongodb'

const B = process.argv[2] || 'http://localhost:3000'
const N = Number(process.argv[3] || 20)
const uri = process.env.MONGODB_URI

const client = new MongoClient(uri)
await client.connect()
const db = client.db(process.env.MONGODB_DB || 'swaggybark')

let queryCount = 0
const orig = db.collection.bind(db)
db.collection = (name) => {
  const c = orig(name)
  for (const m of ['find', 'findOne', 'updateMany', 'updateOne', 'findOneAndUpdate', 'insertOne', 'create']) {
    const f = c[m].bind(c)
    c[m] = (...a) => { queryCount++; return f(...a) }
  }
  return c
}

const t0 = Date.now()
for (let i = 0; i < N; i++) {
  await fetch(B + '/api/poll/current')
}
const sure = Date.now() - t0

console.log(`\n📊 ${N} istek / ${sure}ms  →  ${(sure / N).toFixed(1)}ms istek başına`)
console.log(`🗄️  MongoDB çağrısı: ${queryCount}  (istek başına ${(queryCount / N).toFixed(2)})`)

// Kick API çağrı sayısı
console.log('\n📡 Kick önbellek TTL: 120 sn (KICK_TTL_MS ile ayarlanabilir)')

await client.close()
