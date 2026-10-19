<template>
  <div class="floats" aria-hidden="true">
    <span
      v-for="f in floats"
      :key="f.id"
      class="float"
      :class="f.side === 'yes' ? 'float-yes' : 'float-no'"
      :style="{ '--x': f.x + '%', '--s': f.scale }"
    >
      <span class="float-emoji">{{ f.side === 'yes' ? '✅' : '❌' }}</span>+1
    </span>
  </div>
</template>

<script setup lang="ts">
import type { FloatItem } from '~/composables/useVoteFloats'

defineProps<{ floats: FloatItem[] }>()
</script>

<style scoped>
.floats{
  position:absolute;inset:0;pointer-events:none;overflow:hidden;z-index:5;
}
.float{
  position:absolute;
  bottom:16%;
  transform:translateX(-50%) scale(var(--s));
  display:inline-flex;align-items:center;gap:4px;
  font-family:'Chakra Petch',sans-serif;font-weight:700;font-size:22px;
  animation:floatUp 2.4s cubic-bezier(.22,.8,.3,1) forwards;
  will-change:transform,opacity;
}
/* EVET butonunun üstü (sol yarı) / HAYIR butonunun üstü (sağ yarı) */
.float-yes{left:calc(25% + var(--x))}
.float-no{left:calc(75% + var(--x))}
.float-emoji{font-size:15px;filter:drop-shadow(0 0 6px rgba(0,0,0,.6))}
.float-yes{color:#53FC18;text-shadow:0 0 10px rgba(83,252,24,.9),0 0 26px rgba(83,252,24,.5)}
.float-no{color:#FF3B5C;text-shadow:0 0 10px rgba(255,59,92,.9),0 0 26px rgba(255,59,92,.5)}

@keyframes floatUp{
  0%{opacity:0;transform:translateX(-50%) translateY(6px) scale(calc(var(--s) * .6))}
  12%{opacity:1;transform:translateX(-50%) translateY(-6px) scale(calc(var(--s) * 1.15))}
  100%{opacity:0;transform:translateX(-50%) translateY(-130px) scale(var(--s))}
}
</style>
