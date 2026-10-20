/**
 * Tarayıcı sekmesi ikonunu (favicon) kanal logosu ile değiştirir.
 * Kanal logosu Kick'ten çekiliyor; yüklenene kadar statik yedek kullanılır.
 */
export function useFavicon(src: Ref<string | null | undefined>) {
  onMounted(() => {
    const apply = (url: string) => {
      let link = document.querySelector<HTMLLinkElement>('link[rel~="icon"]')
      if (!link) {
        link = document.createElement('link')
        link.rel = 'icon'
        document.head.appendChild(link)
      }
      link.type = 'image/svg+xml'
      link.href = url
    }

    // SSR sırasında veri geldiyse src.value zaten dolu olabilir → hemen uygula
    apply(src.value || '/favicon.svg')

    watch(src, (url) => { if (url) apply(url) })
  })
}
