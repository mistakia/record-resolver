// Live-site checks against a real yt-dlp. Opt-in: `bun run test:network`
// (sets RECORD_RESOLVER_NETWORK=1), with the pinned binary on PATH or in
// YTDLP_PATH. Skipped in the default `bun test`.
//
// The load-bearing assertion is that each site still resolves to the
// (extractor, id) recorded in the fixtures: that pair is the §2.4.2 cache key,
// so a drift there means duplicate tracks on re-ingest.
import { describe, expect, test } from 'bun:test'

import { format_entry } from '../../src/format.ts'
import { resolve_url } from '../../src/resolve.ts'
import type { ResolverEntry } from '../../src/types.ts'
import { check_ytdlp_version } from '../../src/yt-dlp.ts'
import { load_fixture } from '../helpers.ts'

const SITES: Array<{ fixture: string, url: string, playlist?: boolean }> = [
  { fixture: 'youtube-video', url: 'https://www.youtube.com/watch?v=iODdvJGpfIA' },
  { fixture: 'soundcloud-track', url: 'https://soundcloud.com/skrillex/with-you-friends-long-drive' },
  { fixture: 'bandcamp-track', url: 'https://youtube-dl.bandcamp.com/track/youtube-dl-test-song' },
  { fixture: 'mixcloud-show', url: 'https://www.mixcloud.com/johndigweed/transitions-with-john-digweed-and-chymera/' },
  { fixture: 'bandcamp-album', url: 'https://blazo.bandcamp.com/album/jazz-format-mixtape-vol-1', playlist: true }
]

const TIMEOUT_MS = 300_000

describe.skipIf(process.env['RECORD_RESOLVER_NETWORK'] !== '1')('live resolution', () => {
  test('the installed yt-dlp is the pinned version', async () => {
    const check = await check_ytdlp_version()
    expect(check.version).toBe(check.pinned)
  })

  for (const { fixture, url, playlist = false } of SITES) {
    test(`${fixture} resolves to its recorded (extractor, id) with a direct url`, async () => {
      const entries = await resolve_url(url, { playlist, timeout_ms: TIMEOUT_MS })
      const recorded = load_fixture(fixture).map(format_entry)
      const key = (entry: ResolverEntry | undefined) => `${entry?.extractor}:${entry?.id}`
      expect(entries.map(key)).toEqual(recorded.map(key))
      for (const entry of entries) expect(entry.url).toMatch(/^https?:\/\//)
    }, TIMEOUT_MS)
  }
})
