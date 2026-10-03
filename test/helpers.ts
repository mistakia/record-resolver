import { readFileSync } from 'node:fs'
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
