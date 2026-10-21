/**
 * Cihaz kimliği (client id).
 *
 * "Günde 1 oy" kuralı IP'ye göre çalışırsa mobil operatörlerin CGNAT'i
 * (yüzlerce abone tek IP) izleyicilerin çoğunu engeller. Bu yüzden birincil
 * kimlik tarayıcıda saklanan rastgele bir UUID'dir.
 */
const CID_KEY = 'swaggybark_cid'

export function useClientId() {
  const clientId = ref('')

  onMounted(() => {
    let id = ''
    try {
      id = localStorage.getItem(CID_KEY) || ''
      if (!id) {
        id = (crypto?.randomUUID?.() || (Date.now().toString(36) + Math.random().toString(36).slice(2)))
        localStorage.setItem(CID_KEY, id)
      }
    } catch {
      // localStorage kapalıysa (gizli sekme) → oturum bazlı geçici kimlik
      id = (crypto?.randomUUID?.() || (Date.now().toString(36) + Math.random().toString(36).slice(2)))
    }
    clientId.value = id
  })

  /** Sunucuya gönderilecek başlık değeri (hazır değilse boş → sunucu IP'ye düşer). */
  const header = computed(() => (clientId.value ? { 'x-client-id': clientId.value } : {}))

  return { clientId, header }
}
