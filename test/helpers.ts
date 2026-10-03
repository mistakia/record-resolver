import { readFileSync } from 'node:fs'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { isIP, type AddressInfo, type LookupFunction } from 'node:net'
import { join } from 'node:path'

export const FIXTURES_DIR = join(import.meta.dir, 'fixtures')
export const FAKE_YTDLP = join(FIXTURES_DIR, 'fake-yt-dlp.mjs')

export function load_fixture (name: string): unknown[] {
  return readFileSync(join(FIXTURES_DIR, 'yt-dlp', `${name}.jsonl`), 'utf8')
    .split('\n')
    .filter((line) => line !== '')
    .map((line) => JSON.parse(line) as unknown)
}

const FAKE_ENV_KEYS = ['FAKE_YTDLP_FIXTURE', 'FAKE_YTDLP_MODE', 'FAKE_YTDLP_VERSION', 'FAKE_YTDLP_ARGV_FILE', 'YTDLP_PATH']

// Sets the fake's env for one test; the returned function restores it.
export function set_fake_env (values: Record<string, string>): () => void {
  const saved = Object.fromEntries(FAKE_ENV_KEYS.map((key) => [key, process.env[key]]))
  for (const key of FAKE_ENV_KEYS) Reflect.deleteProperty(process.env, key)
  Object.assign(process.env, values)
  return () => {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) Reflect.deleteProperty(process.env, key)
      else process.env[key] = value
    }
  }
}

// A proxy lookup that answers every name with these addresses, unchecked. It
// stands in for a public name's resolution while connecting to a local server.
export const answers_with = (...addresses: string[]): LookupFunction => (_hostname, { all = false }, done) => {
  const found = addresses.map((address) => ({ address, family: isIP(address) }))
  if (all) done(null, found)
  else done(null, found[0]?.address ?? '', found[0]?.family)
}

// A loopback HTTP server that records `host path` for every request it gets.
// `handle` answers; the default replies 200 "reached".
export async function start_origin (handle?: (req: IncomingMessage, res: ServerResponse, port: number) => void): Promise<{ port: number, hits: string[], close: () => Promise<void> }> {
  const hits: string[] = []
  const server = createServer((req, res) => {
    hits.push(`${req.headers.host ?? ''} ${req.url ?? ''}`)
    if (handle === undefined) res.end('reached')
    else handle(req, res, port)
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const { port } = server.address() as AddressInfo
  const close = async (): Promise<void> => {
    server.closeAllConnections()
    await new Promise<void>((resolve) => server.close(() => { resolve() }))
  }
  return { port, hits, close }
}
