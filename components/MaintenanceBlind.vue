<template>
  <Teleport to="body">
    <div v-if="visible" class="maint" :class="{ open }">
      <!-- arka karartma -->
      <div class="maint-scrim"></div>

      <!-- KEPEK -->
      <div class="blind">
        <div class="slats">
          <span v-for="n in 26" :key="n" class="slat" :style="{ animationDelay: (n * 22) + 'ms' }"></span>
        </div>

        <!-- alt kenar (ray) -->
        <div class="rail">
          <div class="rail-inner">
            <div class="rail-top">
              <span class="rail-dot"></span>
              <span class="rail-label">SİSTEM BAKIMDA</span>
              <span class="rail-dot"></span>
            </div>

            <h1 class="rail-title">BAKIMDAYIZ</h1>

            <p class="rail-msg">{{ maintenance.message || 'Kısa bir mola — birazdan buradayız.' }}</p>

            <div class="rail-meta">
              <span class="rail-chip">🔧 {{ channelName }}</span>
              <span v-if="elapsed" class="rail-chip">⏱ {{ elapsed }}</span>
              <span class="rail-chip pulse-chip">
                <span class="spinner"></span> birazdan dönüyoruz
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
const maintenance = ref<any>({ enabled: false, message: '', startedAt: null })
const channelName = ref('SWAGGYBARK')
const open = ref(false)
const now = ref(Date.now())

// WS mesajlarından anında güncelle (paylaşılan state)
const liveMsg = useState<any>('sb-live-msg', () => null)
watch(liveMsg, (m) => {
  if (m?.state?.maintenance) maintenance.value = m.state.maintenance
  if (m?.state?.channel?.username) channelName.value = m.state.channel.username
}, { deep: true })

async function load() {
  try {
    const r: any = await $fetch('/api/poll/maintenance')
    maintenance.value = r.maintenance || r
    if (r.channel?.username) channelName.value = r.channel.username
  } catch { /* yoksay */ }
}

const visible = computed(() => maintenance.value?.enabled === true)

watch(visible, (v) => {
  if (v) {
    open.value = false
    // bir sonraki karede aç → animasyon tetiklensin
    requestAnimationFrame(() => setTimeout(() => { open.value = true }, 30))
  } else {
    open.value = false
  }
})

const elapsed = computed(() => {
  if (!maintenance.value?.startedAt) return ''
  const diff = Math.max(0, now.value - new Date(maintenance.value.startedAt).getTime())
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'birkaç saniye'
  if (m < 60) return `${m} dakika`
  return `${Math.floor(m / 60)} sa ${m % 60} dk`
})

onMounted(() => {
  load()
  const t = setInterval(load, 15_000)
  const tick = setInterval(() => { now.value = Date.now() }, 1000)
  onBeforeUnmount(() => { clearInterval(t); clearInterval(tick) })
})
</script>

<style scoped>
.maint{
  position:fixed;inset:0;z-index:99999;
  pointer-events:auto;
}
.maint-scrim{
  position:absolute;inset:0;
  background:radial-gradient(900px 600px at 50% 30%, rgba(20,28,16,.92), rgba(4,6,3,.97));
  opacity:0;transition:opacity .5s ease .15s;
}
.maint.open .maint-scrim{opacity:1}

/* ── KEPEK ── */
.blind{
  position:absolute;left:0;right:0;top:0;height:100%;
  transform:scaleY(0);transform-origin:top center;
  transition:transform 1s cubic-bezier(.16,1,.3,1), opacity .4s ease;
  opacity:0;
  overflow:hidden;
}
.maint.open .blind{transform:scaleY(1);opacity:1}

.slats{position:absolute;inset:0;display:flex;flex-direction:column}
.slat{
  flex:1;
  background:linear-gradient(180deg,
    #232c1f 0%, #1a2118 38%, #0f140e 100%);
  border-bottom:1px solid rgba(0,0,0,.75);
  box-shadow:inset 0 1px 0 rgba(120,160,110,.10);
  transform:translateY(-100%);
  opacity:0;
}
.maint.open .slat{
  animation:slatDown .5s cubic-bezier(.16,1,.3,1) forwards;
}
@keyframes slatDown{
  from{transform:translateY(-100%);opacity:0}
  to{transform:translateY(0);opacity:1}
}

/* ── ALT RAY ── */
.rail{
  position:absolute;left:0;right:0;bottom:0;
  min-height:290px;
  display:flex;align-items:center;justify-content:center;
  padding:40px 24px 46px;
  background:
    linear-gradient(180deg, rgba(9,13,8,.55) 0%, rgba(9,13,8,.96) 42%, #070a06 100%);
  border-top:3px solid var(--kick-green);
  box-shadow:0 -26px 60px rgba(0,0,0,.6), 0 -2px 0 rgba(83,252,24,.25);
}
.rail-inner{text-align:center;max-width:640px}

.rail-top{
  display:flex;align-items:center;justify-content:center;gap:12px;margin-bottom:14px;
}
.rail-dot{
  width:7px;height:7px;border-radius:50%;background:var(--kick-green);
  box-shadow:0 0 12px rgba(83,252,24,.9);
  animation:blink 1.6s ease-in-out infinite;
}
@keyframes blink{0%,100%{opacity:1}50%{opacity:.25}}

.rail-label{
  font-family:'Chakra Petch',sans-serif;font-size:11px;font-weight:600;
  letter-spacing:4.5px;color:#6E8A62;
}

.rail-title{
  font-family:'Chakra Petch',sans-serif;
  font-size:clamp(40px,10vw,92px);
  font-weight:700;letter-spacing:8px;line-height:1;
  color:#EFFFEA;
  text-shadow:
    0 0 10px rgba(83,252,24,.55),
    0 0 34px rgba(83,252,24,.35),
    0 0 80px rgba(83,252,24,.18);
  margin:0 0 16px;
}
.rail-msg{
  font-size:15px;color:#A8BFA0;line-height:1.6;margin:0 0 22px;
}
.rail-meta{
  display:flex;gap:10px;justify-content:center;flex-wrap:wrap;
}
.rail-chip{
  display:inline-flex;align-items:center;gap:7px;
  font-size:12px;color:#8CA184;
  background:rgba(20,26,16,.85);
  border:1px solid rgba(83,252,24,.22);
  border-radius:999px;padding:7px 15px;
}
.pulse-chip{color:#B9E3A8;border-color:rgba(83,252,24,.35)}
.spinner{
  width:11px;height:11px;border-radius:50%;
  border:2px solid rgba(83,252,24,.25);
  border-top-color:var(--kick-green);
  animation:spin .8s linear infinite;
}
@keyframes spin{to{transform:rotate(360deg)}}

@media(max-width:560px){
  .rail{min-height:240px;padding:28px 16px 34px}
  .rail-title{letter-spacing:4px}
}
</style>
