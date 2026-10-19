# 🎮 Swaggybark Beklenti Paneli (Nuxt + MongoDB)

Kick kanalı **Swaggybark** için Evet/Hayır beklenti paneli.

- ✅ Günde **1 oy** — sunucu tarafında, IP özüne (HMAC) göre; cihaz değiştirilse bile geçmez
- ⚡ **Anlık güncelleme (SSE)** — oy verildiği anda tüm ekranlarda yansır (~0,5 sn), art arda oylar kaçmaz
- ✨ **Uçuşan +1 animasyonları** — EVET tarafında yeşil ✅+1, HAYIR tarafında kırmızı ❌+1
- ⏰ Günlük sıfırlama **gece 03:00 TSİ** — 00:00–02:59 arası hâlâ "önceki gün"dür
- 📺 **Yayın açınca oylama kapanır, yayın bitince otomatik tekrar açılır** (oylar korunur)
- 🧮 **Topluluk Skoru (0-100)** — oran + veri hacmi birleşik: "topluluk ne kadar net?"
- 📈 **Gün içi beklenti eğrisi** — topluluğun zamana göre değişimi (MongoDB snapshot'ları)
- 🔥 **Gün serisi** — "3 gündür EVET lehinde" gibi tutarlılık göstergesi
- 🗓️ Geçmiş günler arşivi (kazanan, dağılım, oy sayıları, kapanış sebebi)
- 🎛️ Yayıncı kontrolü: oylamayı elle aç/kapat, otomatik moda al

> Kick'in sözersel (v2) API'sine bazen bulut IP'lerinden erişim engellenebilir.
> Yedek olarak `POST /api/poll/control` (header: `x-admin-key`) ile oylama elle yönetilebilir.

---

## 🧠 Oylama Durum Modeli

"Gün" ve "yayın" iki ayrı kavramdır. Oylama durumu şu makineyle yönetilir:

| Durum | Anlamı | Kim açabilir? |
|---|---|---|
| `active` | Oylama açık | — |
| `closed_stream` | Yayın sürüyor, oylama geçici olarak kapalı | **Yayın bitince otomatik açılır** |
| `closed_manual` | Yayıncı elle kapattı | Yayıncı |
| `ended_day` | Gece 03:00 oldu, gün arşive düştü | — |

**Akış:**

```
Yayın kapalı  →  oylama AÇIK, oy verilebilir
Yayın açık    →  oylama KAPALI (closed_stream) — oylar SİLİNMEZ
Yayın bitti   →  oylama OTOMATİK AÇILIR, oylar kaldığı yerde durur
Gece 03:00    →  gün döner, yeni gün oylaması sıfırdan açılır
```

**Yayın 03:00'ü aşarsa?** Yeni gün başlar ama yayın hâlâ açık olduğu için yeni günün
oylaması da `closed_stream` olur → kimse oy veremez. Yayın bittiğinde **o günün oylaması
otomatik açılır** ve gün içinde oy verilebilir. Yani gece boyunca da oy kaybı yaşanmaz.

**Kullanıcı günde kaç kez oy verebilir?**
Günde **1 oy** (aynı gün içinde). Butonlar kilitlenmez; **diğer butona basarak oyunu
değiştirebilir** — eski oy düşülür, yeni oy eklenir, toplam oy sayısı değişmez.
Yayın bitip oylama yeniden açıldığında da bu kural geçerlidir: oy veren kullanıcı
oyunu değiştirebilir, ikinci bir oy ekleyemez.

**Yayıncı kontrolü** (`ADMIN_KEY` gerekli, panelin altında):

```bash
curl -X POST http://localhost:3000/api/poll/control \
  -H "x-admin-key: $ADMIN_KEY" -H "Content-Type: application/json" \
  -d '{"action":"open"}'    # aç (yayın sırasında da açık tut)
  -d '{"action":"close"}'   # elle kapat
  -d '{"action":"auto"}'    # otomatik moda dön
```

---

## 🚀 Yerelde Çalıştırma

```bash
npm install
cp .env.example .env      # Windows: copy .env.example .env
# .env içine MONGODB_URI (gerçek şifre ile) ve VOTE_SECRET yaz
npm run db:check          # MongoDB bağlantısını doğrula
npm run dev               # http://localhost:3000
```

Production build'ini `.env` ile çalıştırmak için:

```bash
npm run build
npm start                 # node --env-file=.env .output/server/index.mjs
```

> ⚠️ `.env` yoksa veya MongoDB'ye bağlanılamazsa panel `🧪 TEST MODU` ile açılır:
> veriler **RAM'de** tutulur, sayfa kapanınca silinir. Site çökmez, sadece oylar kalıcı olmaz.

### Logoyu değiştir

Logolar **otomatik olarak Kick'ten çekilir** (kanalın profil fotoğrafı). Kick erişilemezse
`public/logo.svg` yer tutucusu kullanılır. Kendi logonu kullanmak istersen
`public/logo.svg` dosyasını değiştirmen yeterli.

---

## 🎛️ Yayıncı Kontrolü (gizli sayfa)

Ana sayfada **hiçbir iz yok**. Kontrol paneli ayrı sayfada ve anahtar ister:

**`/admin`** → `ADMIN_KEY` (env'de) ile giriş → oturum httpOnly cookie ile 7 gün açık kalır.

Komutlar (curl ile de olur):

```bash
curl -X POST http://localhost:3000/api/poll/control \
  -H "x-admin-key: $ADMIN_KEY" -H "Content-Type: application/json" \
  -d '{"action":"open"}'    # aç (yayın sırasında da açık tut)
  -d '{"action":"close"}'   # elle kapat
  -d '{"action":"auto"}'    # otomatik moda dön
```

---

## 📊 Topluluk Skoru, Trend ve Seri

**Bu bir bahis etkinliği değil** — bu yüzden "oran/odds" gösterilmez. Onun yerine
topluluğun durumunu anlamlı kılan üç şey var:

**1. Topluluk Skoru (0-100)**

```
oran  = evet / (evet + hayır)              // 0-1
hacim = min(1, oySayısı / 25)              // 25 oyda tam hacim
skor  = 50 + (oran×100 − 50) × (0.45 + 0.55 × hacim)
```

Skor asla oranla **çelişmez** — sadece eminlik düzeyini yansıtır. Az oyda 50'ye
(kararsıza) çekilir, çok oyda ham orana yaklaşır. 7 oyda %71 EVET ise skor ~63 olur
("hafif EVET lehinde"), 25+ oyda tam olarak %71 olur.

Etiketler: *Topluluk EVET konusunda çok net* → *Topluluk EVET lehinde eğilimli* →
*Topluluk tam bölünmüş* → *Topluluk HAYIR lehinde eğilimli*.

**2. Gün içi beklenti eğrisi**

`poll` durumu her senkronizasyonda `snapshots` koleksiyonuna yazılır (10 dakikada bir
veya oran %2 değişince). Panelde SVG eğri olarak gösterilir: topluluk gün boyunca
ısınıyor mu, soğuyor mu?

**3. Gün serisi**

Bugünden geriye doğru ağırlıklı sonucun aynı olduğu kesintisiz gün sayısı:
"3 gündür EVET lehinde 🔥".

> 💡 **Puan/para birimi neden yok?** Harcanabilir bir puanın anlamlı olması için
> ödül döngüsü gerekir (çekiliş bileti, hediye, özel yayın erişimi…). Aksi hâlde
> puan boş bir sayaftan ibaret kalır. Böyle bir sistem istersen (günlük oy → bilet,
> haftalık çekiliş, kazananı yönetici belirler) ayrıca tasarlanabilir.

---

## ☁️ Ücretsiz Yayına Alma (Vercel/Netlify olmadan)

Vercel ve Netlify dolu olduğu için **ücretsiz alternatifler**:

| Platform | Ücretsiz mi? | Uyku | Notlar |
|---|---|---|---|
| **Northflank** (Sandbox) | ✅ 2 ücretsiz servis + 2 cron | **Hiç uyumaz** (always-on) | ⭐ En iyi seçim: yayın sırasında kesintisiz |
| **Render** (Hobby) | ✅ ücretsiz compute (512MB) + ücretsiz cron | 15 dk hareketsizlikte uyur | `render.yaml` hazır, keep-alive cron ekledim |
| **Google Cloud Run** | ✅ daima ücretsiz kota | 0'a ölçeklenir | Dockerfile hazır, kart ister |
| **Oracle Cloud Always Free** | ✅ 2 VM, 24/7 | Hiç uyumaz | En güvenilir ama kurulum uğraştırır |
| ~~Koyeb~~ | ❌ artık ücretli | — | Mistral AI'ye katıldı |
| ~~Fly.io~~ | ❌ yeni hesaplarda ücretsiz plan yok | — | En ucuz daima-açık: $2,19/ay |

### ⭐ Önerim: Northflank Sandbox

1. [northflank.com](https://northflank.com) → ücretsiz hesap (kart gerekmez)
2. **Create Service** → Dockerfile seç → repo: GitHub
   - Build: Dockerfile (proje kökünde hazır)
   - Port: `3000`
   - Health check: `/api/poll/current`
3. **Environment Variables** (servis ayarlarından):

```
MONGODB_URI = mongodb+srv://dayico:dayico3322@cluster0.uca3vs1.mongodb.net/?retryWrites=true&w=majority
MONGODB_DB  = swaggybark
VOTE_SECRET = <openssl rand -hex 32>
ADMIN_KEY   = <rastgele 24 karakter>
KICK_CHANNEL = swaggybark
KICK_UA     = swaggybark-panel/1.0
```

4. Deploy otomatik başlar. `https://< servis-adı>.code.run` adresi hazır.

> **Neden Northflank?** Ücretsiz planda **hiç uyumaz** (always-on) → yayın başlarken site
> donmaz, soğuk başlangıç olmaz. Render'da 15 dk sonra uykuya dalıyor (soğuk başlangıç ~1 dk).

### Alternatif: Render (render.yaml hazır)

1. Repo'yu GitHub'a push'la
2. [dashboard.render.com](https://dashboard.render.com) → **New → Blueprint** → repo'yu seç
   (render.yaml otomatik okunur)
3. `MONGODB_URI` ve `ADMIN_KEY` değerlerini gir → Deploy

`render.yaml` içinde **keep-alive cron** var: 5 dakikada bir siteyi ping'ler, böylece
uykuya dalma olmaz.

### Alternatif: Docker (Cloud Run / Oracle / Fly / Railway)

```bash
docker build -t swaggybark .
docker run -p 3000:3000 --env-file .env swaggybark
```

---

## ⚡ Anlık Güncelleme (SSE) ve +1 Animasyonları

**Soru:** "Birçok kişi aynı anda oy verirse ekran anında değişir mi?"
**Cevap:** Evet — Server-Sent Events (SSE) ile **oy verildiği anda** (~0,5 sn) tüm ekranlara
ulaşır. Yoklama (30 sn) sadece yedek yoldur.

```
Bir kullanıcı oy verir
   → POST /api/poll/vote
   → MongoDB'ye yazılır
   → sunucu olayı yayar (server/utils/bus.ts)
   → SSE (/api/stream) üzerinden HER ekrana gider
   → o tarafta yeşil ✅+1 (EVET) veya kırmızı ❌+1 (HAYIR) uçup yükselerek kaybolur
   → yüzde, sayaçlar ve gauge anında güncellenir
```

**Kod parçaları:**
- `server/api/stream.get.ts` → SSE ucu (ilk durum + canlı olaylar + 20 sn ping)
- `server/utils/bus.ts` → sunucu içi olay veriyolu
- `composables/useLiveUpdates.ts` → istemci SSE bağlantısı (otomatik yeniden bağlanır)
- `composables/useVoteFloats.ts` → uçuşan +1 listesi (en fazla 16 aynı anda)
- `components/VoteFloats.vue` → animasyon (EVET sol taraf / HAYIR sağ taraf)

**Test:**
```bash
npm run test:sse      # SSE'yi bağlanır, oy atar, gecikmeyi ölçer
```

> Not: Sunucusuz (serverless) ortamda her instance kendi olay veriyolunu taşır.
> Bu yüzden **yoklama 30 saniyede bir çalışmaya devam eder** — SSE kapalı olsa bile
> veriler 30 sn'de bir tazelenir. Yerel/kalıcı sunucuda (Northflank, Oracle, kendi
> VPS'in) SSE tam anlık çalışır.

---

| Yöntem | Yol | Açıklama |
|---|---|---|
| `GET` | `/api/poll/current` | Bugünkü oylama + Kick canlı durumu (`live`, `streamOk`, `streamTitle`, `question`, `trend`, `nextReset`) |
| `POST` | `/api/poll/vote` | `{ choice: "yes"\|"no" }` — günde 1 oy (seçim değiştirilebilir) |
| `GET` | `/api/poll/history` | Bitmiş günlerin arşivi |
| `POST` | `/api/poll/control` | Yayıncı kontrolü: `{ action: "open"\|"close"\|"auto" }` (header: `x-admin-key`) |
| `POST` | `/api/poll/question` | Soruyu değiştir: `{ question: "..." }` (header: `x-admin-key`) |
| `GET` | `/api/stream` | **SSE** — anlık oy/olay akışı |
| `POST` | `/api/poll/slot` | Yan reklam alanı: `{ side: "left"\|"right", config: {...} }` |

---

## 🖼️ Yan Reklam Alanları (boyutlandırılabilir)

Panelin **sol ve sağ boşluklarına** reklam / GIF / fotoğraf koyabilirsin. Yönetim tamamen
`/admin` panelinden:

| Ayar | Açıklama |
|---|---|
| Açık / Kapalı | Alanın görünürlüğü |
| Görsel / GIF adresi | Herhangi bir URL (`.gif` de olur) |
| Tıklanınca açılacak adres | Reklam için sponsor linki (`target="_blank"`) |
| Alt metin / ipucu | Görsele hover'da çıkan yazı |
| **Genişlik** | 140–520 px arası kaydırıcı |
| **Köşe yuvarlaklığı** | 0–48 px kaydırıcı |
| **Opaklık** | %20–%100 kaydırıcı |

- **1120px altındaki ekranlarda otomatik gizlenir** (panel tek kolona düşer)
- Aynı alanlar **OBS overlay'ında** da görünür → yayın ekranında sponsor logosu
- Görseller dışarıdan (CDN) yüklenir, sunucuya dosya yüklenmez
- Ayarlar MongoDB'de `settings` koleksiyonunda saklanır

---

## 🔎 Yayın Algılama Notları (önemli)

Kick'in edge ağı, **sahte tarayıcı User-Agent'ları** (Chrome/Safari + `sec-ch-ua` + `Referer`)
ile datacenter IP'lerinden gelen istekleri `403 Request blocked by security policy` ile reddediyor.
Bu yüzden `server/utils/kick.ts` bilerek tarayıcı taklidi **yapmıyor**; nötr bir UA kullanıyor:

```
User-Agent: swaggybark-panel/1.0
```

Bu UA ile istekler istikrarlı `200` dönüyor. `npm run probe:kick` ile doğrulayabilirsin.
UA'yı değiştirmek istersen: `KICK_UA` ortam değişkeni.

**Güvenlik davranışı:** Kick kontrolü hata verirse (`streamOk: false`) oylama **kapatılmaz**,
sadece panelde "⚠️ YAYIN DURUMU ALINAMANI" uyarısı çıkar. Yani geçici bir Kick engelinde
oylar boşa gitmez.

---

## 🧪 Testler

```bash
npm test              # 11 gün sınır durumu + 11 durum makinesi senaryosu
npm run test:day      # gece 03:00 sınır durumları
npm run test:state    # yayın ⇄ oylama durum makinesi (11 senaryo)
npm run probe:kick    # Kick API erişimini canlı test eder
npm run db:check      # MongoDB bağlantı testi
npm run db:dump       # MongoDB'deki oylama dokümanlarını göster
npm run db:clean      # test verilerini temizle (--all: hepsi)
npm run simulate:votes # farklı kullanıcıları simüle eder (trend testi için)
```

---

## 🔐 Güvenlik Notları

- **Ham IP asla saklanmaz.** Oy verenin kimliği = IP'nin `VOTE_SECRET` ile HMAC-SHA256 özeti
  (ilk 32 karakter). Gizli tutulması gereken tek şey `VOTE_SECRET` ve `ADMIN_KEY`.
- **`.env` dosyası `.gitignore`'da** — asla commit etme.
- Şifreler sohbet/ekran görüntüsü üzerinden paylaşıldıysa **Atlas'tan rotasyon yapmak** (şifre
  değiştir → `.env`'i güncelle → `npm run db:check`) en iyisi.

---

## 🧱 Mimari

```
app.vue                     → Nuxt sarmalayıcı
pages/index.vue             → ana panel (Beklenti → Oylama → Sonuçlar → Geçmiş)
pages/overlay.vue           → OBS overlay'ı (/overlay — kocaman soru + dev butonlar)
pages/admin.vue             → gizli yayıncı kontrol sayfası (/admin)
assets/css/main.css         → global tema
shared/utils/day.ts         → TSİ 03:00 bazlı gün anahtarı (istemci + sunucu ortak)
server/utils/db.ts          → mongoose (polls, snapshots, settings) + belleğe düşüş
server/utils/poll-service.ts→ oylama servisi + trend kaydı
server/utils/poll-state.ts  → yayın ⇄ oylama durum makinesi
composables/useLiveUpdates.ts → SSE bağlantısı (anlık güncelleme)
composables/useVoteFloats.ts  → uçuşan +1 listesi
components/VoteFloats.vue     → +1 animasyonu (yeşil EVET / kırmızı HAYIR)
server/utils/bus.ts           → sunucu içi olay veriyolu
server/api/stream.get.ts      → SSE ucu
server/utils/settings.ts    → soru metni ayarları
server/utils/kick.ts        → Kick canlı kontrolü (30 sn önbellekli)
server/utils/kick-channel.ts→ kanal avatarı/istatistikleri (30 dk önbellekli)
server/utils/hash.ts        → IP → HMAC özeti (oy kimliği)
server/api/poll/*.ts        → API uçları
server/api/admin/*.ts       → admin oturumu (çerez)
public/logo.svg             → yedek logo (Kick'ten çekilemezse)
Dockerfile / render.yaml    → deploy dosyaları (Northflank, Render, Cloud Run, Oracle)
```

---

## 🖥️ OBS Overlay Kullanımı

1. OBS → Kaynaklar → **Tarayıcı** → `https://<site-adresin>/overlay`
2. Genişlik `1920`, Yükseklik `1080`
3. "Yerel dosya" seçme, URL gir
4. Panelden oy verildikçe overlay otomatik güncellenir (10 sn'de bir)

Overlay'da: kocaman parlak soru, dev EVET/HAYIR butonları, yüzde, oy sayıları ve
sonuç barı. Yayın başlayınca butonlar pasif görünür ama "Oylama kapalı" yazısı belirir.

Soru metnini `/admin` → "Oylama Sorusu" bölümünden istediğin an değiştirebilirsin.

Oy değiştirme desteği: kullanıcı gün içinde seçimini değiştirirse eski oyu düşülüp
yenisine eklenir (toplam oy sayısı değişmez).
