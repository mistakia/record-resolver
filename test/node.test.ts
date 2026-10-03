// record-app embeds record-node, and with it this package, under Node. These
// tests run the committed dist/ build under `node`, not Bun.
import { describe, expect, test } from 'bun:test'
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

import { FAKE_YTDLP } from './helpers.ts'

const DIST = join(import.meta.dir, '..', 'dist')
const URL_UNDER_TEST = 'https://soundcloud.com/skrillex/with-you-friends-long-drive'

function run_node (args: string[], env: Record<string, string> = {}) {
  const result = spawnSync('node', args, {
    encoding: 'utf8',
    env: { ...process.env, FAKE_YTDLP_FIXTURE: 'soundcloud-track', ...env }
  })
  if (result.error !== undefined) throw result.error
  return result
}

describe('dist under node', () => {
  test('imports the package entry and resolves through yt-dlp', () => {
    const script = `
      import { resolve_url, to_resolver_entry, YTDLP_VERSION } from ${JSON.stringify(pathToFileURL(join(DIST, 'index.js')).href)}
      const entries = await resolve_url(${JSON.stringify(URL_UNDER_TEST)}, { binary_path: ${JSON.stringify(FAKE_YTDLP)} })
      console.log(JSON.stringify({ runtime: typeof Bun, version: YTDLP_VERSION, persisted: entries.map(to_resolver_entry) }))
    `
    const result = run_node(['--input-type=module', '--eval', script])
    expect(result.stderr).toBe('')
    expect(result.status).toBe(0)
    const output = JSON.parse(result.stdout) as { runtime: string, persisted: Array<Record<string, unknown>> }
    expect(output.runtime).toBe('undefined')
    expect(output.persisted).toHaveLength(1)
    expect(output.persisted[0]).toMatchObject({ extractor: 'soundcloud', id: '21792171' })
    expect(output.persisted[0]).not.toHaveProperty('url')
  })

  test('the CLI prints resolved entries and exits 0', () => {
    const result = run_node([join(DIST, 'cli.js'), '--binary', FAKE_YTDLP, URL_UNDER_TEST])
    expect(result.status).toBe(0)
    expect(result.stderr).toBe('')
    const entries = JSON.parse(result.stdout) as Array<Record<string, unknown>>
    expect(entries[0]).toMatchObject({ extractor: 'soundcloud', id: '21792171', url: 'https://media.invalid/soundcloud/21792171.mp3' })
  })

  test('the CLI warns on a yt-dlp version mismatch and still resolves', () => {
    const result = run_node([join(DIST, 'cli.js'), '--binary', FAKE_YTDLP, URL_UNDER_TEST], { FAKE_YTDLP_VERSION: '2025.01.01' })
    expect(result.status).toBe(0)
    expect(result.stderr).toContain('warning: yt-dlp 2025.01.01 is installed')
  })

  test('the CLI exits 2 on invalid input and 1 on a resolution failure', () => {
    expect(run_node([join(DIST, 'cli.js'), '--binary', FAKE_YTDLP, 'not a url']).status).toBe(2)
    expect(run_node([join(DIST, 'cli.js'), '--binary', '/nonexistent/yt-dlp', 'not a url']).status).toBe(2)
    expect(run_node([join(DIST, 'cli.js'), '--binary', FAKE_YTDLP]).status).toBe(2)
    expect(run_node([join(DIST, 'cli.js'), '--binary', FAKE_YTDLP, '--timeout', 'soon', URL_UNDER_TEST]).status).toBe(2)
    expect(run_node([join(DIST, 'cli.js'), '--binary', FAKE_YTDLP, 'https://example.com/'], { FAKE_YTDLP_MODE: 'unsupported' }).status).toBe(1)
    expect(run_node([join(DIST, 'cli.js'), '--binary', '/nonexistent/yt-dlp', URL_UNDER_TEST]).status).toBe(1)
  })
})
