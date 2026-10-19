import { listEndedPolls } from '../../utils/poll-service'

/** GET /api/poll/history — bitmiş günlerin arşivi (yeniden eskiye, en fazla 60 gün). */
export default defineEventHandler(async () => {
  const polls = await listEndedPolls(60)
  return { polls }
})
