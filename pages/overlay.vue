<template>
  <div class="ov">
    <div class="ov-top">
      <div class="ov-brand">
        <img v-if="avatar" :src="avatar" class="ov-avatar" @error="avatar = null">
        <span class="ov-channel">{{ channelName }}</span>
        <span class="ov-live" v-if="live">● CANLI</span>
      </div>
      <div class="ov-count" v-if="total">{{ total }} oy</div>
    </div>

    <!-- KOCAMAN SORU + BUTONLAR (yan reklam alanlarıyla) -->
    <div class="ov-main">
      <!-- SOL ALAN -->
      <aside v-if="slots.left.enabled" class="ov-slot" :style="slotStyle(slots.left)">
        <a v-if="slots.left.url" :href="slots.left.link || undefined" target="_blank" rel="noopener nofollow">
          <img :src="slots.left.url" :alt="slots.left.title">
        </a>
      </aside>

      <div class="ov-center">
        <h1 class="ov-question">{{ question }}</h1>

        <div class="ov-buttons">
          <button class="ov-btn ov-yes" :disabled="!canVote" :class="{ mine: myChoice === 'yes' }" @click="vote('yes')">
            <span class="ov-big">EVET</span>
            <span class="ov-pct">{{ total ? yesPct + '%' : '—' }}</span>
            <span class="ov-n">{{ poll?.yes ?? 0 }}</span>
          </button>
          <button class="ov-btn ov-no" :disabled="!canVote" :class="{ mine: myChoice === 'no' }" @click="vote('no')">
            <span class="ov-big">HAYIR</span>
            <span class="ov-pct">{{ total ? (100 - yesPct) + '%' : '—' }}</span>
            <span class="ov-n">{{ poll?.no ?? 0 }}</span>
          </button>
          <VoteFloats :floats="floats" />
        </div>
      </div>

      <!-- SAĞ ALAN -->
      <aside v-if="slots.right.enabled" class="ov-slot" :style="slotStyle(slots.right)">
        <a v-if="slots.right.url" :href="slots.right.link || undefined" target="_blank" rel="noopener nofollow">
          <img :src="slots.right.url" :alt="slots.right.title">
        </a>
      </aside>
    </div>

    <!-- Oy değiştirme butonu -->
    <div class="ov-change" v-if="myChoice && votingOpen">
      <button class="ov-change-btn" @click="openChangeWindow" :disabled="changeWindowOpen">
        <template v-if="changeWindowOpen">⏳ {{ changeSecondsLeft }} sn</template>
        <template v-else>✏️ Oyumu Değiştir (1 dk)</template>
      </button>
    </div>

    <!-- SONUÇ BARI -->
    <div class="ov-bar">
      <div class="ov-bar-yes" :style="{ width: (total ? yesPct : 0) + '%' }"></div>
      <div class="ov-bar-no" :style="{ width: (total ? 100 - yesPct : 0) + '%' }"></div>
    </div>

    <div class="ov-foot">
      <span class="ov-verdict">{{ verdict }}</span>
      <span class="ov-status" v-if="!votingOpen">🔒 Oylama kapalı — {{ statusNote }}</span>
      <span class="ov-reset" v-else>🟢 Oylama açık • gece 03:00'da yenilenir</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { dayKeyFor } from '~/shared/utils/day'

interface PollDTO {
  dayKey: string; yes: number; no: number
  status: 'active' | 'closed_stream' | 'closed_manual' | 'ended_day'
  votesEpoch: string
}

const { data: cur, refresh } = await useFetch<any>('/api/poll/current', { key: 'ov-current' })

const poll = computed(() => {
  const base = cur.value?.poll ?? null
  if (livePoll.value && base && livePoll.value.dayKey === base.dayKey) return livePoll.value
  return base
})
const slots = computed(() => cur.value?.slots ?? {
  left: { enabled: false, url: '', link: '', title: '', width: 260, radius: 16, opacity: 1 },
  right: { enabled: false, url: '', link: '', title: '', width: 260, radius: 16, opacity: 1 }
})
function slotStyle(s: any) {
  return { width: s.width + 'px', borderRadius: s.radius + 'px', opacity: String(s.opacity) }
}
const live = computed(() => !!cur.value?.live)
const question = computed(() => cur.value?.question || 'Dayı bugün yayın açacak mı?')
const channelName = computed(() => cur.value?.channel?.username || 'SWAGGYBARK')
const avatar = ref<string | null>(null)
// Tarayıcı sekmesi ikonu = kanal logosu
useFavicon(computed(() => avatar.value))
const nowTs = ref(Date.now())
const total = computed(() => (poll.value ? poll.value.yes + poll.value.no : 0))
const yesPct = computed(() => (total.value ? Math.round((poll.value!.yes / total.value) * 100) : 0))
const votingOpen = computed(() => poll.value?.status === 'active' && poll.value?.dayKey === dayKeyFor())

const myVote = ref<{ day: string; choice: 'yes' | 'no'; epoch?: string } | null>(null)
const changeUntil = ref(0)
const myChoice = computed(() => {
  if (!myVote.value || !poll.value) return null
  if (myVote.value.day !== poll.value.dayKey) return null
  if (myVote.value.epoch && poll.value.votesEpoch && myVote.value.epoch !== poll.value.votesEpoch) return null
  return myVote.value.choice
})
const changeWindowOpen = computed(() => changeUntil.value > nowTs.value)
const changeSecondsLeft = computed(() => Math.max(0, Math.ceil((changeUntil.value - nowTs.value) / 1000)))
const canVote = computed(() => {
  if (!votingOpen.value) return false
  if (!myChoice.value) return true
  return changeWindowOpen.value
})

const verdict = computed(() => {
  if (!total.value) return 'OY BEKLENİYOR'
  const p = yesPct.value
  if (p >= 90) return 'NEREDEYSE KESİN EVET'
  if (p >= 70) return 'GÜÇLÜ EVET'
  if (p > 55) return 'HAFİF EVET'
  if (p === 50) return 'BAĞLI OY'
  if (p >= 30) return 'HAFİF HAYIR'
  if (p >= 10) return 'GÜÇLÜ HAYIR'
  return 'NEREDEYSE KESİN HAYIR'
})

const statusNote = computed(() => {
  const s = poll.value?.status
  if (s === 'closed_stream') return 'yayın bitince açılacak'
  if (s === 'closed_manual') return 'yayıncı kapattı'
  return 'yeni oylama 03:00\'ta'
})

onMounted(() => {
  try { myVote.value = JSON.parse(localStorage.getItem('swaggybark_oyum_v1') || 'null') } catch { myVote.value = null }
  const t = setInterval(() => refresh(), 60_000)
  const tick = setInterval(() => { nowTs.value = Date.now() }, 1000)
  onBeforeUnmount(() => { clearInterval(t); clearInterval(tick) })
  if (cur.value?.channel?.avatar) avatar.value = cur.value.channel.avatar
})

/* ---------------- Anlık güncelleme (SSE) + uçuşan +1 ---------------- */
const { floats, push: pushFloat } = useVoteFloats()
const livePoll = ref<PollDTO | null>(null)

useLiveUpdates((evt) => {
  if (evt.poll) {
    livePoll.value = evt.poll as PollDTO
  }
  if (evt.type === 'vote' && evt.choice) {
    pushFloat(evt.choice)
  }
})

watch(() => cur.value?.channel?.avatar, v => { if (v) avatar.value = v })

async function vote(choice: 'yes' | 'no') {
  if (!canVote.value) return
  try {
    const res: any = await $fetch('/api/poll/vote', { method: 'POST', body: { choice } })
    if (res?.poll) {
      myVote.value = { day: res.poll.dayKey, choice, epoch: res.poll.votesEpoch }
      localStorage.setItem('swaggybark_oyum_v1', JSON.stringify(myVote.value))
      if (res.result === 'changed') changeUntil.value = 0
    }
    await refresh()
  } catch { /* oy alınamadı */ }
}

async function openChangeWindow() {
  try {
    const res: any = await $fetch('/api/poll/change-window', { method: 'POST' })
    changeUntil.value = res.until || 0
  } catch { /* pencere açılamadı */ }
}
</script>

<style scoped>
.ov{
  width:100vw;height:100vh;
  display:flex;flex-direction:column;
  padding:2.2vh 2.5vw;
  background:
    radial-gradient(1200px 500px at 50% -10%, rgba(83,252,24,.10), transparent 65%),
    var(--kick-dark);
  color:var(--text);
  font-family:'Inter',sans-serif;
  overflow:hidden;
}
.ov-top{display:flex;justify-content:space-between;align-items:center;margin-bottom:1.5vh}
.ov-brand{display:flex;align-items:center;gap:1.2vh}
.ov-avatar{width:5.2vh;height:5.2vh;border-radius:1.4vh;object-fit:cover;border:1px solid var(--border)}
.ov-channel{font-family:'Chakra Petch',sans-serif;font-size:2.6vh;letter-spacing:1px;font-weight:600}
.ov-live{
  font-family:'Chakra Petch',sans-serif;font-size:1.8vh;font-weight:700;
  background:var(--kick-green);color:#0B0F0A;padding:.5vh 1.4vh;border-radius:999px;
  animation:blink 1.6s infinite;
}
@keyframes blink{0%,100%{opacity:1}50%{opacity:.55}}
.ov-count{font-size:2vh;color:var(--muted);font-weight:600}

.ov-question{
  font-family:'Chakra Petch',sans-serif;font-weight:700;
  font-size:clamp(34px, 7.2vh, 92px);
  line-height:1.08;text-align:center;flex:0 0 auto;
  margin:.5vh 0 3vh;
  color:#EAFFE0;
  text-shadow:0 0 10px rgba(83,252,24,.9),0 0 30px rgba(83,252,24,.6),0 0 70px rgba(83,252,24,.35);
  animation:ovPulse 3.2s ease-in-out infinite;
}
@keyframes ovPulse{
  0%,100%{text-shadow:0 0 10px rgba(83,252,24,.9),0 0 30px rgba(83,252,24,.5),0 0 60px rgba(83,252,24,.28)}
  50%{text-shadow:0 0 16px rgba(83,252,24,1),0 0 44px rgba(83,252,24,.8),0 0 95px rgba(83,252,24,.5)}
}

.ov-main{
  display:flex;gap:1.6vw;flex:1;min-height:0;align-items:stretch;
}
.ov-center{flex:1;min-width:0;display:flex;flex-direction:column;justify-content:center}
.ov-slot{
  flex:0 0 auto;max-width:34vw;display:flex;align-items:center;justify-content:center;
  overflow:hidden;border-radius:1.4vh;
}
.ov-slot img{width:100%;height:auto;display:block}
.ov-btn{
  flex:1;border:none;cursor:pointer;border-radius:2.4vh;
  display:flex;flex-direction:column;align-items:center;justify-content:center;gap:.6vh;
  color:#0B0F0A;transition:transform .1s, filter .2s, box-shadow .2s;
  font-family:'Chakra Petch',sans-serif;
}
.ov-btn:active{transform:scale(.985)}
.ov-btn:disabled{opacity:.78;cursor:not-allowed;filter:saturate(.85) brightness(1.05)}
.ov-btn:disabled:hover{opacity:.78}
.ov-yes{background:linear-gradient(180deg,#6BFF3A,#3FC614);box-shadow:0 0 7vh rgba(83,252,24,.35), inset 0 -.8vh 0 rgba(0,0,0,.18)}
.ov-no{background:linear-gradient(180deg,#FF5A75,#E01B40);color:#fff;box-shadow:0 0 7vh rgba(255,59,92,.3), inset 0 -.8vh 0 rgba(0,0,0,.2)}
.ov-btn.mine{outline:.5vh solid rgba(255,255,255,.9);outline-offset:-.5vh}
.ov-big{font-size:9vh;font-weight:700;letter-spacing:3px;line-height:1}
.ov-buttons{display:flex;gap:2vw;flex:1;min-height:0;position:relative}
.ov-pct{font-size:5.4vh;font-weight:700;opacity:.85;line-height:1}
.ov-n{font-size:2.2vh;font-weight:600;opacity:.7}

.ov-change{display:flex;justify-content:center;margin-top:1.2vh;flex:0 0 auto}
.ov-change-btn{
  background:rgba(232,185,60,.12);border:1px solid rgba(232,185,60,.45);color:#E8C66B;
  font-family:'Chakra Petch',sans-serif;font-size:1.8vh;font-weight:600;letter-spacing:.5px;
  padding:1vh 2.4vh;border-radius:1vh;cursor:pointer;transition:.2s;
}
.ov-change-btn:hover:not(:disabled){background:rgba(232,185,60,.2);color:#F0D07A}
.ov-change-btn:disabled{opacity:.8;cursor:default}

.ov-bar{
  display:flex;height:2.6vh;border-radius:1.3vh;overflow:hidden;
  background:#0D120B;border:1px solid var(--border);margin-top:2vh;
}
.ov-bar-yes{background:linear-gradient(90deg,#3AA812,var(--kick-green));transition:width .5s cubic-bezier(.22,1,.36,1)}
.ov-bar-no{background:linear-gradient(90deg,var(--no-red),#B3102E);transition:width .5s cubic-bezier(.22,1,.36,1)}

.ov-foot{
  display:flex;justify-content:space-between;align-items:center;
  font-size:1.9vh;color:var(--muted);margin-top:1.2vh;flex:0 0 auto;
}
.ov-verdict{font-family:'Chakra Petch',sans-serif;font-weight:700;color:var(--kick-green);letter-spacing:1px}
.ov-status{color:#FF8AA3}
.ov-reset{color:var(--kick-green)}
</style>
