/**
 * Durum makinesi testi — yayın durumu ⇄ oylama durumu senkronizasyonu.
 * Sunucuyu ayağa kaldırmadan, saf mantık üzerinden çalışır.
 *
 * Senaryolar:
 *  1) Gün başı: oylama açık
 *  2) Yayın açılıyor → oylama kapanıyor
 *  3) Yayın sürerken oy verilemiyor
 *  4) Yayın bitiyor → oylama OTOMATİK açılıyor, oylar KORUNUYOR
 *  5) Yayın tekrar açılıyor → tekrar kapanıyor
 *  6) Kick kontrolü hata veriyor → hiçbir şey değişmiyor
 *  7) Yayıncı elle kapatıyor → yayın bitse bile açılmıyor
 *  8) Yayıncı override ile açık tutuyor → yayın bitince de açık
 *  9) Gece 03:00 → yeni gün, yeni oylama
 */
import { syncPollWithStream, manualControl } from '../server/utils/poll-state.ts'

const dayKey = '2026-10-19'
const dayKey2 = '2026-10-20'

const stream = (live, ok = true, startedAt = '2026-10-19 17:13:52') => ({ live, ok, startedAt, title: 'TEST' })

let fails = 0
function check(label, cond, extra = '') {
  if (!cond) fails++
  console.log(`${cond ? '✅' : '❌'} ${label}${extra ? ' → ' + extra : ''}`)
}

console.log('── 1) Gün başı: oylama açık ──')
let r = await syncPollWithStream(dayKey, stream(false))
check('oylama açık', r.poll.status === 'active', r.poll.status)

console.log('\n── 2) Yayın açılıyor → oylama kapanıyor ──')
r = await syncPollWithStream(dayKey, stream(true))
check('durum closed_stream', r.poll.status === 'closed_stream', r.poll.status)
check('değişiklik bildirildi', r.changed === 'closed', r.changed)

console.log('\n── 3) Yayın sürerken tekrar senkron: kapalı kalır ──')
r = await syncPollWithStream(dayKey, stream(true))
check('hâlâ closed_stream', r.poll.status === 'closed_stream', r.poll.status)
check('değişiklik yok', r.changed === 'none', r.changed)

console.log('\n── 4) Yayın bitiyor → oylama otomatik açılıyor ──')
r = await syncPollWithStream(dayKey, stream(false))
check('durum active', r.poll.status === 'active', r.poll.status)
check('açılış bildirildi', r.changed === 'opened', r.changed)

console.log('\n── 5) Yayın tekrar açılıyor → tekrar kapanıyor ──')
r = await syncPollWithStream(dayKey, stream(true))
check('durum closed_stream', r.poll.status === 'closed_stream', r.poll.status)

console.log('\n── 6) Kick kontrolü hata veriyor → dokunulmuyor ──')
r = await syncPollWithStream(dayKey, stream(false, false))
check('durum değişmedi (closed_stream)', r.poll.status === 'closed_stream', r.poll.status)
check('neden: error', r.reason === 'error', r.reason)

console.log('\n── 7) Yayıncı elle kapatıyor ──')
await manualControl(dayKey, 'close')
r = await syncPollWithStream(dayKey, stream(false))
check('closed_manual kaldı', r.poll.status === 'closed_manual', r.poll.status)
check('otomatik açılmadı', r.changed === 'none', r.changed)

console.log('\n── 8) Yayıncı override: yayın sırasında açık tutuyor ──')
await manualControl(dayKey, 'open')
r = await syncPollWithStream(dayKey, stream(true))
check('override → active kaldı', r.poll.status === 'active', r.poll.status)
r = await syncPollWithStream(dayKey, stream(false))
check('yayın bitince de active', r.poll.status === 'active', r.poll.status)

console.log('\n── 9) Otomatik moda dönüş ──')
await manualControl(dayKey, 'auto')
r = await syncPollWithStream(dayKey, stream(true))
check('yayın açık → yeniden kapandı', r.poll.status === 'closed_stream', r.poll.status)

console.log('\n── 10) Gece 03:00 → yeni gün, yeni oylama ──')
r = await syncPollWithStream(dayKey2, stream(false))
check('yeni gün oylaması active', r.poll.status === 'active', r.poll.status)
check('gün anahtarı değişti', r.poll.dayKey === dayKey2, r.poll.dayKey)
check('dünkü gün arşivde', r.poll.dayKey !== dayKey)

console.log('\n── 11) Yayın 03:00\'ü aşarsa (gece yarısı) ──')
// gün 2 oluşturuldu; simüle: gün2 yayın sürerken gün3'e geçiş
r = await syncPollWithStream(dayKey2, stream(true))
check('gün2 yayınla kapandı', r.poll.status === 'closed_stream', r.poll.status)
r = await syncPollWithStream('2026-10-21', stream(true))
check('gün3 de yayınla kapalı (yeni gün oylanamaz)', r.poll.status === 'closed_stream', r.poll.status)
r = await syncPollWithStream('2026-10-21', stream(false))
check('yayın bitince gün3 açıldı', r.poll.status === 'active', r.poll.status)

console.log(fails === 0 ? '\nTÜM TESTLER GEÇTİ ✅' : `\n${fails} TEST BAŞARISIZ ❌`)
process.exit(fails === 0 ? 0 : 1)
