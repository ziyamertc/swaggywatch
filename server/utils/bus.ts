import { EventEmitter } from 'node:events'

/**
 * Sunucu içi olay veriyolu (EventEmitter).
 * Oy verildiğinde / yayıncı oylamayı aç-kapattığında SSE istemcilerine anında bildirilir.
 *
 * Not: Sunucusuz (serverless) ortamda her instance kendi bus'unu taşır —
 * bu yüzden SSE asıl güncelleme kaynağı, yoklama (polling) ise yedek yoldur.
 */
const g = globalThis as any
if (!g.__swaggybark_bus) {
  const bus = new EventEmitter()
  bus.setMaxListeners(0)
  g.__swaggybark_bus = bus
}

export const bus = g.__swaggybark_bus as EventEmitter

export interface PollEvent {
  type: 'vote' | 'state'
  choice?: 'yes' | 'no'
  poll: Record<string, any>
}

export function emitPollEvent(evt: PollEvent) {
  bus.emit('poll', evt)
}
