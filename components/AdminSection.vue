<template>
  <section class="panel admin-section" :class="{ collapsed: !isOpen }">
    <button class="section-head" type="button" @click="toggle">
      <span class="section-title">{{ title }}</span>
      <span class="section-sub" v-if="sub">{{ sub }}</span>
      <span class="section-chevron">{{ isOpen ? '▾' : '▸' }}</span>
    </button>
    <div v-show="isOpen" class="section-body">
      <slot />
    </div>
  </section>
</template>

<script setup lang="ts">
const props = withDefaults(defineProps<{
  title: string
  sub?: string
  defaultOpen?: boolean
  /** Dışarıdan kontrol (opsiyonel) */
  open?: boolean
}>(), { defaultOpen: true, open: undefined })

const emit = defineEmits<{ (e: 'update:open', v: boolean): void }>()

const localOpen = ref(props.defaultOpen)
const isOpen = computed(() => props.open !== undefined ? props.open : localOpen.value)

function toggle() {
  const next = !isOpen.value
  if (props.open === undefined) localOpen.value = next
  emit('update:open', next)
}
</script>

<style scoped>
.admin-section{padding:0;overflow:hidden}
.section-head{
  width:100%;display:flex;align-items:center;gap:10px;
  background:transparent;border:none;cursor:pointer;
  padding:16px 20px;color:inherit;text-align:left;
  font-family:'Chakra Petch',sans-serif;
  transition:background .15s;
}
.section-head:hover{background:rgba(83,252,24,.05)}
.section-title{
  font-size:12px;letter-spacing:1.6px;text-transform:uppercase;color:var(--muted);
  font-weight:600;white-space:nowrap;
}
.section-sub{
  font-size:11px;color:#5E7255;letter-spacing:.3px;
  margin-left:auto;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:55%;
}
.section-chevron{
  color:var(--kick-green);font-size:13px;width:16px;text-align:center;flex-shrink:0;
}
.section-body{padding:0 20px 20px}
</style>
