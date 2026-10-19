/**
 * Uçuşan "+1" animasyonları — oy veren tarafa göre yeşil (EVET) / kırmızı (HAYIR).
 */
export interface FloatItem {
  id: number
  side: 'yes' | 'no'
  x: number      // yatay sapma (%)
  scale: number  // boyut çarpanı
}

export function useVoteFloats(max = 16) {
  const floats = ref<FloatItem[]>([])
  let counter = 0

  function push(side: 'yes' | 'no') {
    const id = ++counter
    const item: FloatItem = {
      id,
      side,
      x: Math.round(Math.random() * 26) - 13,     // -13% … +13%
      scale: 0.85 + Math.random() * 0.4
    }
    floats.value = [...floats.value.slice(-(max - 1)), item]
    setTimeout(() => {
      floats.value = floats.value.filter(f => f.id !== id)
    }, 2600)
  }

  function clear() {
    floats.value = []
  }

  return { floats, push, clear }
}
