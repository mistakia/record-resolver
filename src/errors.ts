export const RESOLVER_ERROR_CODES = [
  'MISSING_URL',
  'INVALID_URL',
  'UNSUPPORTED_URL',
  'YTDLP_NOT_FOUND',
  'YTDLP_FAILED',
  'YTDLP_TIMEOUT',
  'YTDLP_INVALID_OUTPUT'
] as const

export type ResolverErrorCode = typeof RESOLVER_ERROR_CODES[number]

export class ResolverError extends Error {
  readonly code: ResolverErrorCode
  readonly url: string | undefined
  readonly stderr: string | undefined

  constructor ({ code, message, url, stderr, cause }: {
    code: ResolverErrorCode
    message: string
    url?: string | undefined
    stderr?: string | undefined
    cause?: unknown
  }) {
    super(message, cause === undefined ? undefined : { cause })
    this.name = 'ResolverError'
    this.code = code
    this.url = url
    this.stderr = stderr
  }
}
