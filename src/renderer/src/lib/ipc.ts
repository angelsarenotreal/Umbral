import type { UmbralAPI } from '@shared/types'

declare global {
  interface Window {
    api: UmbralAPI
    electron: any
  }
}

export const api = {
  get vault() { return window.api.vault },
  get settings() { return window.api.settings },
  get app() { return window.api.app },
  get crypto() { return window.api.crypto },
  get overlay() { return window.api.overlay },
  get riot() { return window.api.riot },
  get clipboard() { return window.api.clipboard },
  get shell() { return window.api.shell },
}

export async function withVault<T>(fn: () => Promise<{ status: string; data?: T; error?: string }>): Promise<T> {
  const result = await fn()
  if (result.status === 'error') throw new Error(result.error)
  return result.data as T
}
