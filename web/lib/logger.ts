const isProd = process.env.NODE_ENV === 'production'

export function logError(context: string, error: unknown, meta?: Record<string, unknown>) {
  const message = error instanceof Error ? error.message : String(error)
  const stack = error instanceof Error ? error.stack : undefined

  if (isProd) {
    // 향후 Sentry: Sentry.captureException(error, { extra: { context, ...meta } })
    console.error(JSON.stringify({ level: 'error', context, message, meta, ts: new Date().toISOString() }))
  } else {
    console.error(`[${context}]`, message, meta ?? '', stack ?? '')
  }
}

export function logInfo(context: string, message: string, meta?: Record<string, unknown>) {
  if (!isProd) {
    console.info(`[${context}] ${message}`, meta ?? '')
  }
}
