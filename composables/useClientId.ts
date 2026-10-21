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

  // Kimlik hazır olana kadar bekletilebilmesi için promise
  let resolveReady!: (v: string) => void
  const ready = new Promise<string>((res) => { resolveReady = res })

  const generate = () =>
    (typeof crypto !== 'undefined' && crypto.randomUUID?.()) ||
    (Date.now().toString(36) + Math.random().toString(36).slice(2))

  onMounted(() => {
    let id = ''
    try {
      id = localStorage.getItem(CID_KEY) || ''
      if (!id) {
        id = generate()
        localStorage.setItem(CID_KEY, id)
      }
    } catch {
      // localStorage kapalıysa (gizli sekme) → geçici kimlik
      id = generate()
    }
    clientId.value = id
    resolveReady(id)
  })

  /** Sunucuya gönderilecek başlık değeri (hazır değilse boş → sunucu IP'ye düşer). */
  const header = computed(() => (clientId.value ? { 'x-client-id': clientId.value } : {}))

  /** Kimlik hazır olana kadar bekler (mount sırasından önce çağrılırsa). */
  const ensure = async () => {
    if (clientId.value) return clientId.value
    return await ready
  }

  return { clientId, header, ensure }
}
