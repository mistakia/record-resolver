// A real yt-dlp through the guarded proxy, against loopback servers only, so
// it needs no network. Runs when a yt-dlp is runnable from YTDLP_PATH or PATH;
// CI points YTDLP_PATH at the pinned release.
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'

import { ResolverError } from '../src/errors.ts'
import { with_guarded_proxy } from '../src/guarded-proxy.ts'
import { check_ytdlp_version, dump_json } from '../src/yt-dlp.ts'
import { answers_with, start_origin } from './helpers.ts'

const installed = await check_ytdlp_version().catch(() => undefined)
const TIMEOUT_MS = 30_000

async function rejection (promise: Promise<unknown>): Promise<ResolverError> {
  try {
    await promise
  } catch (error) {
    if (error instanceof ResolverError) return error
    throw error
  }
  throw new Error('expected a ResolverError')
}

describe.skipIf(installed === undefined)(`yt-dlp ${installed?.version ?? '(not installed)'} through the guarded proxy`, () => {
  let origin: Awaited<ReturnType<typeof start_origin>>
  beforeAll(async () => {
    origin = await start_origin((req, res, port) => {
      if (req.url === '/start') res.writeHead(302, { Location: `http://127.0.0.1:${port}/secret` }).end()
      else res.writeHead(200, { 'Content-Type': 'text/html' }).end('<html><head><title>no media</title></head><body></body></html>')
    })
  })
  afterAll(async () => { await origin.close() })

  // public.test stands in for a public name: the stub lookup approves it and
  // answers with the loopback origin. Every other host goes through the guard.
  const resolve_through_proxy = async (url: string) => await with_guarded_proxy({
    lookup: answers_with('127.0.0.1'),
    run: async (proxy_url) => await dump_json({ url, proxy_url, timeout_ms: TIMEOUT_MS })
  })

  const secret_hits = (): string[] => origin.hits.filter((hit) => hit.endsWith('/secret'))

  test('reaches a public-resolving page only through the proxy', async () => {
    const error = await rejection(resolve_through_proxy(`http://public.test:${origin.port}/page`))
    expect(error.code).toBe('UNSUPPORTED_URL')
    expect(origin.hits).toContain(`public.test:${origin.port} /page`)
  }, TIMEOUT_MS)

  test('a redirect from a public page to loopback is refused', async () => {
    const error = await rejection(resolve_through_proxy(`http://public.test:${origin.port}/start`))
    expect(error.code).toBe('BLOCKED_DESTINATION')
    expect(error.message).toBe('yt-dlp was refused a connection: 127.0.0.1 is a loopback address')
    expect(origin.hits).toContain(`public.test:${origin.port} /start`)
    expect(secret_hits()).toEqual([])
  }, TIMEOUT_MS)

  test('an https loopback URL is refused at CONNECT', async () => {
    const error = await rejection(resolve_through_proxy(`https://127.0.0.1:${origin.port}/secret`))
    expect(error.code).toBe('BLOCKED_DESTINATION')
    expect(secret_hits()).toEqual([])
  }, TIMEOUT_MS)

  test('a name that resolves to loopback is refused', async () => {
    const error = await rejection(with_guarded_proxy({
      run: async (proxy_url) => await dump_json({ url: `http://localhost:${origin.port}/secret`, proxy_url, timeout_ms: TIMEOUT_MS })
    }))
    expect(error.code).toBe('BLOCKED_DESTINATION')
    expect(error.message).toContain('localhost resolves to a loopback address')
    expect(secret_hits()).toEqual([])
  }, TIMEOUT_MS)
})
