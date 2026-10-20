<template>
  <div class="wrap wrap-admin">
    <header class="main-header">
      <div class="brand">
        <div class="logo-slot small">
          <img v-if="avatar" :src="avatar" alt="Kanal logosu" @error="avatar = null">
          <span v-else class="logo-fallback">🎛</span>
        </div>
        <div class="brand-info">
          <h1>YAYINCI <span>KONTROLÜ</span></h1>
          <div class="subtitle">Bu sayfa sadece kanal sahibine</div>
        </div>
      </div>
      <div class="status-strip">
        <NuxtLink to="/" class="pill pill-ghost">← Panele dön</NuxtLink>
        <button class="pill pill-ghost" @click="allOpen = !allOpen">{{ allOpen ? '▲ Hepsini kapat' : '▼ Hepsini aç' }}</button>
      </div>
    </header>

    <!-- giriş -->
    <section v-if="!authed" class="panel">
      <div class="panel-title"><span>🔐 Yetkilendirme</span></div>
      <div class="admin-row">
        <input v-model="keyInput" type="password" class="admin-input" placeholder="ADMIN_KEY" @keyup.enter="login">
        <button class="ghost" @click="login">Giriş</button>
      </div>
      <div v-if="msg" class="vote-note" style="text-align:left" v-html="msg"></div>
    </section>

    <!-- kontrol paneli -->
    <template v-else>
      <!-- OYLAMA DURUMU -->
      <AdminSection title="📺 Oylama Durumu" :sub="pollStatusText" :open="sec.durum" @update:open="v => sec.durum = v">
        <div class="stat-row" style="margin-bottom:16px">
          <span class="yes-c">✅ EVET — {{ poll?.yes ?? 0 }}</span>
          <span class="no-c">❌ HAYIR — {{ poll?.no ?? 0 }}</span>
        </div>
        <div class="admin-row">
          <button class="ghost btn-ok" @click="control('open')">🟢 Aç</button>
          <button class="ghost btn-warn" @click="control('close')">⏸ Kapat</button>
          <button class="ghost" @click="control('auto')">🤖 Otomatik</button>
          <button class="ghost btn-danger" @click="logout">🚪 Çıkış</button>
        </div>
        <div v-if="msg" class="vote-note" style="text-align:left" v-html="msg"></div>
      </AdminSection>

      <!-- OYLAMA SORUSU -->
      <AdminSection title="❓ Oylama Sorusu" sub="panelde ve overlay'da görünür" :open="sec.soru" @update:open="v => sec.soru = v">
        <input v-model="questionInput" class="admin-input" maxlength="160" placeholder="Dayı bugün yayın açacak mı?" @keyup.enter="saveQuestion">
        <div class="admin-row" style="margin-top:10px">
          <button class="ghost btn-ok" @click="saveQuestion">💾 Soruyu Kaydet</button>
        </div>
        <div v-if="questionMsg" class="vote-note" style="text-align:left" v-html="questionMsg"></div>
      </AdminSection>

      <!-- OYLAMA LOGU -->
      <AdminSection title="📋 Oylama Logu" :sub="logStats ? `${logStats.toplam} kayıt • ${logStats.benzersizIp} IP` : 'IP, tarayıcı, saat'" :open="sec.log" @update:open="v => sec.log = v">
        <div class="log-stats" v-if="logStats">
          <div class="log-stat"><b>{{ logStats.toplam }}</b><span>toplam kayıt</span></div>
          <div class="log-stat"><b>{{ logStats.benzersizIp }}</b><span>benzersiz IP</span></div>
          <div class="log-stat c-yes"><b>{{ logStats.yes }}</b><span>EVET</span></div>
          <div class="log-stat c-no"><b>{{ logStats.no }}</b><span>HAYIR</span></div>
          <div class="log-stat">
            <b>{{ logStats.tarayici[0]?.ad || '—' }}<small v-if="logStats.tarayici[0]">{{ logStats.tarayici[0].adet }}</small></b>
            <span>en çok tarayıcı</span>
          </div>
          <div class="log-stat">
            <b>{{ logStats.cihaz[0]?.ad || '—' }}<small v-if="logStats.cihaz[0]">{{ logStats.cihaz[0].adet }}</small></b>
            <span>en çok cihaz</span>
          </div>
        </div>

        <div class="log-filter">
          <button class="ghost btn-sm" :class="{ active: logScope === 'today' }" @click="setLogScope('today')">📅 Bugün</button>
          <button class="ghost btn-sm" :class="{ active: logScope === 'all' }" @click="setLogScope('all')">🗂️ Tüm günler</button>
          <button class="ghost btn-sm" @click="loadLog()">🔄 Yenile</button>
          <button class="ghost btn-sm btn-danger" @click="clearLog()">🗑 Temizle</button>
          <span class="log-count" v-if="logEntries.length">{{ logEntries.length }} kayıt</span>
        </div>

        <div v-if="logMsg" class="vote-note" style="text-align:left" v-html="logMsg"></div>

        <div class="log-table-wrap">
          <table class="hist-table log-table">
            <thead>
              <tr>
                <th>Saat</th><th>IP</th><th>Tarayıcı</th><th>Sistem</th><th>Cihaz</th><th>Oy</th><th>İşlem</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="!logEntries.length">
                <td colspan="7" class="hist-empty">Henüz log kaydı yok. Oylar geldikçe burada görünecek.</td>
              </tr>
              <tr v-for="e in logEntries" :key="e.id">
                <td class="log-time">{{ formatTime(e.at) }}</td>
                <td class="log-ip">{{ e.ip }}</td>
                <td>{{ e.browser }}</td>
                <td>{{ e.os }}</td>
                <td>{{ e.device }}</td>
                <td><b :class="e.choice === 'yes' ? 'c-yes' : 'c-no'">{{ e.choice === 'yes' ? '✅ EVET' : '❌ HAYIR' }}</b></td>
                <td class="log-action">{{ e.action === 'added' ? 'yeni oy' : 'değiştirdi' }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="log-note">
          ⚠️ IP adresleri kişisel veridir. "Temizle" ile kalıcı olarak silinebilir.
          Bu bölüm yalnızca <b>ADMIN_KEY</b> erişimi olanlara görünür.
        </div>
      </AdminSection>

      <!-- GELİŞTİRİCİ İMZASI -->
      <AdminSection title="✍️ Geliştirici İmzası" sub="sayfanın en altı" :open="sec.imza" @update:open="v => sec.imza = v">
        <div class="slot-fields">
          <label>
            <span>Ön ek (düz yazı)</span>
            <input v-model="credit.label" class="admin-input" maxlength="40" placeholder="Developed by">
          </label>
          <label>
            <span>Nickname (parlak yazılır)</span>
            <input v-model="credit.name" class="admin-input" maxlength="40" placeholder="zmchampion">
          </label>
          <label>
            <span>Tıklanınca gidilecek link</span>
            <input v-model="credit.url" class="admin-input" maxlength="500" placeholder="https://guns.lol/zmchampion">
          </label>
        </div>

        <label class="switch" style="margin-top:12px">
          <input v-model="credit.visible" type="checkbox">
          <span>İmzayı göster</span>
        </label>

        <!-- canlı önizleme -->
        <div class="credit-preview">
          <span class="dev-line"></span>
          <span class="dev-link-preview">
            <span class="dev-prefix-preview">{{ credit.label || 'Developed by' }}</span>
            <span class="dev-name-preview">{{ credit.name || 'nickname' }}</span>
            <span class="dev-arrow-preview">↗</span>
          </span>
        </div>

        <button class="ghost btn-ok" style="width:100%;margin-top:12px" @click="saveCredit">💾 İmzayı Kaydet</button>
        <div v-if="creditMsg" class="vote-note" style="text-align:left" v-html="creditMsg"></div>
      </AdminSection>

      <!-- OYLARI YÖNET -->
      <AdminSection title="🧹 Oyları Yönet" :sub="`bugün ${poll?.yes ?? 0} EVET / ${poll?.no ?? 0} HAYIR`" :open="sec.oylar" @update:open="v => sec.oylar = v">
        <div class="admin-row">
          <button class="ghost btn-warn" @click="clearVotes('today')">🧹 Bugünün oylarını sıfırla</button>
          <button class="ghost btn-danger" @click="clearVotes('all')">💥 Tüm oyları sil</button>
        </div>
        <div class="log-note" style="margin-top:10px">
          <b>Bugünün oylarını sıfırla</b> → sayaçları 0'a alır, oy kayıtlarını ve trend
          noktalarını siler; gün satırı arşivde kalır.<br>
          <b>Tüm oyları sil</b> → bütün günlerin oyları, log ve trend kalıcı olarak yok edilir.
        </div>
        <div v-if="votesMsg" class="vote-note" style="text-align:left" v-html="votesMsg"></div>
      </AdminSection>

      <!-- YAN REKLAM ALANLARI -->
      <AdminSection title="🖼️ Yan Reklam Alanları" sub="sol / sağ boşluk" :open="sec.reklam" @update:open="v => sec.reklam = v">
        <div v-for="s in (['left', 'right'] as const)" :key="s" class="slot-editor">
          <div class="slot-editor-head">
            <b>{{ s === 'left' ? '⬅️ SOL ALAN' : 'SAĞ ALAN ➡️' }}</b>
            <label class="switch">
              <input v-model="slot[s].enabled" type="checkbox">
              <span>{{ slot[s].enabled ? 'AÇIK' : 'KAPALI' }}</span>
            </label>
          </div>

          <div class="slot-fields">
            <label>
              <span>Görsel / GIF adresi</span>
              <input v-model="slot[s].url" class="admin-input" placeholder="https://... (veya .gif)">
            </label>
            <label>
              <span>Tıklanınca açılacak adres (reklam)</span>
              <input v-model="slot[s].link" class="admin-input" placeholder="https://sponsor.com">
            </label>
            <label>
              <span>Alt metin / ipucu</span>
              <input v-model="slot[s].title" class="admin-input" maxlength="120" placeholder="Sponsor logosu">
            </label>

            <label class="range-row">
              <span>Genişlik: <b>{{ slot[s].width }}px</b></span>
              <input v-model.number="slot[s].width" type="range" min="140" max="520" step="10">
            </label>
            <label class="range-row">
              <span>Köşe yuvarlaklığı: <b>{{ slot[s].radius }}px</b></span>
              <input v-model.number="slot[s].radius" type="range" min="0" max="48" step="2">
            </label>
            <label class="range-row">
              <span>Opaklık: <b>%{{ Math.round(slot[s].opacity * 100) }}</b></span>
              <input v-model.number="slot[s].opacity" type="range" min="0.2" max="1" step="0.05">
            </label>
          </div>

          <div v-if="slot[s].url" class="slot-preview">
            <img :src="slot[s].url" :alt="slot[s].title">
          </div>

          <button class="ghost btn-ok" @click="saveSlot(s)">💾 {{ s === 'left' ? 'Sol' : 'Sağ' }} Alanı Kaydet</button>
        </div>

        <div v-if="slotMsg" class="vote-note" style="text-align:left" v-html="slotMsg"></div>
      </AdminSection>

      <!-- YAYIN DURUMU -->
      <AdminSection title="📺 Yayın Durumu" :sub="live ? 'YAYINDA' : 'OFFLINE'" :open="sec.yayin" @update:open="v => sec.yayin = v">
        <div class="kv">
          <div><span>Kanal</span><b>{{ channelName }}</b></div>
          <div><span>Yayın</span><b>{{ streamTitle || 'yayın yok' }}</b></div>
          <div><span>Gün</span><b>{{ todayKey }}</b></div>
          <div><span>Veritabanı</span><b>{{ store }}</b></div>
        </div>
        <button class="ghost" style="margin-top:14px" @click="refresh">🔄 Yenile</button>
      </AdminSection>
    </template>

    <DeveloperCredit
      :label="credit.label"
      :name="credit.name"
      :url="credit.url"
      :visible="credit.visible !== false"
    />
  </div>
</template>

<script setup lang="ts">
const keyInput = ref('')
const authed = ref(false)
const msg = ref('')
const questionInput = ref('')
const questionMsg = ref('')
const slotMsg = ref('')
const logMsg = ref('')
const logEntries = ref<any[]>([])
const logStats = ref<any>(null)
const logScope = ref<'today' | 'all'>('today')
const votesMsg = ref('')
const avatar = ref<string | null>(null)

/* Bölümlerin açık/kapalı durumu */
const sec = reactive({ durum: true, soru: true, log: false, oylar: false, imza: false, reklam: false, yayin: false })
const allOpen = ref(false)
watch(allOpen, (v) => {
  Object.keys(sec).forEach((k) => { (sec as any)[k] = v })
})

const slot = reactive({
  left: { enabled: false, url: '', link: '', title: '', width: 260, radius: 16, opacity: 1 },
  right: { enabled: false, url: '', link: '', title: '', width: 260, radius: 16, opacity: 1 }
})
const credit = reactive({ visible: true, label: 'Developed by', name: 'zmchampion', url: 'https://guns.lol/zmchampion' })
const creditMsg = ref('')

const poll = ref<any>(null)
const live = ref(false)
const streamTitle = ref<string | null>(null)
const todayKey = ref('')
const store = ref('')
const channelName = ref('SWAGGYBARK')
// Tarayıcı sekmesi ikonu = kanal logosu
useFavicon(computed(() => avatar.value))

const pollStatusText = computed(() => {
  const s = poll.value?.status
  if (s === 'active') return '🟢 OYLAMA AÇIK'
  if (s === 'closed_stream') return '🔴 YAYIN NEDENİYLE KAPALI'
  if (s === 'closed_manual') return '⏸ YAYINCI KAPATTI'
  if (s === 'ended_day') return '📦 GÜN DOLDU'
  return '—'
})

async function loadLog() {
  if (!todayKey.value) {
    try {
      const cur: any = await $fetch('/api/poll/current')
      todayKey.value = cur.todayKey || ''
    } catch { /* yoksay */ }
  }
  try {
    const res: any = await $fetch('/api/poll/log', {
      headers: { 'x-admin-key': keyInput.value.trim() },
      query: logScope.value === 'today' && todayKey.value ? { day: todayKey.value } : {}
    })
    logEntries.value = res.entries || []
    logStats.value = res.stats || null
    logMsg.value = ''
  } catch (err: any) {
    logMsg.value = `❌ ${err?.data?.statusMessage || 'Log alınamadı'}`
  }
}

function setLogScope(scope: 'today' | 'all') {
  logScope.value = scope
  loadLog()
}

async function clearLog() {
  const msg = logScope.value === 'today'
    ? 'Bugünün log kayıtları silinecek. Onaylıyor musun?'
    : 'TÜM log kayıtları (tüm günler) silinecek. Onaylıyor musun?'
  if (!confirm(msg)) return
  try {
    const res: any = await $fetch('/api/poll/log', {
      method: 'DELETE',
      headers: { 'x-admin-key': keyInput.value.trim() },
      query: logScope.value === 'today' && todayKey.value ? { day: todayKey.value } : {}
    })
    logMsg.value = `✔ ${res.deleted} kayıt silindi`
    loadLog()
  } catch (err: any) {
    logMsg.value = `❌ ${err?.data?.statusMessage || 'Silinemedi'}`
  }
}

async function saveCredit() {
  try {
    const res = await $fetch<any>('/api/poll/credit', {
      method: 'POST',
      headers: { 'x-admin-key': keyInput.value.trim() },
      body: { visible: credit.visible, label: credit.label, name: credit.name, url: credit.url }
    })
    if (res?.credit) Object.assign(credit, res.credit)
    creditMsg.value = '✔ İmza kaydedildi — sayfanın en altında anında görünüyor.'
    refresh()
  } catch (err: any) {
    creditMsg.value = `❌ ${err?.data?.statusMessage || 'Yetkisiz / hata'}`
  }
}

async function clearVotes(scope: 'today' | 'all') {
  const soru = scope === 'today'
    ? 'Bugünün oyları sıfırlanacak (sayaçlar 0 olur, log ve trend silinir). Onaylıyor musun?'
    : 'TÜM oylar kalıcı olarak silinecek (bütün günler, log ve trend). Bu işlem geri alınamaz. Onaylıyor musun?'
  if (!confirm(soru)) return
  try {
    const res: any = await $fetch('/api/poll/votes/clear', {
      method: 'POST',
      headers: { 'x-admin-key': keyInput.value.trim() },
      body: { scope }
    })
    votesMsg.value = `✔ ${scope === 'today' ? 'Bugünün oyları sıfırlandı' : 'Tüm oylar silindi'} — ` +
      `poll: ${res.polls}, log: ${res.logs}, trend: ${res.snapshots}`
    refresh()
    loadLog()
  } catch (err: any) {
    votesMsg.value = `❌ ${err?.data?.statusMessage || 'Silinemedi'}`
  }
}

function formatTime(iso: string) {
  const d = new Date(iso)
  return d.toLocaleString('tr-TR', {
    timeZone: 'Europe/Istanbul',
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit'
  })
}

async function saveSlot(side: 'left' | 'right') {
  try {
    const res = await $fetch<any>('/api/poll/slot', {
      method: 'POST',
      headers: { 'x-admin-key': keyInput.value.trim() },
      body: { side, config: slot[side] }
    })
    if (res?.slot) Object.assign(slot[side], res.slot)
    slotMsg.value = `✔ <b>${side === 'left' ? 'Sol' : 'Sağ'}</b> alanı kaydedildi (${slot[side].width}px). Panelde görünür.`
    refresh()
  } catch (err: any) {
    slotMsg.value = `❌ ${err?.data?.statusMessage || 'Yetkisiz / hata'}`
  }
}

async function saveQuestion() {
  const q = questionInput.value.trim()
  if (!q) { questionMsg.value = '❌ Soru boş olamaz'; return }
  try {
    const res = await $fetch<any>('/api/poll/question', {
      method: 'POST',
      headers: { 'x-admin-key': keyInput.value.trim() },
      body: { question: q }
    })
    questionMsg.value = '✔ Soru güncellendi: <b>' + (res.question || q) + '</b>'
    refresh()
  } catch (err: any) {
    questionMsg.value = `❌ ${err?.data?.statusMessage || 'Yetkisiz / hata'}`
  }
}

async function refresh() {
  try {
    const res = await $fetch<any>('/api/poll/current')
    poll.value = res.poll
    live.value = res.live
    streamTitle.value = res.streamTitle
    todayKey.value = res.todayKey
    store.value = res.store
    channelName.value = res.channel?.username || 'SWAGGYBARK'
    if (res.channel?.avatar) avatar.value = res.channel.avatar
    if (!questionInput.value && res.question) questionInput.value = res.question
    if (res.slots) {
      Object.assign(slot.left, res.slots.left)
      Object.assign(slot.right, res.slots.right)
    }
    if (res.credit) Object.assign(credit, res.credit)
  } catch { /* yok */ }
  if (authed.value) loadLog()
}

async function control(action: 'open' | 'close' | 'auto') {
  try {
    const res = await $fetch<any>('/api/poll/control', { method: 'POST', body: { action } })
    const labels: Record<string, string> = {
      open: '🟢 Oylama açıldı (yayın sırasında da açık kalacak)',
      close: '⏸ Oylama kapatıldı',
      auto: '🤖 Otomatik moda dönüldü'
    }
    msg.value = '✔ ' + (labels[res.action] || 'Tamam')
    refresh()
  } catch (err: any) {
    msg.value = `❌ ${err?.data?.statusMessage || 'Yetkisiz / hata'}`
  }
}

async function login() {
  try {
    await $fetch('/api/admin/login', { method: 'POST', body: { key: keyInput.value } })
    authed.value = true
    msg.value = '✔ Giriş başarılı'
    keyInput.value = ''
    refresh()
    loadLog()
  } catch (err: any) {
    msg.value = `❌ ${err?.data?.statusMessage || 'Hata'}`
  }
}

async function logout() {
  await $fetch('/api/admin/logout', { method: 'POST' })
  authed.value = false
  msg.value = '✔ Oturum kapatıldı'
}

onMounted(() => {
  fetch('/api/poll/current').then(r => r.json()).then(res => {
    if (res?.poll) {
      poll.value = res.poll
      live.value = res.live
      todayKey.value = res.todayKey
      store.value = res.store
      channelName.value = res.channel?.username || 'SWAGGYBARK'
      if (res.channel?.avatar) avatar.value = res.channel.avatar
    }
  })
  // oturum çerezi geçerliyse doğrudan panele gir
  fetch('/api/admin/session').then(r => r.json()).then(s => {
    if (s?.authed) {
      authed.value = true
      refresh()
      loadLog()
    }
  })
})
</script>

<style scoped>
.wrap-admin{max-width:620px}
.admin-row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.admin-input{
  flex:1;min-width:180px;background:#0D120B;border:1px solid var(--border);border-radius:10px;
  color:var(--text);padding:10px 14px;font-size:13px;outline:none;font-family:'Inter',sans-serif;
}
.admin-input:focus{border-color:var(--kick-green)}
.btn-ok{color:var(--kick-green);border-color:rgba(83,252,24,.4)}
.btn-warn{color:#E8B93C;border-color:rgba(232,185,60,.4)}
.btn-danger{color:#FF8AA3;border-color:rgba(255,59,92,.35)}
.kv{display:flex;flex-direction:column;gap:8px}
.kv>div{display:flex;justify-content:space-between;gap:12px;font-size:13px;padding:8px 0;border-bottom:1px solid #1A2114}
.kv>div:last-child{border-bottom:none}
.kv span{color:var(--muted)}
.kv b{font-weight:600;max-width:60%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}

/* ---------- Log tablosu ---------- */
.log-stats{
  display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));
  gap:8px;margin-bottom:14px;
}
.log-stat{
  background:#0D120B;border:1px solid var(--border);border-radius:10px;
  padding:10px 12px;display:flex;flex-direction:column;gap:2px;
}
.log-stat b{
  font-family:'Chakra Petch',sans-serif;font-size:20px;font-weight:700;color:var(--text);
  display:flex;align-items:baseline;gap:5px;
}
.log-stat b small{font-size:11px;color:var(--muted);font-weight:600}
.log-stat span{font-size:10.5px;color:var(--muted);letter-spacing:.4px;text-transform:uppercase}
.log-filter{display:flex;gap:8px;align-items:center;margin-bottom:10px;flex-wrap:wrap}
.log-filter .ghost.active{border-color:var(--kick-green);color:var(--kick-green);background:rgba(83,252,24,.08)}
.log-count{font-size:12px;color:var(--muted);margin-left:auto}
.btn-sm{padding:6px 11px;font-size:12px}
.log-table-wrap{max-height:420px;overflow-y:auto;border:1px solid var(--border);border-radius:10px}
.log-table{font-size:12.5px}
.log-table thead th{position:sticky;top:0;background:#101510;z-index:2}
.log-table td{padding:7px 10px}
.log-time{color:var(--muted);white-space:nowrap;font-variant-numeric:tabular-nums}
.log-ip{font-family:ui-monospace,Consolas,monospace;color:#9FD3FF;white-space:nowrap}
.log-action{color:var(--muted);font-size:11.5px;white-space:nowrap}
.log-note{margin-top:12px;font-size:11.5px;color:var(--muted);line-height:1.6}
.log-note b{color:#E8B93C}

/* ---------- İmza önizleme (admin) ---------- */
.credit-preview{
  margin-top:14px;padding:16px 12px 14px;
  background:#0A0D09;border:1px dashed var(--border);border-radius:12px;
  display:flex;flex-direction:column;align-items:center;gap:10px;
}
.dev-line{
  width:120px;height:1px;
  background:linear-gradient(90deg, transparent, var(--border) 30%, var(--border) 70%, transparent);
}
.dev-link-preview{display:inline-flex;align-items:center;gap:8px;font-family:'Chakra Petch',sans-serif}
.dev-prefix-preview{font-size:11px;letter-spacing:2.6px;text-transform:uppercase;color:#4A5C42}
.dev-name-preview{
  font-size:14px;font-weight:700;letter-spacing:1.4px;
  background:linear-gradient(92deg, #53FC18 0%, #B6FF8E 45%, #EFFFEA 100%);
  -webkit-background-clip:text;background-clip:text;
  -webkit-text-fill-color:transparent;color:transparent;
  text-shadow:0 0 18px rgba(83,252,24,.28);
}
.dev-arrow-preview{font-size:10px;color:#4A5C42}

/* ---------- Slot editörü ---------- */
.slot-editor{
  border:1px solid var(--border);border-radius:12px;padding:14px;margin-bottom:14px;
  background:#0D120B;
}
.slot-editor-head{
  display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;
  font-family:'Chakra Petch',sans-serif;font-size:12px;letter-spacing:1.2px;
}
.switch{display:flex;align-items:center;gap:8px;cursor:pointer;font-size:11px;color:var(--muted)}
.switch input{width:16px;height:16px;accent-color:var(--kick-green);cursor:pointer}
.slot-fields{display:flex;flex-direction:column;gap:10px}
.slot-fields label{display:flex;flex-direction:column;gap:4px}
.slot-fields label>span{font-size:11px;color:var(--muted);letter-spacing:.4px}
.slot-fields .admin-input{width:100%}
.range-row>span b{color:var(--kick-green)}
input[type=range]{width:100%;accent-color:var(--kick-green);cursor:pointer;height:18px}
.slot-preview{
  margin-top:12px;padding:10px;border:1px dashed var(--border);border-radius:10px;
  background:#0A0D09;text-align:center;
}
.slot-preview img{max-width:100%;max-height:180px;display:inline-block;border-radius:8px}
.slot-editor .ghost{margin-top:12px;width:100%}
</style>
