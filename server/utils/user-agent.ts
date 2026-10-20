/**
 * Kullanıcı aracısı (User-Agent) analizi — bağımlılıksız, hafif.
 * Amaç: log tablosunda "Chrome / Windows" gibi okunabilir bir sütun göstermek.
 */
export interface DeviceInfo {
  browser: string
  os: string
  device: string
}

export function parseUserAgent(ua: string): DeviceInfo {
  const s = (ua || '').toLowerCase()

  let browser = 'Diğer'
  if (s.includes('edg/') || s.includes('edge/')) browser = 'Edge'
  else if (s.includes('opr/') || s.includes('opera')) browser = 'Opera'
  else if (s.includes('brave')) browser = 'Brave'
  else if (s.includes('vivaldi')) browser = 'Vivaldi'
  else if (s.includes('firefox')) browser = 'Firefox'
  else if (s.includes('samsungbrowser')) browser = 'Samsung Internet'
  else if (s.includes('crios')) browser = 'Chrome (iOS)'
  else if (s.includes('fxios')) browser = 'Firefox (iOS)'
  else if (s.includes('chrome') || s.includes('chromium')) browser = 'Chrome'
  else if (s.includes('safari')) browser = 'Safari'
  else if (s.includes('curl')) browser = 'curl'
  else if (s.includes('bot') || s.includes('spider')) browser = 'Bot'

  let os = 'Bilinmiyor'
  if (s.includes('windows nt 10') || s.includes('windows nt 11')) os = 'Windows'
  else if (s.includes('windows')) os = 'Windows'
  else if (s.includes('android')) os = 'Android'
  else if (s.includes('iphone') || s.includes('ipad') || s.includes('ios')) os = 'iOS'
  else if (s.includes('mac os x') || s.includes('macintosh')) os = 'macOS'
  else if (s.includes('cros')) os = 'ChromeOS'
  else if (s.includes('linux')) os = 'Linux'

  let device = 'Masaüstü'
  if (s.includes('mobile') || s.includes('iphone') || s.includes('android')) device = 'Mobil'
  else if (s.includes('ipad') || s.includes('tablet')) device = 'Tablet'

  return { browser, os, device }
}
