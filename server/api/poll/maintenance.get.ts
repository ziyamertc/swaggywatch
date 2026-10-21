import { getMaintenance } from '../../utils/settings'

/**
 * GET /api/poll/maintenance → bakım modu durumu
 * (public: herkes görebilir, sadece bilgi)
 */
export default defineEventHandler(async () => {
  const maintenance = await getMaintenance()
  return { maintenance }
})
