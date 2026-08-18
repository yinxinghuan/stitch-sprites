const params = new URLSearchParams(window.location.search)
const rawOrigin = params.get('api_origin')

export const apiOrigin = rawOrigin ? decodeURIComponent(rawOrigin) : null
export const playerId = params.get('telegram_id')
export const isAigramPlayer = Boolean(apiOrigin && playerId && playerId !== '__alteru_guest__')

interface BridgeResult<T = unknown> {
  request_id: string
  success: boolean
  data?: T
  error?: string
}

export interface AigramResponse<T = unknown> {
  retcode: number
  errcode?: number
  msg: string
  data: T
}

function toBase64(value: string): string {
  return btoa(unescape(encodeURIComponent(value)))
}

function fromBase64(value: string): string {
  return decodeURIComponent(escape(atob(value)))
}

export function callAigramAPI<T = unknown>(
  url: string,
  method: 'GET' | 'POST' = 'GET',
  data: unknown = null,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const callbackHost = window as unknown as Record<string, unknown>
    const requestId = crypto.randomUUID()
    let timer: ReturnType<typeof setTimeout>
    const payload = toBase64(JSON.stringify({
      url,
      method,
      data,
      request_id: requestId,
      emitter: window.location.origin,
    }))

    function cleanup(): void {
      window.removeEventListener('message', handler)
      try {
        delete callbackHost[callbackKey]
      } catch {
        callbackHost[callbackKey] = undefined
      }
    }

    function handleResult(result: BridgeResult<T>): void {
      clearTimeout(timer)
      cleanup()
      if (result.success) resolve(result.data as T)
      else reject(new Error(result.error || 'API error'))
    }

    const callbackKey = `__aigram_cb_${requestId.replaceAll('-', '_')}`
    callbackHost[callbackKey] = (resultJson: string) => {
      try {
        const result = JSON.parse(resultJson) as BridgeResult<T>
        if (result.request_id === requestId) handleResult(result)
      } catch {
        // Malformed native response will time out.
      }
    }

    function handler(event: MessageEvent): void {
      if (apiOrigin && event.origin !== apiOrigin) return
      const message = typeof event.data === 'string' ? event.data : ''
      if (!message.startsWith('callAPIResult-')) return
      try {
        const result = JSON.parse(fromBase64(message.slice('callAPIResult-'.length))) as BridgeResult<T>
        if (result.request_id === requestId) handleResult(result)
      } catch {
        // Ignore unrelated or malformed messages.
      }
    }
    window.addEventListener('message', handler)

    timer = window.setTimeout(() => {
      cleanup()
      reject(new Error('timeout'))
    }, 10_000)

    const host = window as Window & { webkit?: { messageHandlers?: { aigram?: { postMessage: (message: string) => void } } } }
    if (host.webkit?.messageHandlers?.aigram) host.webkit.messageHandlers.aigram.postMessage(`callAPI-${payload}`)
    else window.parent.postMessage(`callAPI-${payload}`, apiOrigin || '*')
  })
}

export function postAigramAPI(url: string, data: unknown): void {
  const payload = toBase64(JSON.stringify({
    url,
    method: 'post',
    data,
    request_id: crypto.randomUUID(),
    emitter: window.location.origin,
  }))
  const host = window as Window & { webkit?: { messageHandlers?: { aigram?: { postMessage: (message: string) => void } } } }
  if (host.webkit?.messageHandlers?.aigram) host.webkit.messageHandlers.aigram.postMessage(`callAPI-${payload}`)
  else window.parent.postMessage(`callAPI-${payload}`, apiOrigin || '*')
}

export function openAigramProfile(userId: string): void {
  if (!userId || !apiOrigin) return
  const message = `AW.PROFILE.OPEN-${btoa(JSON.stringify({ id: userId }))}`
  const host = window as Window & { webkit?: { messageHandlers?: { aigram?: { postMessage: (message: string) => void } } } }
  if (host.webkit?.messageHandlers?.aigram) host.webkit.messageHandlers.aigram.postMessage(message)
  else window.parent.postMessage(message, new URL(apiOrigin).origin)
}
