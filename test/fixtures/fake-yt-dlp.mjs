#!/usr/bin/env node
// Stands in for yt-dlp in the offline tests. Behaviour comes from env:
//   FAKE_YTDLP_FIXTURE    replay test/fixtures/yt-dlp/<name>.jsonl on stdout
//   FAKE_YTDLP_MODE       unsupported | fail | hang | garbage | strip-url
//   FAKE_YTDLP_VERSION    what --version prints
//   FAKE_YTDLP_ARGV_FILE  write the received argv there as JSON
import { readFileSync, writeFileSync } from 'node:fs'

const args = process.argv.slice(2)
const env = process.env
if (env.FAKE_YTDLP_ARGV_FILE) writeFileSync(env.FAKE_YTDLP_ARGV_FILE, JSON.stringify(args))

if (args.includes('--version')) {
  process.stdout.write(`${env.FAKE_YTDLP_VERSION ?? '2026.08.19'}\n`)
  process.exit(0)
}

const url = args.at(-1)
const fixture = () => readFileSync(new URL(`./yt-dlp/${env.FAKE_YTDLP_FIXTURE}.jsonl`, import.meta.url), 'utf8')

switch (env.FAKE_YTDLP_MODE) {
  case 'unsupported':
    process.stderr.write(`ERROR: Unsupported URL: ${url}\n`)
    process.exit(1)
    break
  case 'fail':
    process.stderr.write('[youtube] x: Downloading webpage\nERROR: [youtube] x: Video unavailable\n')
    process.exit(1)
    break
  case 'hang':
    setInterval(() => {}, 1000)
    break
  case 'garbage':
    process.stdout.write('this is not json\n')
    break
  case 'strip-url':
    for (const line of fixture().split('\n').filter(Boolean)) {
      const { url: _url, ...rest } = JSON.parse(line)
      process.stdout.write(`${JSON.stringify(rest)}\n`)
    }
    break
  default:
    process.stdout.write(fixture())
}
