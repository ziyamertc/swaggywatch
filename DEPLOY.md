# 🚀 Deploy Rehberi — Swaggybark Beklenti Paneli

Repo: **https://github.com/ziyamertc/swaggywatch** (branch: `main`)

---

## ⭐ Seçenek 1: Northflank Sandbox (ÖNERİLEN)

**Neden?** Ücretsiz planda **hiç uyumaz** (always-on) → yayın başlarken site donmaz.
Kart gerekmez.

### Adımlar

1. **Kayıt ol** → https://northflank.com/signup (ücretsiz, kart gerekmez)
2. **Create Service** → **Dockerfile** seç → **GitHub** → repo: `ziyamertc/swaggywatch`
   - Dockerfile yolu: `/Dockerfile` (varsayılan, dokunma)
   - **Port**: `3000`
   - **Health check path**: `/api/poll/current`
   - Instance: `nf-compute-10` (ücretsiz kapsam)
3. **Environment Variables** ekle:

```
MONGODB_URI   = mongodb+srv://USER:PASSWORD@cluster0.CLUSTER.mongodb.net/?retryWrites=true&w=majority
MONGODB_DB    = swaggybark
VOTE_SECRET   = <openssl rand -hex 32  →  64 karakter>
ADMIN_KEY     = <24+ karakter rastgele>
KICK_CHANNEL  = swaggybark
KICK_UA       = swaggybark-panel/1.0
```

4. **Deploy** → birkaç dakika → `https://<servis-adı>.code.run` hazır 🎉
5. **Custom domain** eklemek istersen: Service → Domains → kendi domainini ekle (SSL otomatik)

### Vite'r iki değeri nasıl üretirsin?

```bash
openssl rand -hex 32     # VOTE_SECRET
openssl rand -hex 24     # ADMIN_KEY
```
(PowerShell: `[guid]::NewGuid().ToString("N") + [guid]::NewGuid().ToString("N")`)

---

## 🥈 Seçenek 2: Render (Hobby — ücretsiz)

1. Repo zaten GitHub'da ✓
2. https://dashboard.render.com → **New → Blueprint** → repo'yu seç
   (`render.yaml` otomatik okunur, `MONGODB_URI` ve `ADMIN_KEY` ister)
3. Deploy → `https://swaggybark-panel.onrender.com`

> ⚠️ Render ücretsiz planı **15 dk hareketsizlikte uykuya dalar** (soğuk başlangıç ~1 dk).
> `render.yaml` içindeki **keep-alive cron** 5 dakikada bir ping atarak bunu engeller.

---

## 🥉 Seçenek 3: Docker (Cloud Run / Oracle / kendi VPS)

```bash
git clone https://github.com/ziyamertc/swaggywatch.git
cd swaggywatch
cp .env.example .env       # değerleri doldur
docker build -t swaggybark .
docker run -d -p 3000:3000 --env-file .env --name swaggybark swaggybark
```

---

## ✅ Deploy sonrası kontrol listesi

| Kontrol | Nasıl |
|---|---|
| Site açılıyor | `https://siteadresi/` |
| DB bağlı | Sayfada "🧪 TEST MODU" uyarısı **OLMAMALI** |
| Kick algılama | Sağ üstte "📺 YAYINDA" / "💀 OFFLINE" |
| Soru görünüyor | Kocaman yeşil "Dayı bugün yayın açacak mı?" |
| Oylama çalışıyor | EVET/HAYIR'a bas → sayaçlar + `+1` animasyonu |
| Anlık güncelleme | İki sekme aç → birinde oy ver → diğeri anında güncellenmeli |
| Admin paneli | `/admin` → `ADMIN_KEY` ile giriş |
| OBS overlay | `/overlay` → 1920×1080 |
| Yayın kapanması | Yayın açınca oylama otomatik kilitlenmeli |
| Gece sıfırlama | 03:00 TSİ'de yeni gün açılmalı |

---

## 🔁 Yeni sürüm yayınlama

```bash
git add -A
git commit -m "mesaj"
git push
```
→ Northflank/Render otomatik yeniden deploy eder (Dockerfile build + push).

---

## 🔐 Güvenlik kontrol listesi

- [ ] `.env` dosyası repoda **yok** (`.gitignore`'da ✓) — sızdıysa **şifreyi değiştir**
- [ ] `VOTE_SECRET` ve `ADMIN_KEY` üretildi ve **farklı** değerler
- [ ] MongoDB Atlas → Network Access → `0.0.0.0/0` (Vercel/Netlify/Render IP'leri
      sürekli değiştiği için) veya servis IP'sine daralt
- [ ] `/admin` sayfasının adresi gizli tutulsun (ana sayfada hiçbir iz yok)
