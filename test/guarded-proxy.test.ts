import { afterEach, describe, expect, test } from 'bun:test'
import { connect, createServer, type AddressInfo, type LookupFunction, type Socket } from 'node:net'

import { ResolverError } from '../src/errors.ts'
import { start_guarded_proxy, with_guarded_proxy, type GuardedProxy } from '../src/guarded-proxy.ts'
import { answers_with, start_origin } from './helpers.ts'

const port_of = (url: string): number => Number(new URL(url).port)

// Writes `text` to the proxy and returns everything it sends back before
// closing the connection.
const exchange = async (proxy: GuardedProxy, text: string): Promise<string> => await new Promise((resolve, reject) => {
  const socket = connect({ host: '127.0.0.1', port: port_of(proxy.url) })
  let received = ''
  socket.setEncoding('utf8')
  socket.on('data', (chunk: string) => { received += chunk })
  socket.on('error', reject)
  socket.on('close', () => { resolve(received) })
  socket.write(text)
})

const get = (target: string): string => `GET ${target} HTTP/1.1\r\nHost: ${new URL(target).host}\r\nProxy-Connection: keep-alive\r\nConnection: close\r\n\r\n`
const connect_to = (authority: string): string => `CONNECT ${authority} HTTP/1.1\r\nHost: ${authority}\r\n\r\n`
const tunneled_get = 'GET /tunneled HTTP/1.1\r\nHost: public.test\r\nConnection: close\r\n\r\n'

let cleanup: Array<() => Promise<void>> = []
afterEach(async () => {
  for (const close of cleanup) await close()
  cleanup = []
})

async function setup ({ lookup }: { lookup?: LookupFunction } = {}) {
  const origin = await start_origin()
  const proxy = await start_guarded_proxy({ lookup })
  cleanup.push(proxy.close, origin.close)
  return { origin, proxy }
}

describe('start_guarded_proxy refuses a non-public destination', () => {
  test('CONNECT to a loopback literal', async () => {
    const { origin, proxy } = await setup()
    const response = await exchange(proxy, connect_to(`127.0.0.1:${origin.port}`))
    expect(response).toStartWith('HTTP/1.1 403 Forbidden')
    expect(response).toContain('127.0.0.1 is a loopback address')
    expect(origin.hits).toEqual([])
    expect(proxy.refusals.map((refusal) => refusal.code)).toEqual(['BLOCKED_DESTINATION'])
  })

  test('CONNECT to an IPv6 loopback literal', async () => {
    const { origin, proxy } = await setup()
    expect(await exchange(proxy, connect_to(`[::1]:${origin.port}`))).toStartWith('HTTP/1.1 403')
  })

  test('CONNECT to a name that resolves to loopback', async () => {
    const { origin, proxy } = await setup()
    const response = await exchange(proxy, connect_to(`localhost:${origin.port}`))
    expect(response).toStartWith('HTTP/1.1 403')
    expect(response).toContain('localhost resolves to a loopback address')
  })

  test('plain GET to a loopback literal', async () => {
    const { origin, proxy } = await setup()
    const response = await exchange(proxy, get(`http://127.0.0.1:${origin.port}/secret`))
    expect(response).toStartWith('HTTP/1.1 403')
    expect(origin.hits).toEqual([])
    expect(proxy.refusals).toHaveLength(1)
  })

  test('plain GET to an IPv4-mapped IPv6 loopback literal', async () => {
    const { origin, proxy } = await setup()
    expect(await exchange(proxy, get(`http://[::ffff:127.0.0.1]:${origin.port}/`))).toStartWith('HTTP/1.1 403')
  })

  test('plain GET to a name that resolves to loopback', async () => {
    const { origin, proxy } = await setup()
    expect(await exchange(proxy, get(`http://localhost:${origin.port}/`))).toStartWith('HTTP/1.1 403')
    expect(origin.hits).toEqual([])
  })

  test('checks an IP literal itself, whatever the lookup answers', async () => {
    const { origin, proxy } = await setup({ lookup: answers_with('127.0.0.1') })
    expect(await exchange(proxy, connect_to(`127.0.0.1:${origin.port}`))).toStartWith('HTTP/1.1 403')
    expect(await exchange(proxy, get(`http://169.254.169.254:${origin.port}/latest/meta-data/`))).toStartWith('HTTP/1.1 403')
  })
})

// answers_with stands in for a public name's resolution here: it approves the
// name and answers with the loopback origin's address.
describe('start_guarded_proxy allows a public-resolving destination', () => {
  test('plain GET is forwarded in origin form without the proxy headers', async () => {
    const { origin, proxy } = await setup({ lookup: answers_with('127.0.0.1') })
    const response = await exchange(proxy, get(`http://public.test:${origin.port}/page?q=1`))
    expect(response).toStartWith('HTTP/1.1 200')
    expect(response).toEndWith('reached')
    expect(origin.hits).toEqual([`public.test:${origin.port} /page?q=1`])
    expect(proxy.refusals).toEqual([])
  })

  test('CONNECT tunnels bytes both ways', async () => {
    const { origin, proxy } = await setup({ lookup: answers_with('127.0.0.1') })
    const response = await exchange(proxy, `${connect_to(`public.test:${origin.port}`)}${tunneled_get}`)
    expect(response).toStartWith('HTTP/1.1 200 Connection Established\r\n\r\nHTTP/1.1 200 OK')
    expect(response).toEndWith('reached')
    expect(origin.hits).toEqual(['public.test /tunneled'])
  })

  test('falls back to the next approved address when one refuses', async () => {
    const { origin, proxy } = await setup({ lookup: answers_with('::1', '127.0.0.1') })
    expect(await exchange(proxy, get(`http://public.test:${origin.port}/`))).toEndWith('reached')
  })
})

describe('start_guarded_proxy rejects what it does not proxy', () => {
  test('400 for an origin-form request', async () => {
    const { proxy } = await setup()
    expect(await exchange(proxy, 'GET / HTTP/1.1\r\nHost: x\r\nConnection: close\r\n\r\n')).toStartWith('HTTP/1.1 400')
  })

  test('400 for an absolute-form https request', async () => {
    const { proxy } = await setup()
    expect(await exchange(proxy, get('https://public.test/'))).toStartWith('HTTP/1.1 400')
  })

  test('400 for a CONNECT without a valid port', async () => {
    const { proxy } = await setup()
    expect(await exchange(proxy, connect_to('public.test'))).toStartWith('HTTP/1.1 400')
    expect(await exchange(proxy, connect_to('public.test:0'))).toStartWith('HTTP/1.1 400')
    expect(await exchange(proxy, connect_to('public.test:65536'))).toStartWith('HTTP/1.1 400')
  })

  test('502 for a name that does not resolve, which is not a refusal', async () => {
    const lookup: LookupFunction = (_hostname, _options, done) => {
      done(Object.assign(new Error('getaddrinfo ENOTFOUND nowhere.invalid'), { code: 'ENOTFOUND' }), [])
    }
    const { proxy } = await setup({ lookup })
    expect(await exchange(proxy, connect_to('nowhere.invalid:443'))).toStartWith('HTTP/1.1 502')
    expect(proxy.refusals).toEqual([])
  })
})

describe('closing the proxy', () => {
  test('tears down an open tunnel on both sides and stops listening', async () => {
    const held: Socket[] = []
    const origin = createServer((socket) => { held.push(socket) })
    await new Promise<void>((resolve) => origin.listen(0, '127.0.0.1', resolve))
    const origin_port = (origin.address() as AddressInfo).port
    const proxy = await start_guarded_proxy({ lookup: answers_with('127.0.0.1') })
    const port = port_of(proxy.url)

    const client = connect({ host: '127.0.0.1', port })
    const established = new Promise<void>((resolve) => { client.once('data', () => { resolve() }) })
    client.write(connect_to(`public.test:${origin_port}`))
    await established
    const client_closed = new Promise<void>((resolve) => { client.once('close', () => { resolve() }) })
    const origin_side_closed = new Promise<void>((resolve) => { held[0]?.once('close', () => { resolve() }) })

    await proxy.close()
    await Promise.all([client_closed, origin_side_closed])
    const refused = await new Promise<string | undefined>((resolve) => {
      const probe = connect({ host: '127.0.0.1', port })
      probe.once('connect', () => { probe.destroy(); resolve(undefined) })
      probe.once('error', (error: NodeJS.ErrnoException) => { resolve(error.code) })
    })
    expect(refused).toBe('ECONNREFUSED')
    await new Promise<void>((resolve) => origin.close(() => { resolve() }))
  })

  test('close is idempotent', async () => {
    const proxy = await start_guarded_proxy()
    await Promise.all([proxy.close(), proxy.close()])
    await proxy.close()
  })
})

describe('with_guarded_proxy', () => {
  const failed = new ResolverError({ code: 'YTDLP_FAILED', message: 'yt-dlp exited 1: ERROR: HTTP Error 403: Forbidden', url: 'https://public.test/', stderr: 'ERROR: HTTP Error 403: Forbidden' })

  async function rejection (promise: Promise<unknown>): Promise<ResolverError> {
    try {
      await promise
    } catch (error) {
      if (error instanceof ResolverError) return error
      throw error
    }
    throw new Error('expected a ResolverError')
  }

  test('reports a yt-dlp failure after a refusal as BLOCKED_DESTINATION', async () => {
    const error = await rejection(with_guarded_proxy({
      run: async (proxy_url) => {
        await exchange({ url: proxy_url } as GuardedProxy, get('http://10.0.0.5/'))
        throw failed
      }
    }))
    expect(error.code).toBe('BLOCKED_DESTINATION')
    expect(error.message).toBe('yt-dlp was refused a connection: 10.0.0.5 is a private address')
    expect(error.url).toBe('https://public.test/')
    expect(error.stderr).toBe(failed.stderr)
    expect(error.cause).toBe(failed)
  })

  test('leaves a failure without a refusal as it is', async () => {
    expect(await rejection(with_guarded_proxy({ run: async () => { throw failed } }))).toBe(failed)
  })

  test('leaves a timeout as a timeout, even after a refusal', async () => {
    const timeout = new ResolverError({ code: 'YTDLP_TIMEOUT', message: 'yt-dlp did not finish within 1ms' })
    const error = await rejection(with_guarded_proxy({
      run: async (proxy_url) => {
        await exchange({ url: proxy_url } as GuardedProxy, connect_to('127.0.0.1:443'))
        throw timeout
      }
    }))
    expect(error).toBe(timeout)
  })

  test('closes the proxy when run throws', async () => {
    let port = 0
    await rejection(with_guarded_proxy({ run: async (proxy_url) => { port = port_of(proxy_url); throw failed } }))
    const code = await new Promise<string | undefined>((resolve) => {
      const probe = connect({ host: '127.0.0.1', port })
      probe.once('connect', () => { probe.destroy(); resolve(undefined) })
      probe.once('error', (error: NodeJS.ErrnoException) => { resolve(error.code) })
    })
    expect(code).toBe('ECONNREFUSED')
  })
})
