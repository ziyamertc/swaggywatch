/**
 * Kick kanal bilgisi: profil fotoğrafı (avatar), kapak, kullanıcı adı, takipçi sayısı.
 * 30 dakika önbelleklenir — Kick'e her istekte vurulmaz.
 */
const CHANNEL = process.env.KICK_CHANNEL || 'swaggybark'
const UA = process.env.KICK_UA || 'swaggybark-panel/1.0'
const TTL = 30 * 60 * 1000

export interface ChannelInfo {
  ok: boolean
  avatar: string | null
  banner: string | null
  username: string | null
  followers: number | null
  live: boolean
}

const g = globalThis as any
if (!g.__swaggybark_channelCache) g.__swaggybark_channelCache = { at: 0, value: null }
const cache = g.__swaggybark_channelCache as { at: number; value: ChannelInfo | null }

const empty: ChannelInfo = { ok: false, avatar: null, banner: null, username: null, followers: null, live: false }

export async function getChannelInfo(): Promise<ChannelInfo> {
  const now = Date.now()
  if (cache.value && now - cache.at < TTL) return cache.value

  let value: ChannelInfo = { ...empty }
  try {
    const headers: Record<string, string> = { Accept: 'application/json' }
    if (UA) headers['User-Agent'] = UA

    const data: any = await $fetch<any>(`https://kick.com/api/v2/channels/${CHANNEL}`, {
      headers, timeout: 8000, retry: 0
    })

    const followers = Number(data?.followers_count)
    value = {
      ok: true,
      avatar: data?.user?.profile_pic ?? null,
      banner: data?.banner_image?.url ?? null,
      username: data?.user?.username ?? null,
      followers: Number.isFinite(followers) ? followers : null,
      live: !!data?.livestream
    }
  } catch (err: any) {
    console.warn('[kick] kanal bilgisi alınamadı:', err?.message || err)
    value = { ...empty }
  }

  cache.at = now
  cache.value = value
  return value
}
