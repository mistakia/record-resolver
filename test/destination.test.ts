import { describe, expect, test } from 'bun:test'
import { createServer, request, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'

import { address_class, assert_public_destination, guarded_lookup, type LookupAll } from '../src/destination.ts'
import { ResolverError } from '../src/errors.ts'
import { resolve_url } from '../src/resolve.ts'
import { FAKE_YTDLP } from './helpers.ts'

async function rejection (promise: Promise<unknown>): Promise<ResolverError> {
  try {
    await promise
  } catch (error) {
    if (error instanceof ResolverError) return error
    throw error
  }
  throw new Error('expected a ResolverError')
}

const resolves_to = (...addresses: string[]): LookupAll => async () =>
  addresses.map((address) => ({ address, family: address.includes(':') ? 6 : 4 }))

describe('address_class', () => {
  const CASES: Array<[string, string]> = [
    ['0.0.0.0', 'unspecified'],
    ['::', 'unspecified'],
    ['127.0.0.1', 'loopback'],
    ['127.255.0.9', 'loopback'],
    ['::1', 'loopback'],
    ['10.1.2.3', 'private'],
    ['172.16.0.1', 'private'],
    ['172.31.255.255', 'private'],
    ['192.168.1.1', 'private'],
    ['100.64.0.1', 'shared'],
    ['100.127.255.255', 'shared'],
    ['169.254.169.254', 'link-local'],
    ['fe80::1', 'link-local'],
    ['fe80::1%en0', 'link-local'],
    ['fc00::1', 'unique-local'],
    ['fd12:3456::1', 'unique-local'],
    ['fec0::1', 'site-local'],
    ['224.0.0.1', 'multicast'],
    ['239.255.255.250', 'multicast'],
    ['ff02::1', 'multicast'],
    ['255.255.255.255', 'reserved'],
    ['::ffff:127.0.0.1', 'loopback'],
    ['::ffff:7f00:1', 'loopback'],
    ['::ffff:10.0.0.1', 'private'],
    ['::ffff:169.254.169.254', 'link-local'],
    ['64:ff9b::7f00:1', 'loopback'],
    ['2002:c0a8:101::1', 'private'],
    ['[::1]', 'loopback'],
    ['localhost', 'reserved']
  ]

  for (const [address, expected] of CASES) {
    test(`${address} is ${expected}`, () => {
      expect(address_class(address)).toBe(expected as never)
    })
  }

  for (const address of ['93.184.215.14', '8.8.8.8', '172.32.0.1', '100.128.0.1', '2606:4700::1111', '::ffff:93.184.215.14', '2002:5db8:d70e::1']) {
    test(`${address} is public`, () => {
      expect(address_class(address)).toBeUndefined()
    })
  }
})

describe('assert_public_destination', () => {
  test('passes a host whose every address is public', async () => {
    await assert_public_destination('https://example.com/a', { lookup: resolves_to('93.184.215.14', '2606:2800:21f:cb07:6820:80da:af6b:8b2c') })
  })

  test('refuses a host when any one resolved address is not public', async () => {
    const error = await rejection(assert_public_destination('https://example.com/a', { lookup: resolves_to('93.184.215.14', '10.0.0.5') }))
    expect(error.code).toBe('BLOCKED_DESTINATION')
    expect(error.message).toBe('example.com resolves to a private address, 10.0.0.5')
  })

  test('refuses an IP literal without a lookup', async () => {
    const lookup: LookupAll = async () => { throw new Error('looked up a literal') }
    for (const url of ['http://127.0.0.1:5001/api', 'http://[::1]/', 'http://[::ffff:127.0.0.1]/', 'http://0x7f.1/', 'http://169.254.169.254/latest/meta-data/']) {
      expect((await rejection(assert_public_destination(url, { lookup }))).code).toBe('BLOCKED_DESTINATION')
    }
  })

  test('INVALID_URL for a host that does not resolve', async () => {
    const lookup: LookupAll = async () => { throw Object.assign(new Error('getaddrinfo ENOTFOUND'), { code: 'ENOTFOUND' }) }
    const error = await rejection(assert_public_destination('https://nowhere.invalid/', { lookup }))
    expect(error.code).toBe('INVALID_URL')
    expect(error.message).toContain('ENOTFOUND')
  })
})

describe('resolve_url destination check', () => {
  test('refuses a host that resolves inward before yt-dlp runs', async () => {
    const error = await rejection(resolve_url('https://internal.example/', { binary_path: '/nonexistent/yt-dlp', lookup: resolves_to('192.168.1.10') }))
    expect(error.code).toBe('BLOCKED_DESTINATION')
  })

  test('refuses localhost through the system resolver', async () => {
    const error = await rejection(resolve_url('http://localhost:8080/', { binary_path: FAKE_YTDLP }))
    expect(error.code).toBe('BLOCKED_DESTINATION')
  })
})

describe('guarded_lookup', () => {
  const with_server = async (run: (port: number) => Promise<void>): Promise<void> => {
    const server: Server = createServer((_req, res) => { res.end('reached') })
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    try {
      await run((server.address() as AddressInfo).port)
    } finally {
      server.close()
    }
  }

  const get = async (port: number): Promise<string> => await new Promise((resolve, reject) => {
    const req = request({ host: 'localhost', port, path: '/', lookup: guarded_lookup }, (res) => {
      res.resume()
      res.on('end', () => { resolve(String(res.statusCode)) })
    })
    req.on('error', reject)
    req.end()
  })

  test('refuses the connection when the host resolves to loopback', async () => {
    await with_server(async (port) => {
      const error = await get(port).then(() => undefined, (error: unknown) => error)
      expect(error).toBeInstanceOf(ResolverError)
      expect((error as ResolverError).code).toBe('BLOCKED_DESTINATION')
    })
  })
})
