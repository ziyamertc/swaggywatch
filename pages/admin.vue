<template>
  <div class="wrap wrap-admin">
    <header class="main-header">
      <div class="brand">
        <div class="logo-slot small">
          <span class="logo-fallback">🎛</span>
        </div>
        <div class="brand-info">
          <h1>YAYINCI <span>KONTROLÜ</span></h1>
          <div class="subtitle">Bu sayfa sadece kanal sahibine</div>
        </div>
      </div>
      <div class="status-strip">
        <NuxtLink to="/" class="pill pill-ghost">← Panele dön</NuxtLink>
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
      <section class="panel">
        <div class="panel-title">
          <span>📺 Oylama Durumu</span>
          <span>{{ pollStatusText }}</span>
        </div>
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
      </section>

      <section class="panel">
        <div class="panel-title"><span>❓ Oylama Sorusu</span><span>panelde ve overlay'da görünür</span></div>
        <input v-model="questionInput" class="admin-input" maxlength="160" placeholder="Dayı bugün yayın açacak mı?" @keyup.enter="saveQuestion">
        <div class="admin-row" style="margin-top:10px">
          <button class="ghost btn-ok" @click="saveQuestion">💾 Soruyu Kaydet</button>
        </div>
        <div v-if="questionMsg" class="vote-note" style="text-align:left" v-html="questionMsg"></div>
      </section>

      <section class="panel">
        <div class="panel-title"><span>🖼️ Yan Reklam Alanları</span><span>sol / sağ boşluk</span></div>

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
      </section>

      <section class="panel">
        <div class="panel-title"><span>📺 Yayın Durumu</span><span>{{ live ? 'YAYINDA' : 'OFFLINE' }}</span></div>
        <div class="kv">
          <div><span>Kanal</span><b>{{ channelName }}</b></div>
          <div><span>Yayın</span><b>{{ streamTitle || 'yayın yok' }}</b></div>
          <div><span>Gün</span><b>{{ todayKey }}</b></div>
          <div><span>Veritabanı</span><b>{{ store }}</b></div>
        </div>
        <button class="ghost" style="margin-top:14px" @click="refresh">🔄 Yenile</button>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
const keyInput = ref('')
const authed = ref(false)
const msg = ref('')
const questionInput = ref('')
const questionMsg = ref('')
const slotMsg = ref('')
const slot = reactive({
  left: { enabled: false, url: '', link: '', title: '', width: 260, radius: 16, opacity: 1 },
  right: { enabled: false, url: '', link: '', title: '', width: 260, radius: 16, opacity: 1 }
})
const poll = ref<any>(null)
const live = ref(false)
const streamTitle = ref<string | null>(null)
const todayKey = ref('')
const store = ref('')
const channelName = ref('SWAGGYBARK')

const pollStatusText = computed(() => {
  const s = poll.value?.status
  if (s === 'active') return '🟢 OYLAMA AÇIK'
  if (s === 'closed_stream') return '🔴 YAYIN NEDENİYLE KAPALI'
  if (s === 'closed_manual') return '⏸ YAYINCI KAPATTI'
  if (s === 'ended_day') return '📦 GÜN DOLDU'
  return '—'
})

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

async function refresh() {
  try {
    const res = await $fetch<any>('/api/poll/current')
    poll.value = res.poll
    live.value = res.live
    streamTitle.value = res.streamTitle
    todayKey.value = res.todayKey
    store.value = res.store
    channelName.value = res.channel?.username || 'SWAGGYBARK'
    if (!questionInput.value && res.question) questionInput.value = res.question
    if (res.slots) {
      Object.assign(slot.left, res.slots.left)
      Object.assign(slot.right, res.slots.right)
    }
  } catch { /* yok */ }
}

async function saveQuestion() {  const q = questionInput.value.trim()
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

async function login() {
  try {
    await $fetch('/api/admin/login', { method: 'POST', body: { key: keyInput.value } })
    authed.value = true
    msg.value = '✔ Giriş başarılı'
    keyInput.value = ''
    refresh()
  } catch (err: any) {
    msg.value = `❌ ${err?.data?.statusMessage || 'Hata'}`
  }
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
    msg.value = `❌ ${err?.data?.statusMessage || 'Yetkisiz'}`
  }
}

async function logout() {
  await $fetch('/api/admin/logout', { method: 'POST' })
  authed.value = false
  msg.value = '✔ Oturum kapatıldı'
}

onMounted(() => {
  // çerezle giriş yapılmış olabilir
  fetch('/api/poll/current').then(r => r.json()).then(res => {
    if (res?.poll) {
      poll.value = res.poll
      live.value = res.live
      todayKey.value = res.todayKey
      store.value = res.store
      channelName.value = res.channel?.username || 'SWAGGYBARK'
    }
  })
  // oturum çerezi geçerliyse doğrudan panele gir
  fetch('/api/admin/session').then(r => r.json()).then(s => {
    if (s?.authed) {
      authed.value = true
      refresh()
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
input[type=range]{
  width:100%;accent-color:var(--kick-green);cursor:pointer;height:18px;
}
.slot-preview{
  margin-top:12px;padding:10px;border:1px dashed var(--border);border-radius:10px;
  background:#0A0D09;text-align:center;
}
.slot-preview img{max-width:100%;max-height:180px;display:inline-block;border-radius:8px}
.slot-editor .ghost{margin-top:12px;width:100%}
</style>
