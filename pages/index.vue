<template>
  <div class="layout">
    <!-- SOL REKLAM ALANI -->
    <aside v-if="slots.left.enabled" class="side-slot slot-left" :style="slotStyle(slots.left)">
      <a v-if="slots.left.url" :href="slots.left.link || undefined" target="_blank" rel="noopener nofollow" class="slot-link">
        <img :src="slots.left.url" :alt="slots.left.title" loading="lazy">
      </a>
      <div v-else class="slot-empty">SOL ALAN<br><small>admin → reklam</small></div>
    </aside>

    <div class="wrap">

    <header class="main-header">
      <div class="brand">
        <div class="logo-slot" :class="{ live }">
          <img v-if="avatarSrc" :src="avatarSrc" alt="Swaggybark logosu" @error="onAvatarError">
          <span v-else class="logo-fallback">SB</span>
          <span class="logo-pulse" v-if="live"></span>
        </div>
        <div class="brand-info">
          <h1>{{ channelName }} <span>PANELİ</span></h1>
          <div class="subtitle">Sohbet beklentisi &bull; günde 1 oy</div>
        </div>
      </div>

      <!-- Geometrik durum şeridi: tek satır, üst üste binmez -->
      <div class="status-strip">
        <div class="pill" :class="live ? 'pill-on' : 'pill-off'">
          <i class="dot"></i>{{ live ? 'YAYINDA' : (streamOk ? 'OFFLINE' : 'KONTROL YOK') }}
        </div>
        <div class="pill pill-ghost">📅 {{ trDateName(clientDayKey) }}</div>
        <div v-if="streamDuration" class="pill pill-ghost">⏱ {{ streamDuration }}</div>
        <div v-if="channelFollowers" class="pill pill-ghost">👥 {{ formatNumber(channelFollowers) }}</div>
        <div v-if="streamTitle" class="pill pill-title" :title="streamTitle">▶ {{ streamTitle }}</div>
      </div>
    </header>

    <div v-if="!streamOk" class="mini-warn">⚠️ Kick yayın durumu alınamadı — oylama normal şekilde devam ediyor.</div>
    <div v-if="store === 'memory'" class="mini-warn">
      🧪 Veritabanı bağlı değil — test modu (RAM).
      <span v-if="dbError" style="display:block;margin-top:4px;opacity:.85">Hata: {{ dbError }}</span>
    </div>

    <!-- 1) BEKLENTİ HESABI -->
    <section class="panel panel-hero">
      <div class="panel-title">
        <span>🧮 Beklenti Hesabı</span>
        <span>{{ total }} oy • {{ live ? 'yayın sürüyor' : 'yayın dışı' }}</span>
      </div>

      <div class="hero-grid">
        <!-- % gösterge (yarım daire) -->
        <div class="gauge-area">
          <canvas ref="gaugeEl"></canvas>
          <div class="gauge-label">
            <b>{{ verdict }}</b>
            <span class="sep">•</span>
            Güven: <b>{{ confidenceText }}</b>
          </div>
        </div>

        <!-- Topluluk skoru + detaylar -->
        <div class="score-block">
          <div class="score-head">
            <div class="score-value" :class="scoreClass">{{ score }}</div>
            <div class="score-head-text">
              <div class="score-label">TOPLULUK SKORU</div>
              <div class="score-tag">{{ scoreTag }}</div>
            </div>
          </div>
          <div class="score-side">
            <div class="score-kv">
              <span>Evet lehine</span>
              <b class="c-yes">{{ total ? yesPct + '%' : '—' }}</b>
            </div>
            <div class="score-kv">
              <span>Hayır lehine</span>
              <b class="c-no">{{ total ? (100 - yesPct) + '%' : '—' }}</b>
            </div>
            <div class="score-kv">
              <span>Katılımcı</span>
              <b>{{ total }} kişi</b>
            </div>
          </div>
        </div>
      </div>

      <!-- Gün içi trend -->
      <div class="trend-block">
        <div class="trend-head">
          <span>📈 Gün içi beklenti eğrisi</span>
          <span class="trend-legend">
            <i class="lg lg-yes"></i> EVET
            <i class="lg lg-no"></i> HAYIR
          </span>
        </div>
        <svg v-if="trendPoints.length > 1" class="trend-svg" :viewBox="`0 0 ${TREND_W} ${TREND_H}`" preserveAspectRatio="none">
          <defs>
            <linearGradient id="trendFillYes" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#53FC18" stop-opacity="0.22"/>
              <stop offset="100%" stop-color="#53FC18" stop-opacity="0"/>
            </linearGradient>
          </defs>
          <line :x1="0" :y1="TREND_H / 2" :x2="TREND_W" :y2="TREND_H / 2" class="trend-mid"/>
          <path :d="trendArea" fill="url(#trendFillYes)" class="trend-area"/>
          <path :d="trendLine" class="trend-line"/>
          <circle :cx="lastPoint.x" :cy="lastPoint.y" r="4" class="trend-dot"/>
        </svg>
        <div v-else class="trend-empty">
          Eğri için oy akışı gerekiyor — ilk oylardan sonra burada topluluğun zamana göre değişimi görünecek.
        </div>
        <div v-if="trendPoints.length > 1" class="trend-foot">
          <span>{{ trendStartLabel }}</span>
          <span>{{ trendEndLabel }}</span>
        </div>
      </div>

      <div class="streak-row">
        <div class="streak">
          <span class="streak-icon">{{ streakIcon }}</span>
          <div>
            <b>{{ streakText }}</b>
            <small>{{ streakSub }}</small>
          </div>
        </div>
        <div class="streak">
          <span class="streak-icon">⏱</span>
          <div>
            <b>{{ total >= 20 ? 'Kalabalık' : total >= 8 ? 'Orta' : total > 0 ? 'Az veri' : 'Veri yok' }}</b>
            <small>oylama yoğunluğu</small>
          </div>
        </div>
      </div>
    </section>

    <!-- 2) OYLAMA -->
    <section class="panel panel-vote">
      <!-- KOCAMAN PARLAK SORU -->
      <div class="mega-question">
        <h2 class="mega-text">{{ question }}</h2>
        <div class="mega-glow"></div>
      </div>

      <div class="panel-title" style="margin-top:18px">
        <span>🗳️ Oylama</span>
        <span>{{ votingOpen ? '🟢 AÇIK' : '🔒 KAPALI' }} • sıfırlanma 03:00</span>
      </div>

      <div v-if="banner" class="banner" :class="banner.cls">
        <span>{{ banner.icon }}</span>
        <span v-html="banner.text"></span>
      </div>

      <div class="votes">
        <button class="vote-btn vote-yes" :disabled="!canVote" :class="{ mine: votingOpen && myChoice === 'yes' }" @click="vote('yes')">
          <small>EVET</small>✅
        </button>
        <button class="vote-btn vote-no" :disabled="!canVote" :class="{ mine: votingOpen && myChoice === 'no' }" @click="vote('no')">
          <small>HAYIR</small>❌
        </button>
        <VoteFloats :floats="floats" />
      </div>

      <div v-if="voteNote" class="vote-note" v-html="voteNote"></div>

      <!-- Oy değiştirme butonu (1 dakika) -->
      <div class="change-row" v-if="myChoice && votingOpen">
        <button class="ghost btn-change" @click="openChangeWindow" :disabled="changeWindowOpen">
          <template v-if="changeWindowOpen">⏳ Değiştirme penceresi: {{ changeSecondsLeft }} sn</template>
          <template v-else>✏️ Oyumu Değiştir (1 dk)</template>
        </button>
      </div>

      <div class="reset-note">⏰ Sonraki yeni gün oylaması: {{ countdown }}</div>
    </section>

    <!-- 3) BUGÜNÜN SONUÇLARI -->
    <section class="panel">
      <div class="panel-title">
        <span>📊 {{ activeDay ? 'Bugünün Sonuçları' : 'Son Oylamanın Sonuçları' }}</span>
        <span>{{ total }} oy</span>
      </div>
      <div class="stat-row">
        <span class="yes-c">✅ EVET — {{ poll?.yes ?? 0 }} ({{ total ? yesPct + '%' : '0%' }})</span>
        <span class="no-c">❌ HAYIR — {{ poll?.no ?? 0 }} ({{ total ? (100 - yesPct) + '%' : '0%' }})</span>
      </div>
      <div class="bar">
        <div class="yes-fill" :style="{ width: (total ? yesPct : 0) + '%' }"><span v-if="total && yesPct >= 14">{{ yesPct }}%</span></div>
        <div class="no-fill"><span v-if="total && 100 - yesPct >= 14">{{ 100 - yesPct }}%</span></div>
      </div>
    </section>

    <!-- 4) GEÇMİŞ GÜNLER -->
    <section class="panel">
      <div class="panel-title"><span>🗓️ Geçmiş Günler</span><span>{{ pastDays.length }} gün</span></div>
      <table class="hist-table">
        <thead>
          <tr><th>Gün</th><th>Dağılım</th><th>Evet</th><th>Hayır</th><th>Sonuç</th><th>Kapanış</th></tr>
        </thead>
        <tbody>
          <tr v-if="!pastDays.length">
            <td colspan="6" class="hist-empty">Henüz tamamlanmış gün yok — ilk oylama bugün başlıyor 🎮</td>
          </tr>
          <tr v-for="d in pastDays" :key="d.dayKey">
            <td class="hist-date">
              {{ trDateName(d.dayKey) }}
              <small>{{ d.yes + d.no }} oy</small>
            </td>
            <td>
              <span class="h-mini">
                <span class="hy" :style="{ width: d.yes + d.no ? (d.yes / (d.yes + d.no) * 100) + '%' : '50%' }"></span>
              </span>
            </td>
            <td><span style="color:var(--kick-green);font-weight:600">✅ {{ d.yes }}</span></td>
            <td><span style="color:var(--no-red);font-weight:600">❌ {{ d.no }}</span></td>
            <td>
              <span v-if="d.yes > d.no" class="winner-yes">EVET %{{ Math.round(d.yes / (d.yes + d.no) * 100) }}</span>
              <span v-else-if="d.no > d.yes" class="winner-no">HAYIR %{{ Math.round(d.no / (d.yes + d.no) * 100) }}</span>
              <span v-else class="winner-tie">BERABERE</span>
            </td>
            <td class="hist-reason">{{ endReasonText(d.status) }}</td>
          </tr>
        </tbody>
      </table>
    </section>

    <footer><b>{{ channelName }} • KICK</b> &bull; oylar gece 03:00'da yenilenir &bull; yayın sürerken oylama kapanır, bitince açılır &bull; GLHF 🎮</footer>
    </div>

    <!-- SAĞ REKLAM ALANI -->
    <aside v-if="slots.right.enabled" class="side-slot slot-right" :style="slotStyle(slots.right)">
      <a v-if="slots.right.url" :href="slots.right.link || undefined" target="_blank" rel="noopener nofollow" class="slot-link">
        <img :src="slots.right.url" :alt="slots.right.title" loading="lazy">
      </a>
      <div v-else class="slot-empty">SAĞ ALAN<br><small>admin → reklam</small></div>
    </aside>
  </div>
</template>

<script setup lang="ts">
import { dayKeyFor, trDateName, nextResetIso } from '~/shared/utils/day'

type PollStatus = 'active' | 'closed_stream' | 'closed_manual' | 'ended_day'

interface PollDTO {
  dayKey: string
  yes: number
  no: number
  status: PollStatus
  manualOverride: boolean
  votesEpoch: string
  closedAt: string | null
  reopenedAt: string | null
  endedAt: string | null
  streamStartedAt: string | null
}

interface ChannelDTO {
  ok: boolean
  avatar: string | null
  banner: string | null
  username: string | null
  followers: number | null
  live: boolean
}

interface SlotConfig {
  enabled: boolean
  url: string
  link: string
  title: string
  width: number
  radius: number
  opacity: number
}

interface CurrentDTO {
  poll: PollDTO
  live: boolean
  streamOk: boolean
  streamError: string | null
  streamTitle: string | null
  streamStartedAt: string | null
  channel: ChannelDTO
  question: string
  slots: { left: SlotConfig; right: SlotConfig }
  trend: { at: string; yes: number; no: number }[]
  todayKey: string
  nextReset: string
  store: 'mongo' | 'memory'
  dbError?: string | null
}

/* SSR'da da veri gelsin → ilk yüklemede boş ekran olmasın */
const { data: cur, refresh: refreshCur } = await useFetch<CurrentDTO>('/api/poll/current', { key: 'sb-current' })
const { data: hist, refresh: refreshHist } = await useFetch<{ polls: PollDTO[] }>('/api/poll/history', { key: 'sb-history' })

/* ---------------- Türevler ---------------- */
const livePoll = ref<PollDTO | null>(null)
const poll = computed(() => {
  const base = cur.value?.poll ?? null
  // SSE'den gelen anlık veri aynı güne aitse onu tercih et
  if (livePoll.value && base && livePoll.value.dayKey === base.dayKey) return livePoll.value
  return base
})
const live = computed(() => !!cur.value?.live)
const streamOk = computed(() => cur.value?.streamOk ?? true)
const streamError = computed(() => cur.value?.streamError ?? null)
const streamTitle = computed(() => cur.value?.streamTitle ?? null)
const streamStartedAt = computed(() => cur.value?.streamStartedAt ?? null)
const channel = computed(() => cur.value?.channel ?? null)
const question = computed(() => cur.value?.question || 'Dayı bugün yayın açacak mı?')
const slots = computed(() => cur.value?.slots ?? {
  left: { enabled: false, url: '', link: '', title: '', width: 260, radius: 16, opacity: 1 },
  right: { enabled: false, url: '', link: '', title: '', width: 260, radius: 16, opacity: 1 }
})

function slotStyle(s: SlotConfig) {
  return {
    width: s.width + 'px',
    borderRadius: s.radius + 'px',
    opacity: String(s.opacity)
  }
}
const store = computed(() => cur.value?.store ?? 'mongo')
const dbError = computed(() => cur.value?.dbError ?? null)
const history = computed(() => hist.value?.polls ?? [])

const MyVoteLS = 'swaggybark_oyum_v1'
/** { day, choice, epoch } — epoch, oylar sıfırlandığında değişir (eski oy geçersizleşir) */
const myVote = ref<{ day: string; choice: 'yes' | 'no'; epoch?: string } | null>(null)
/** Değiştirme penceresi bitiş zamanı (ms) */
const changeUntil = ref(0)
const avatarFailed = ref(false)

const clientDayKey = ref(dayKeyFor())
const nowTs = ref(Date.now())
let timers: ReturnType<typeof setInterval>[] = []

/* ---------------- Logo ---------------- */
const avatarSrc = computed(() => {
  if (avatarFailed.value) return null
  return channel.value?.avatar || '/logo.svg'
})
function onAvatarError() {
  avatarFailed.value = true
}
const channelName = computed(() => channel.value?.username || 'SWAGGYBARK')
const channelFollowers = computed(() => channel.value?.followers ?? null)

// Tarayıcı sekmesi ikonu = kanal logosu
useFavicon(computed(() => channel.value?.avatar || null))

function formatNumber(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace('.0', '') + 'M'
  if (n >= 1000) return (n / 1000).toFixed(1).replace('.0', '') + 'K'
  return String(n)
}

/* ---------------- Periyodik güncelleme (yedek) ---------------- */
onMounted(() => {
  try { myVote.value = JSON.parse(localStorage.getItem(MyVoteLS) || 'null') } catch { myVote.value = null }
  timers.push(setInterval(() => { refreshCur(); refreshHist() }, 60_000))
  timers.push(setInterval(() => {
    nowTs.value = Date.now()
    const k = dayKeyFor()
    if (k !== clientDayKey.value) { clientDayKey.value = k; refreshCur(); refreshHist() }
  }, 1000))
  document.addEventListener('keydown', onKey)
})

onBeforeUnmount(() => {
  timers.forEach(clearInterval)
  document.removeEventListener('keydown', onKey)
})

/* ---------------- Anlık güncelleme (WebSocket + SSE) + uçuşan +1 ---------------- */
const { floats, push: pushFloat } = useVoteFloats()

const { connected: liveConnected, transport: liveTransport } = useLiveUpdates((evt: any) => {
  // WebSocket tam durum gönderir → her şey anında güncellenir (F5 gerekmez)
  if (evt.state && cur.value) {
    const s = evt.state
    cur.value = {
      ...cur.value,
      poll: s.poll ?? cur.value.poll,
      question: s.question ?? cur.value.question,
      slots: s.slots ?? cur.value.slots,
      trend: s.trend ?? cur.value.trend,
      live: s.live,
      streamOk: s.streamOk,
      streamTitle: s.streamTitle,
      channel: s.channel ?? cur.value.channel,
      todayKey: s.todayKey ?? cur.value.todayKey,
      nextReset: s.nextReset ?? cur.value.nextReset
    }
    livePoll.value = s.poll ?? null
    return
  }
  // SSE: oy olayı → +1 animasyonu
  if (evt.poll && cur.value) {
    livePoll.value = evt.poll as PollDTO
  }
  if (evt.type === 'vote' && evt.choice) {
    pushFloat(evt.choice)
  }
})

/* ---------------- Türevler ---------------- */
const activeDay = computed(() => poll.value && poll.value.dayKey === clientDayKey.value)
const total = computed(() => (poll.value ? poll.value.yes + poll.value.no : 0))
const yesRatio = computed(() => (total.value ? poll.value!.yes / total.value : 0.5))
const yesPct = computed(() => Math.round(yesRatio.value * 100))
const votingOpen = computed(() =>
  !!poll.value && poll.value.status === 'active' && poll.value.dayKey === clientDayKey.value
)
const myChoice = computed(() => {
  if (!myVote.value || !poll.value) return null
  if (myVote.value.day !== poll.value.dayKey) return null
  // oylar sıfırlandıysa (epoch değişti) eski oy kaydı geçersiz → tekrar oy verilebilir
  if (myVote.value.epoch && poll.value.votesEpoch && myVote.value.epoch !== poll.value.votesEpoch) return null
  return myVote.value.choice
})

// Değiştirme penceresi (60 sn) açık mı?
const changeWindowOpen = computed(() => changeUntil.value > nowTs.value)
const changeSecondsLeft = computed(() => Math.max(0, Math.ceil((changeUntil.value - nowTs.value) / 1000)))

// Butonlar kilidi: oylama kapalıysa ya da (oy verildi ama değiştirme penceresi yoksa)
const canVote = computed(() => {
  if (!votingOpen.value) return false
  if (!myChoice.value) return true
  return changeWindowOpen.value
})
const pastDays = computed(() => history.value.filter(d => d.dayKey !== clientDayKey.value))

const banner = computed(() => {
  if (!poll.value) return null
  const s = poll.value.status
  if (s === 'closed_stream') {
    return { icon: '🔴', cls: 'banner-live', text: '<b>Yayın sürüyor — oylama yayın bitince tekrar açılacak.</b> Oyların kayıp değil, kaldığı yerde saklanıyor.' }
  }
  if (s === 'closed_manual') {
    return { icon: '⏸', cls: 'banner-manual', text: '<b>Yayıncı oylamayı kapattı.</b> Yeni oylama gece 03:00\'ta başlayacak.' }
  }
  if (live.value && s === 'active') {
    return { icon: '📺', cls: 'banner-ok', text: '<b>Yayındayız ama oylama açık</b> — yayıncı özel olarak açık tuttu.' }
  }
  return null
})

const voteNote = computed(() => {
  if (myChoice.value === 'yes') return '✅ Oyun <b class="y">EVET</b> olarak kaydedildi. Bugün için tek oy hakkın var — değiştirmek için aşağıdaki butonu kullan.'
  if (myChoice.value === 'no') return '❌ Oyun <b class="n">HAYIR</b> olarak kaydedildi. Bugün için tek oy hakkın var — değiştirmek için aşağıdaki butonu kullan.'
  if (!activeDay.value) return 'Bugün henüz oylama yok — gece 03:00\'ta başlayacak.'
  if (!votingOpen.value) return 'Oylama şu an kapalı — yukarıdaki bildirime bak.'
  return 'Seçimini yap ve oyun kaydedilsin — günde 1 oy hakkın var.'
})

const verdict = computed(() => {
  const n = total.value
  if (!n) return '—'
  const p = yesRatio.value
  if (p >= .9) return 'Neredeyse kesin EVET'
  if (p >= .7) return 'GÜÇLÜ EVET'
  if (p > .55) return 'Hafif EVET'
  if (p === .5) return 'Bağlı oy — %50/50'
  if (p >= .3) return 'Hafif HAYIR'
  if (p >= .1) return 'GÜÇLÜ HAYIR'
  return 'Neredeyse kesin HAYIR'
})

// Sekme başlığı: "Beklenti %71" (oy yokken "Beklenti %—")
useHead({
  title: computed(() => {
    const p = total.value ? yesPct.value : null
    return `Beklenti ${p === null ? '%—' : '%' + p} • ${channelName.value}`
  })
})

/* ---------------- Topluluk Skoru ----------------
   Oran + veri hacmi birleşik: az oyda 50'ye (kararsız) çekilir, çok oyda netleşir.
   Skor asla oranla çelişmez — sadece eminlik düzeyini yansıtır. */
const score = computed(() => {
  const n = total.value
  if (!n) return 50
  const p = yesRatio.value * 100          // 0-100 arası ham oran
  const volume = Math.min(1, n / 25)      // 25 oyda tam hacim
  return Math.round(50 + (p - 50) * (0.45 + 0.55 * volume))
})

const scoreTag = computed(() => {
  const s = score.value
  if (!total.value) return 'Henüz oy yok — topluluk sessiz'
  if (s >= 80) return 'Topluluk EVET konusunda çok net'
  if (s >= 65) return 'Topluluk EVET lehinde eğilimli'
  if (s > 55) return 'Topluluk hafif EVET lehinde'
  if (s === 50) return 'Topluluk tam bölünmüş (50/50)'
  if (s >= 45) return 'Topluluk hafif HAYIR lehinde'
  if (s >= 35) return 'Topluluk HAYIR lehinde eğilimli'
  return 'Topluluk HAYIR konusunda çok net'
})

const scoreClass = computed(() => {
  const s = score.value
  if (!total.value) return 'score-neutral'
  if (s > 55) return 'score-yes'
  if (s < 45) return 'score-no'
  return 'score-neutral'
})

const confidenceClass = computed(() => {
  const n = total.value
  if (n >= 20) return 'c-strong'
  if (n >= 8) return 'c-mid'
  return 'c-weak'
})

/* ---------------- Gün içi trend ---------------- */
const TREND_W = 640
const TREND_H = 130

const trendPoints = computed(() => {
  const raw = cur.value?.trend ?? []
  return raw
    .map(s => {
      const t = (s.yes + s.no) > 0 ? s.yes / (s.yes + s.no) : 0.5
      return { at: s.at, t, yes: s.yes, no: s.no }
    })
    .filter(p => p.yes + p.no > 0)
})

const trendPath = computed(() => {
  const pts = trendPoints.value
  if (pts.length < 2) return ''
  const first = new Date(pts[0].at).getTime()
  const last = new Date(pts[pts.length - 1].at).getTime()
  const span = Math.max(1, last - first)
  return pts.map((p, i) => {
    const x = ((new Date(p.at).getTime() - first) / span) * TREND_W
    const y = TREND_H - p.t * TREND_H
    return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
})

const trendLine = computed(() => trendPath.value)
const trendArea = computed(() => {
  const path = trendPath.value
  if (!path) return ''
  return `${path} L${TREND_W},${TREND_H} L0,${TREND_H} Z`
})

const lastPoint = computed(() => {
  const pts = trendPoints.value
  if (!pts.length) return { x: 0, y: TREND_H / 2 }
  const first = new Date(pts[0].at).getTime()
  const last = new Date(pts[pts.length - 1].at).getTime()
  const span = Math.max(1, last - first)
  const p = pts[pts.length - 1]
  return {
    x: ((new Date(p.at).getTime() - first) / span) * TREND_W,
    y: TREND_H - p.t * TREND_H
  }
})

function timeLabel(iso: string) {
  return new Date(iso).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Istanbul' })
}
const trendStartLabel = computed(() => trendPoints.value.length ? timeLabel(trendPoints.value[0].at) : '')
const trendEndLabel = computed(() => trendPoints.value.length ? timeLabel(trendPoints.value[trendPoints.value.length - 1].at) : '')

/* ---------------- Gün serisi (streak) ---------------- */
const streak = computed(() => {
  // bugünden geriye doğru, ağırlıklı sonucun aynı olduğu kesintisiz gün sayısı
  const days: { key: string; side: 'yes' | 'no' | null }[] = []
  const today = clientDayKey.value
  if (poll.value) days.push({ key: today, side: poll.value.yes > poll.value.no ? 'yes' : poll.value.no > poll.value.yes ? 'no' : null })

  const hist = [...pastDays.value].sort((a, b) => (a.dayKey < b.dayKey ? 1 : -1))
  for (const d of hist) {
    days.push({ key: d.dayKey, side: d.yes > d.no ? 'yes' : d.no > d.yes ? 'no' : null })
  }

  let count = 0
  let side: 'yes' | 'no' | null = null
  for (const d of days) {
    if (!d.side) break
    if (side === null) { side = d.side; count = 1; continue }
    if (d.side === side) count++
    else break
  }
  return { count, side }
})

const streakIcon = computed(() => {
  if (!streak.value.count) return '⚖️'
  return streak.value.side === 'yes' ? '✅' : '❌'
})

const streakText = computed(() => {
  const s = streak.value
  if (!s.count) return 'Henüz seri yok'
  return `${s.count} gündür ${s.side === 'yes' ? 'EVET' : 'HAYIR'} lehinde`
})

const streakSub = computed(() => {
  const s = streak.value
  if (!s.count) return 'ilk oyularla seri başlar'
  return s.count >= 3 ? 'topluluk tutarlı bir yönde 🔥' : 'devam ederse seri büyür'
})

const confidenceText = computed(() => {
  const n = total.value
  if (!n) return '—'
  if (n < 5) return `çok düşük (${n} oy)`
  const p = yesRatio.value
  const d = 1.96 * Math.sqrt(p * (1 - p) / n)
  return `±${(d * 100).toFixed(0)}%`
})

function fmtDuration(ms: number) {
  if (ms < 0) ms = 0
  const m = Math.floor(ms / 60000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (d > 0) return `${d}g ${h % 24}s`
  if (h > 0) return `${h}s ${m % 60}dk`
  return `${m}dk`
}

const streamDuration = computed(() => {
  if (!streamStartedAt.value) return ''
  const t = Date.parse(streamStartedAt.value.replace(' ', 'T') + 'Z')
  if (isNaN(t)) return ''
  return fmtDuration(nowTs.value - t)
})

const countdown = computed(() => {
  const t = Date.parse(cur.value?.nextReset || nextResetIso())
  if (isNaN(t)) return '—'
  return fmtDuration(t - nowTs.value)
})

function endReasonText(status: PollStatus) {
  if (status === 'ended_day') return 'gün doldu'
  if (status === 'closed_stream') return 'yayın nedeniyle'
  if (status === 'closed_manual') return 'yayıncı kapattı'
  return '—'
}

/* ---------------- Oy ---------------- */
async function vote(choice: 'yes' | 'no') {
  if (!canVote.value) return
  try {
    const res: any = await $fetch<{ ok: boolean; result: string; poll: PollDTO }>('/api/poll/vote', {
      method: 'POST',
      body: { choice }
    })
    poll.value = res.poll
    myVote.value = { day: res.poll.dayKey, choice, epoch: res.poll.votesEpoch }
    localStorage.setItem(MyVoteLS, JSON.stringify(myVote.value))
    // oy değiştirildiyse pencereyi kapat
    if (res.result === 'changed') changeUntil.value = 0
    addRipple(choice === 'yes' ? btnYesEl.value : btnNoEl.value)
    await refreshCur()
    await refreshHist()
  } catch (err: any) {
    if (String(err?.status ?? err?.statusCode) === '409') {
      await refreshCur()
    } else {
      console.error('Oy hatası:', err?.data?.statusMessage || err)
    }
  }
}

/** 1 dakikalık oy değiştirme penceresini açar (sunucu tarafında doğrulanır). */
async function openChangeWindow() {
  try {
    const res: any = await $fetch('/api/poll/change-window', { method: 'POST' })
    changeUntil.value = res.until || 0
  } catch (err: any) {
    console.error('Değiştirme penceresi açılamadı:', err?.data?.statusMessage || err)
  }
}

/* ---------------- Gauge (% göstergesi) ---------------- */
const gaugeEl = ref<HTMLCanvasElement | null>(null)
const btnYesEl = ref<HTMLButtonElement | null>(null)
const btnNoEl = ref<HTMLButtonElement | null>(null)

function drawGauge(yesOran: number, n: number) {
  const canvas = gaugeEl.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const dpr = window.devicePixelRatio || 1
  const W = 360, H = 200, cx = W / 2, cy = 150, r = 118
  canvas.width = W * dpr; canvas.height = H * dpr
  canvas.style.width = '100%'; canvas.style.maxWidth = W + 'px'
  canvas.style.height = 'auto'; canvas.style.aspectRatio = `${W}/${H}`
  ctx.scale(dpr, dpr); ctx.clearRect(0, 0, W, H)

  ctx.lineWidth = 22; ctx.lineCap = 'round'
  ctx.strokeStyle = '#20281A'
  ctx.beginPath(); ctx.arc(cx, cy, r, Math.PI, Math.PI * 2); ctx.stroke()

  if (n > 0) {
    const grad = ctx.createLinearGradient(0, 0, W, 0)
    grad.addColorStop(0, '#3AA812'); grad.addColorStop(1, '#53FC18')
    ctx.strokeStyle = grad
    ctx.shadowColor = 'rgba(83,252,24,.55)'; ctx.shadowBlur = 14
    ctx.beginPath(); ctx.arc(cx, cy, r, Math.PI, Math.PI + Math.PI * yesOran); ctx.stroke()

    ctx.strokeStyle = '#FF3B5C'
    ctx.shadowColor = 'rgba(255,59,92,.5)'
    ctx.beginPath(); ctx.arc(cx, cy, r, Math.PI + Math.PI * yesOran, Math.PI * 2); ctx.stroke()
    ctx.shadowBlur = 0

    // ibre: yay üzerinde küçük işaretçi (merkez yazıyı kesmez)
    const na = Math.PI + Math.PI * yesOran
    const mx = cx + Math.cos(na) * (r + 2)
    const my = cy + Math.sin(na) * (r + 2)
    ctx.strokeStyle = '#EFFFEA'; ctx.lineWidth = 3; ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(cx + Math.cos(na) * (r - 16), cy + Math.sin(na) * (r - 16))
    ctx.lineTo(mx, my)
    ctx.stroke()
    ctx.fillStyle = '#EFFFEA'
    ctx.beginPath(); ctx.arc(mx, my, 5.5, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = '#0B0F0A'
    ctx.beginPath(); ctx.arc(mx, my, 2.2, 0, Math.PI * 2); ctx.fill()
  }

  ctx.fillStyle = n ? '#53FC18' : '#5E7255'
  ctx.font = "700 44px 'Chakra Petch', sans-serif"
  ctx.textAlign = 'center'
  ctx.fillText(n ? '%' + Math.round(yesOran * 100) : '%—', cx, cy - 46)
  ctx.fillStyle = '#8CA184'
  ctx.font = "600 12px 'Inter', sans-serif"
  ctx.fillText('EVET BEKLENTİSİ', cx, cy - 24)
}

watch([total, yesRatio], () => drawGauge(total.value ? yesRatio.value : 0.5, total.value))
watch(gaugeEl, c => { if (c) drawGauge(total.value ? yesRatio.value : 0.5, total.value) })

function addRipple(btn: HTMLButtonElement | null) {
  if (!btn) return
  const rect = btn.getBoundingClientRect()
  const size = Math.max(rect.width, rect.height)
  const el = document.createElement('span')
  el.className = 'ripple'
  el.style.width = el.style.height = size + 'px'
  el.style.left = (rect.width / 2 - size / 2) + 'px'
  el.style.top = (rect.height / 2 - size / 2) + 'px'
  btn.appendChild(el)
  setTimeout(() => el.remove(), 520)
}

function onKey(ev: KeyboardEvent) {
  const tgt = ev.target as HTMLElement | null
  if (tgt && ['INPUT', 'TEXTAREA'].includes(tgt.tagName)) return
  const k = ev.key.toLowerCase()
  if (k === 'e') vote('yes')
  else if (k === 'h') vote('no')
}
</script>
