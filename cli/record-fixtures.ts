// YTDLP_PATH=<pinned yt-dlp> bun cli/record-fixtures.ts
//
// Re-records test/fixtures/yt-dlp/<name>.jsonl from live sites with the same
// arguments resolve_url uses. Each file mirrors yt-dlp's stdout: one JSON
// object per line. Only metadata fields are kept, and the streaming url and
// request headers are replaced with placeholders: live values embed the
// recorder's IP address and signed tokens, and this repository is public.
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'

import { check_ytdlp_version, dump_json } from '../src/yt-dlp.ts'

const FIXTURES: Record<string, { url: string, playlist?: boolean }> = {
  'youtube-video': { url: 'https://www.youtube.com/watch?v=iODdvJGpfIA' },
  'soundcloud-track': { url: 'https://soundcloud.com/skrillex/with-you-friends-long-drive' },
  'bandcamp-track': { url: 'https://youtube-dl.bandcamp.com/track/youtube-dl-test-song' },
  'mixcloud-show': { url: 'https://www.mixcloud.com/johndigweed/transitions-with-john-digweed-and-chymera/' },
  'bandcamp-album': { url: 'https://blazo.bandcamp.com/album/jazz-format-mixtape-vol-1', playlist: true }
}

const KEPT_FIELDS = [
  'id', 'extractor', 'extractor_key', 'title', 'fulltitle', 'alt_title', 'track',
  'artist', 'artists', 'creator', 'creators', 'uploader', 'uploader_id', 'album',
  'upload_date', 'timestamp', 'duration', 'thumbnail', 'webpage_url',
  'format_id', 'ext', 'protocol', 'acodec', 'vcodec', 'abr',
  'playlist', 'playlist_id', 'playlist_index'
]

const PLACEHOLDER_HEADERS = { 'User-Agent': 'record-resolver-fixture', Accept: '*/*' }

function sanitize (raw: unknown): Record<string, unknown> {
  const info = raw as Record<string, unknown>
  const kept: Record<string, unknown> = {}
  for (const field of KEPT_FIELDS) {
    if (field in info) kept[field] = info[field]
  }
  kept['url'] = `https://media.invalid/${String(info['extractor'])}/${String(info['id'])}.${String(info['ext'])}`
  kept['http_headers'] = PLACEHOLDER_HEADERS
  return kept
}

const fixtures_dir = join(import.meta.dir, '..', 'test', 'fixtures', 'yt-dlp')
const check = await check_ytdlp_version()
if (!check.matches) {
  console.error(`refusing to record with yt-dlp ${check.version}; fixtures are recorded with the pinned ${check.pinned}`)
  process.exit(1)
}

for (const [name, { url, playlist = false }] of Object.entries(FIXTURES)) {
  const entries = await dump_json({ url, playlist, timeout_ms: 300_000 })
  const lines = entries.map((entry) => JSON.stringify(sanitize(entry)))
  await writeFile(join(fixtures_dir, `${name}.jsonl`), `${lines.join('\n')}\n`)
  console.log(`${name}: ${entries.length} entries`)
}
