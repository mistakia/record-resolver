import { afterAll, afterEach, describe, expect, test } from 'bun:test'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { ResolverError } from '../src/errors.ts'
import { format_entry } from '../src/format.ts'
import { resolve_url } from '../src/resolve.ts'
import { check_ytdlp_version, FORMAT_SELECTOR, YTDLP_VERSION } from '../src/yt-dlp.ts'
import { FAKE_YTDLP, FIXTURES_DIR, load_fixture, set_fake_env } from './helpers.ts'

const URL_UNDER_TEST = 'https://soundcloud.com/skrillex/with-you-friends-long-drive'

let restore_env: (() => void) | undefined
afterEach(() => {
  restore_env?.()
  restore_env = undefined
})

function fake (values: Record<string, string>): void {
  restore_env = set_fake_env(values)
}

async function rejection (promise: Promise<unknown>): Promise<ResolverError> {
  try {
    await promise
  } catch (error) {
    if (error instanceof ResolverError) return error
    throw error
  }
  throw new Error('expected a ResolverError')
}

describe('resolve_url through yt-dlp', () => {
  test('returns the formatted fixture entries', async () => {
    fake({ FAKE_YTDLP_FIXTURE: 'soundcloud-track' })
    const entries = await resolve_url(URL_UNDER_TEST, { binary_path: FAKE_YTDLP })
    expect(entries).toEqual(load_fixture('soundcloud-track').map(format_entry) as typeof entries)
  })

  test('resolves every playlist entry', async () => {
    fake({ FAKE_YTDLP_FIXTURE: 'bandcamp-album' })
    const entries = await resolve_url('https://blazo.bandcamp.com/album/jazz-format-mixtape-vol-1', { binary_path: FAKE_YTDLP, playlist: true })
    expect(entries).toHaveLength(22)
    expect(new Set(entries.map((entry) => entry.id)).size).toBe(22)
    expect(entries.every((entry) => entry.extractor === 'bandcamp')).toBe(true)
  })

  test('falls back to YTDLP_PATH when no binary_path is given', async () => {
    fake({ FAKE_YTDLP_FIXTURE: 'youtube-video', YTDLP_PATH: FAKE_YTDLP })
    const [entry] = await resolve_url('https://www.youtube.com/watch?v=iODdvJGpfIA')
    expect(entry?.id).toBe('iODdvJGpfIA')
  })

  test('treats an empty YTDLP_PATH as unset', async () => {
    fake({ YTDLP_PATH: '' })
    const saved_path = process.env['PATH']
    process.env['PATH'] = ''
    try {
      const error = await rejection(resolve_url(URL_UNDER_TEST))
      expect(error.code).toBe('YTDLP_NOT_FOUND')
      expect(error.message).toContain('at yt-dlp:')
    } finally {
      process.env['PATH'] = saved_path
    }
  })

  test('trims surrounding whitespace from the url', async () => {
    fake({ FAKE_YTDLP_FIXTURE: 'soundcloud-track' })
    const entries = await resolve_url(`  ${URL_UNDER_TEST}\n`, { binary_path: FAKE_YTDLP })
    expect(entries).toHaveLength(1)
  })
})

describe('yt-dlp arguments', () => {
  const argv_dir = mkdtempSync(join(tmpdir(), 'record-resolver-argv-'))
  const argv_file = join(argv_dir, 'argv.json')
  afterEach(() => { rmSync(argv_file, { force: true }) })
  afterAll(() => { rmSync(argv_dir, { recursive: true, force: true }) })

  async function argv_for (playlist: boolean): Promise<string[]> {
    fake({ FAKE_YTDLP_FIXTURE: 'soundcloud-track', FAKE_YTDLP_ARGV_FILE: argv_file })
    await resolve_url(URL_UNDER_TEST, { binary_path: FAKE_YTDLP, playlist })
    return JSON.parse(readFileSync(argv_file, 'utf8')) as string[]
  }

  test('single-entry by default, with the audio format selector and the url last after --', async () => {
    const argv = await argv_for(false)
    expect(argv).toContain('--ignore-config')
    expect(argv).toContain('--dump-json')
    expect(argv).toContain('--no-playlist')
    expect(argv).not.toContain('--yes-playlist')
    expect(argv).not.toContain('--flat-playlist')
    expect(argv[argv.indexOf('--format') + 1]).toBe(FORMAT_SELECTOR)
    expect(argv.slice(-2)).toEqual(['--', URL_UNDER_TEST])
  })

  test('--yes-playlist when playlist is set', async () => {
    const argv = await argv_for(true)
    expect(argv).toContain('--yes-playlist')
    expect(argv).not.toContain('--no-playlist')
  })
})

describe('resolve_url errors', () => {
  test('MISSING_URL for an empty or non-string url', async () => {
    expect((await rejection(resolve_url(''))).code).toBe('MISSING_URL')
    expect((await rejection(resolve_url('   '))).code).toBe('MISSING_URL')
    expect((await rejection(resolve_url(undefined as unknown as string))).code).toBe('MISSING_URL')
  })

  test('INVALID_URL for an unparseable or non-http url, before yt-dlp runs', async () => {
    const options = { binary_path: '/nonexistent/yt-dlp' }
    for (const url of ['not a url', 'file:///etc/passwd', 'ftp://example.com/a.mp3', 'javascript:alert(1)']) {
      expect((await rejection(resolve_url(url, options))).code).toBe('INVALID_URL')
    }
  })

  test('YTDLP_NOT_FOUND for a missing binary', async () => {
    const error = await rejection(resolve_url(URL_UNDER_TEST, { binary_path: '/nonexistent/yt-dlp' }))
    expect(error.code).toBe('YTDLP_NOT_FOUND')
  })

  test('YTDLP_NOT_FOUND for a file that is not executable', async () => {
    const error = await rejection(resolve_url(URL_UNDER_TEST, { binary_path: join(FIXTURES_DIR, 'yt-dlp', 'soundcloud-track.jsonl') }))
    expect(error.code).toBe('YTDLP_NOT_FOUND')
  })

  test('UNSUPPORTED_URL when no extractor matches', async () => {
    fake({ FAKE_YTDLP_MODE: 'unsupported' })
    const error = await rejection(resolve_url('https://example.com/', { binary_path: FAKE_YTDLP }))
    expect(error.code).toBe('UNSUPPORTED_URL')
    expect(error.url).toBe('https://example.com/')
  })

  test('YTDLP_FAILED carries the last ERROR line and stderr', async () => {
    fake({ FAKE_YTDLP_MODE: 'fail' })
    const error = await rejection(resolve_url(URL_UNDER_TEST, { binary_path: FAKE_YTDLP }))
    expect(error.code).toBe('YTDLP_FAILED')
    expect(error.message).toContain('ERROR: [youtube] x: Video unavailable')
    expect(error.stderr).toContain('Downloading webpage')
  })

  test('YTDLP_TIMEOUT kills a hung yt-dlp', async () => {
    fake({ FAKE_YTDLP_MODE: 'hang' })
    const started = Date.now()
    const error = await rejection(resolve_url(URL_UNDER_TEST, { binary_path: FAKE_YTDLP, timeout_ms: 300 }))
    expect(error.code).toBe('YTDLP_TIMEOUT')
    expect(Date.now() - started).toBeLessThan(5000)
  })

  test('YTDLP_INVALID_OUTPUT for output that is not JSON', async () => {
    fake({ FAKE_YTDLP_MODE: 'garbage' })
    expect((await rejection(resolve_url(URL_UNDER_TEST, { binary_path: FAKE_YTDLP }))).code).toBe('YTDLP_INVALID_OUTPUT')
  })

  test('YTDLP_INVALID_OUTPUT for an entry without a direct url', async () => {
    fake({ FAKE_YTDLP_MODE: 'strip-url', FAKE_YTDLP_FIXTURE: 'bandcamp-album' })
    const error = await rejection(resolve_url(URL_UNDER_TEST, { binary_path: FAKE_YTDLP, playlist: true }))
    expect(error.code).toBe('YTDLP_INVALID_OUTPUT')
  })
})

describe('check_ytdlp_version', () => {
  test('matches the pinned version', async () => {
    fake({})
    expect(await check_ytdlp_version({ binary_path: FAKE_YTDLP })).toEqual({ version: YTDLP_VERSION, pinned: YTDLP_VERSION, matches: true })
  })

  test('reports a mismatch without throwing', async () => {
    fake({ FAKE_YTDLP_VERSION: '2025.01.01' })
    expect(await check_ytdlp_version({ binary_path: FAKE_YTDLP })).toEqual({ version: '2025.01.01', pinned: YTDLP_VERSION, matches: false })
  })

  test('YTDLP_NOT_FOUND for a missing binary', async () => {
    expect((await rejection(check_ytdlp_version({ binary_path: '/nonexistent/yt-dlp' }))).code).toBe('YTDLP_NOT_FOUND')
  })
})
