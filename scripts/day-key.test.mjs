import { dayKeyFor, trDateName } from '../shared/utils/day.ts'

// TSİ = UTC+3. Gece 03:00'te gün değişmeli.
const cases = [
  ['2026-10-19T12:00:00Z', '2026-10-19', '19 öğlen TSİ'],
  ['2026-10-19T23:30:00Z', '2026-10-19', '20 Ekim 02:30 TSİ → hâlâ 19 Ekim'],
  ['2026-10-19T23:59:00Z', '2026-10-19', '20 Ekim 02:59 TSİ → hâlâ 19 Ekim'],
  ['2026-10-20T00:00:00Z', '2026-10-20', '20 Ekim 03:00 TSİ → yeni gün'],
  ['2026-10-20T00:01:00Z', '2026-10-20', '20 Ekim 03:01 TSİ → yeni gün'],
  ['2026-12-31T21:30:00Z', '2026-12-31', '1 Oca 00:30 TSİ → hâlâ 31 Ara'],
  ['2026-12-31T22:00:00Z', '2026-12-31', '1 Oca 01:00 TSİ → hâlâ 31 Ara'],
  ['2027-01-01T00:00:00Z', '2027-01-01', '1 Oca 03:00 TSİ → yeni gün'],
  ['2027-01-01T21:00:00Z', '2027-01-01', '2 Oca 00:00 TSİ → hâlâ 1 Oca'],
  ['2027-01-01T22:00:00Z', '2027-01-01', '2 Oca 01:00 TSİ → hâlâ 1 Oca'],
  ['2027-01-02T00:00:00Z', '2027-01-02', '2 Oca 03:00 TSİ → yeni gün']
]

let fail = 0
for (const [iso, expected, label] of cases) {
  const got = dayKeyFor(new Date(iso))
  const ok = got === expected
  if (!ok) fail++
  console.log(`${ok ? '✅' : '❌'} ${label.padEnd(42)} beklenen=${expected} alınan=${got}`)
}

console.log('\n--- biçim kontrolü ---')
console.log('bugün  :', dayKeyFor(), '→', trDateName(dayKeyFor()))
console.log(fail === 0 ? '\nTÜM TESTLER GEÇTİ ✅' : `\n${fail} TEST BAŞARISIZ ❌`)
process.exit(fail === 0 ? 0 : 1)
