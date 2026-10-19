export default defineNuxtConfig({
  compatibilityDate: '2024-11-01',
  devtools: { enabled: false },
  css: ['~/assets/css/main.css'],
  app: {
    head: {
      title: 'Swaggybark • Beklenti Paneli',
      htmlAttrs: { lang: 'tr' },
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'description', content: 'Swaggybart — Swaggybark Kick kanalı için canlı Evet/Hayır beklenti paneli. Günde 1 oy, gece 03:00 sıfırlama, yayın başlayınca otomatik kapanır.' }
      ],
      link: [
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@500;600;700&family=Inter:wght@400;500;600;700&display=swap' }
      ]
    }
  },
  nitro: {
    // Yalnızca bir sunucu tarafı bağımlılığı: mongoose
    // (Deno Deploy preset'i denenirken mongodb'in AWS bağımlılıklarının
    //  paketlenmeye çalışılmasını engelliyoruz)
    externals: {
      external: [
        'mongoose',
        'mongodb',
        'mongodb-memory-server',
        '@aws-sdk/credential-providers',
        '@aws-sdk/credential-provider-node',
        '@aws-sdk/types',
        'aws4',
        'aws-crt',
        'gcp-metadata',
        'socks',
        'tslib'
      ]
    }
  }
})
