# 🚀 Deploy Rehberi — Swaggybark Beklenti Paneli

Repo: **https://github.com/ziyamertc/swaggywatch** (branch: `main`)

> 💳 **Kart isteyen platformlar:** Northflank, Fly.io, Railway, Google Cloud Run, Oracle Cloud —
> hepsi önce ödeme yöntemi istiyor. Aşağıdaki iki seçenek **kart gerektirmez**.

---

## 🥇 Seçenek 1: Render (kart GEREKMEZ — önerilen)

Render'ın Hobby (ücretsiz) planı **kredi kartı istemiyor**. `render.yaml` hazır, 5 dakikada kurulur.

### Adımlar

1. **https://dashboard.render.com/register** → GitHub ile ücretsiz hesap aç
2. **New → Blueprint** → repo'yu seç (`ziyamertc/swaggywatch`)
   - `render.yaml` otomatik okunur, servis adı **`swaggybark-panel`** olmalı
     (keep-alive cron'u bu adrese ping atıyor)
3. Render **2 şey ister**:
   - `MONGODB_URI` → `mongodb+srv://<kullanıcı>:<şifre>@cluster0.<cluster>.mongodb.net/?retryWrites=true&w=majority`
   - `ADMIN_KEY` → kendi belirlediğin anahtar
   - `VOTE_SECRET` → Render otomatik üretir (`generateValue: true`)
4. **Apply** → Build → Deploy → `https://swaggybark-panel.onrender.com` 🎉

### Render'ın tek kısıtı

Ücretsiz servis **15 dakika trafik gelmezse uykuya dalar** (soğuk başlangıç ~1 dk).
`render.yaml` içindeki **keep-alive cron** 5 dakikada bir ping atarak bunu engeller ✅

Ayrıca Render'da **SSE (anlık güncelleme) desteklenir** — açık bağlantı trafik sayılır.

---

## 🥈 Seçenek 2: Kendi bilgisayarın + Cloudflare Tunnel (kart GEREKMEZ, hiç uyumaz)

Yayın yaptığın bilgisayar zaten açık → site oradan çalışsın, dışarıya **Cloudflare Tunnel**
ile açılsın. Ücretsiz Cloudflare hesabı **kart istemiyor**.

### Kurulum

```powershell
winget install --id Cloudflare.cloudflared
```

### Çalıştırma (PowerShell)

```powershell
cd "C:\Users\ziqxc\OneDrive\Documents\Varsayılan Proje\swaggybark-panel"

# 1) Sunucuyu başlat
npm run build
npm start

# 2) Başka bir terminalde tüneli aç (kart, hesap gerekmez — hızlı tünel)
cloudflared tunnel --url http://localhost:3000
```

Çıkan `https://xxx-xxx-xxx.trycloudflare.com` adresi panelin adresi olur.

> ⚠️ **Hızlı tünel** (trycloudflare.com) **SSE desteklemez** ve adres her açılışta değişir.
> Sabit adres + SSE için **ücretsiz Cloudflare hesabı** ile *named tunnel* kur:
>
> ```powershell
> cloudflared tunnel login
> cloudflared tunnel create swaggywatch
> cloudflared tunnel route dns swaggywatch panel.senin-domainin.com
> ```
> Sonra `cloudflared tunnel run swaggywatch` ile sabit adresle çalışır, SSE de çalışır.

### Avantaj / dezavantaj

| | |
|---|---|
| ✅ | Kart yok, uyku yok, anlık (SSE tam çalışır), hızlı kurulum |
| ⚠️ | Bilgisayarın açık olmalı (yayın sırasında zaten açık) |
| ⚠️ | Hızlı tünelde adres her seferinde değişir → OBS'ta güncellemek gerekir |

---

## 🥉 Seçenek 3: Kart gerektirenler (opsiyonel)

| Platform | Notlar |
|---|---|
| **Northflank Sandbox** | Ücretsiz ama **kart istiyor**; uyumaz (always-on) |
| **Google Cloud Run** | Ücretsiz kota, **kart istiyor**, Dockerfile hazır |
| **Oracle Cloud Always Free** | 2 VM, 24/7, **kart istiyor** |
| **Docker** | `docker build -t swaggybark .` → herhangi bir sunucuya |

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
