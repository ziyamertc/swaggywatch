<template>
  <div v-if="visible" class="dev-credit">
    <span class="dev-line" aria-hidden="true"></span>
    <a
      class="dev-link"
      :href="url || undefined"
      target="_blank"
      rel="noopener noreferrer"
      :title="name || 'developer'"
    >
      <span class="dev-prefix">{{ label }}</span>
      <span class="dev-name">{{ name }}</span>
      <span class="dev-arrow" aria-hidden="true">↗</span>
    </a>
  </div>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  /** Düz ön ek — "Developed by" */
  label?: string
  /** Parlak nickname */
  name?: string
  /** Tıklanınca gidilecek adres */
  url?: string
  /** Gizli mi */
  visible?: boolean
}>(), {
  label: 'Developed by',
  name: 'zmchampion',
  url: 'https://guns.lol/zmchampion',
  visible: true
})
</script>

<style scoped>
.dev-credit{
  margin-top:6px;
  display:flex;flex-direction:column;align-items:center;gap:10px;
}
.dev-line{
  width:120px;height:1px;
  background:linear-gradient(90deg, transparent, var(--border) 30%, var(--border) 70%, transparent);
  opacity:.8;
}
.dev-link{
  display:inline-flex;align-items:center;gap:8px;
  text-decoration:none;
  font-family:'Chakra Petch',sans-serif;
  transition:transform .25s ease;
}
.dev-link:hover{transform:translateY(-1px)}

.dev-prefix{
  font-size:11px;letter-spacing:2.6px;text-transform:uppercase;
  color:#4A5C42;
  transition:color .25s ease;
}
.dev-link:hover .dev-prefix{color:#6E8A62}

.dev-name{
  font-size:14px;font-weight:700;letter-spacing:1.4px;
  background:linear-gradient(92deg, #53FC18 0%, #B6FF8E 45%, #EFFFEA 100%);
  -webkit-background-clip:text;background-clip:text;
  -webkit-text-fill-color:transparent;color:transparent;
  text-shadow:0 0 18px rgba(83,252,24,.28);
  transition:text-shadow .25s ease, filter .25s ease;
  filter:brightness(.92);
}
.dev-link:hover .dev-name{
  text-shadow:0 0 24px rgba(83,252,24,.6);
  filter:brightness(1.12);
}

.dev-arrow{
  font-size:10px;color:#4A5C42;
  transform:translate(0,0);
  transition:transform .25s ease, color .25s ease;
}
.dev-link:hover .dev-arrow{transform:translate(2px,-2px);color:var(--kick-green)}
</style>
