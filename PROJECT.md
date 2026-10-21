# 📌 PROJE NOTLARI — Swaggywatch

> Bu dosya, projeyi özetleyen ve sonraki oturumlarda bağlamı taşıyan dosyadır.
> Kod yeterince açık yorumlandığı için burada **kararlar, sürüm geçmişi ve yapılacaklar** tutulur.

---

## 🎯 Projenin amacı

Kick kanalı **Swaggybark** için sohbet oylama paneli.
Soru sorulur → herkes **EVET / HAYIR** der → sonuç herkese anında gösterilir.

**Canlı:** https://swaggywatch.onrender.com
**Repo:** https://github.com/ziyamertc/swaggywatch

---

## 🧱 Mimari

| Katman | Teknoloji |
|---|---|
| Çatı | Nuxt 3 (Nitro), Vue 3, saf CSS (Kicks teması) |
| Sunucu | Nitro API + **WebSocket** (`/_ws`) + SSE yedeği (`/api/stream`) |
| Veritabanı | MongoDB Atlas → `swaggybark` DB → koleksiyonlar: `polls`, `snapshots`, `settings`, `votelogs`, `streams` |
| Yayın algılama | Kick API `GET /kick.com/api/v2/channels/{slug}` (30 sn önbellek) |
| Geçmiş yayın | Kick API `GET /kick.com/api/v2/channels/{slug}/videos` |
| Deploy | Render (Dockerfile, ücretsiz plan) — `render.yaml` + `Dockerfile` hazır |

### Klasör haritası
```
app.vue                    → Nuxt sarmalayıcı (NuxtPage)
pages/index.vue            → ana panel (izleyici)
pages/overlay.vue          → OBS overlay'ı (/overlay)
pages/admin.vue            → yayıncı paneli (/admin, gizli)
components/AdminSection.vue    → katlanabilir bölüm
components/DeveloperCredit.vue → alt imza (admin'den düzenlenir)
components/VoteFloats.vue      → uçuşan +1 animasyonları
composables/useLiveUpdates.ts → WebSocket + SSE istemcisi
composables/useVoteFloats.ts  → +1 listesi
composables/useFavicon.ts     → sekme ikonu = kanal logosu
server/api/poll/*.ts        → current, vote, control, question, slot, credit, me, change-window, log
server/api/stream.get.ts    → SSE
server/routes/_ws.ts        → WebSocket
server/utils/               → db, poll-service, poll-state, kick, kick-channel, vote-log,
                              settings, state, bus, hash, user-agent, streams, prediction
server/tasks/poll/          → keepalive (5 dk), streamhistory (saatlik)
shared/utils/day.ts         → TSİ 03:00 gün anahtarı (istemci+sunucu ortak)
scripts/*.mjs              → test ve bakım araçları
```

---

## ✅ Kurallar (işin özü — bozma!)

| Kural | Detay |
|---|---|
| Gün döngüsü | **TSİ 03:00**'te yeni gün. 00:00–02:59 hâlâ önceki gün sayılır. `shared/utils/day.ts` tek kaynak. |
| Günde 1 oy | **Cihaz kimliği** (tarayıcıdaki rastgele UUID, sunucuda HMAC-SHA256 ile özetlenir). IP sadece **kötüye kullanım sınırı** (8 oy/IP) için. ⚠️ IP'ye göre kural **kötüydü**: Türkiye'deki mobil operatörler (CGNAT) yüzlerce aboneyi tek IP'den çıkarıyor, telefondan oy atan izleyicilerin çoğu engelleniyordu. |
| Oyu değiştirme | Oy sonrası **20 sn** "Oyumu Değiştir" butonu, basınca **10 sn** değiştirme penceresi. Zamanlama **sunucuda** (`/api/poll/me`) — kilitlenme olmaz. |
| Yayın kapama | Kick'te yayın açıksa oylama `closed_stream` olur; yayın bitince **otomatik açılır**. |
| Otomatik mod | Admin → 🤖 Otomatik → yayın durumuna göre kendi kararını verir. |
| votesEpoch | Oylar sıfırlanınca epoch değişir → tarayıcıdaki eski oy geçersizleşir, **tekrar oy verilebilir**. |
| Kick User-Agent | **Tarayıcı taklidi yapma!** Kick edge'i 403 veriyor. `KICK_UA=swaggybark-panel/1.0` nötr UA kullan. |

---

## 🔑 Environment (Render Dashboard → Environment)

```
MONGODB_URI   = mongodb+srv://<kullanıcı>:<şifre>@cluster0.<cluster>.mongodb.net/?retryWrites=true&w=majority
MONGODB_DB    = swaggybark
VOTE_SECRET   = <64 hex>
ADMIN_KEY     = <32 hex>          ← Render otomatik üretir, dashboard'dan gör
KICK_CHANNEL  = swaggybark
KICK_UA       = swaggybark-panel/1.0
```

> ⚠️ **Güvenlik:** `VOTE_SECRET` ve `ADMIN_KEY` asla commit edilmez (`.env` gitignore'da).
> Şifreler sohbet geçmişinde açıksa **rotasyon** yapılmalı.

---

## 🧪 Test komutları

```bash
npm test              # gün sınır durumları + durum makinesi (22 senaryo)
npm run test:sse      # SSE gecikme ölçümü
npm run test:ws       # WebSocket canlı test
npm run db:check      # MongoDB bağlantı testi
npm run db:dump       # DB içeriğini göster
npm run db:clean      # test verilerini temizle (--all: hepsi)
npm run live-test https://swaggywatch.onrender.com   # canlı smoke test
npm run simulate:votes   # sahte oylar üret (trend testi)
```

---

## 📜 Sürüm geçmişi (önemli kararlar)

| Konu | Karar | Neden |
|---|---|---|
| Hosting | **Render** (Vercel/Netlify hesapları doluydu, Northflank kart istiyordu) | Kart gerektirmiyor, 24/7, WS destekli |
| Anlık güncelleme | **WebSocket** (+ SSE yedeği) | "F5 atmaya gerek kalmasın" |
| Oylama bölümü | **Oran/odds yok** — bahis değil, beklenti paneli | "Bu bir bahis etkinliği değil" |
| Puan sistemi | **Yok** — puanın karşılığı olmadan boş sayaç | Ödül döngüsü kurulmadan puan anlamsız |
| "Topluluk Skoru" | **Kaldırıldı** → 🛡️ güven / ⚡ oy hızı / 👥 katılımcı | Soyut sayı yerine anlaşılır bilgi |
| Admin paneli | **Katlanabilir bölümler**, gizli `/admin` | Sayfa uzunluğu rahatsız ediyordu |
| Güven aralığı | `±30%` yerine **"Düşük/Orta/Yüksek"** kelimesi | İstatistiksel ifade anlaşılmıyordu |
| Vite/Netlify | `render.yaml` + `Dockerfile` hazır, `netlify.toml` da var | Esneklik |
| Deno Deploy | Denedim → ücretsiz planda **aylık 10 saat aktif CPU** sınırı, 24/7 panel için yetersiz | Kota nedeniyle askıya alındı |
| Site uyanıklığı | **Nitro scheduled task** `poll:keepalive` → **5 dk'da bir** kendi public adresine ping (`RENDER_EXTERNAL_URL` otomatik gelir). Dışarıdan cron kurmaya gerek yok — Render cron job'ları aylık $1 + kart istiyor | Admin → "🩺 Site Uyanıklığı" bölümünden ping sayısını/son pingi görebilirsin |

---

## 🚀 YAPILACAKLAR

### 1. 🤖 AI Yayın Tahmini — ❌ RAFA KALDIRILDI (2026-10-20)

Fikir: "Swaggybark bugün yayın açacak mı?" sorusunu **matematiksel** cevaplamak.
Panelin solunda topluluk beklentisi, sağında yapay zeka tahmini olacaktı.

**Yapılanlar (prototip çalıştı, sonra geri alındı):**
- Kick VOD API'sinden geçmiş yayın günleri çekilebiliyor (`/api/v2/channels/{slug}/videos`)
- Gerçek veri: 8 benzersiz yayın günü (24 Eyl – 19 Eki), aralıklar 5,2,3,6,1,3,5 gün → ortalama 3,6 gün
- Model: **discrete hazard** (hayatta kalma analizi) + haftanın günü ağırlığı + tempel orana kalibrasyon
- Backtest (walk-forward): Brier 0,219, isabet %73

**Neden yapılmadı:** 8 gözlem çok az — model istatistiksel olarak anlamsız (güven "düşük").
Veri biriktikçe (VOD listesi sınırlı, 12 kayıt) tekrar denenebilir.

**Not:** Geçmiş veri eksikliğinin çözümü = her gün otomatik "yayında mıydı?" kaydı
(`streams` koleksiyonu) + saatlik görev. Model kodu silindi, gerekirse yeniden yazılır.

### 2. Sonraki fikirler
- Anket modu (3-4 seçenek)
- Süper oy avantajı (bağışçılara 10 oy)
- Telegram/Discord bildirimi
- Geçmiş gün detay grafiği

---

## 📌 Bilinen sınırlar

- **Kick VOD API'si ~12 kayıt döndürüyor** → geçmiş tam değil, model son birkaç haftayı kapsar.
- **Model duyuruları bilemez** → admin manuel işaretlemesi gerekir.
- **Veri az** → 30-50 yayın günü olmadan tahmin güveni düşük (panelde yazacak).
- Free Render planı 15 dk hareketsizlikte uyur → `poll:keepalive` görevi 5 dk'da bir ping atar.
