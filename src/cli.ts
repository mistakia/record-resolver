#!/usr/bin/env node
// record-resolver [--playlist] [--binary <path>] [--timeout <ms>] <url>
//
// Prints the resolved entries as a JSON array, including the ephemeral
// download fields. Exit 0 on success, 1 on a resolution failure, 2 on invalid
// input.
import { parseArgs } from 'node:util'

import { ResolverError } from './errors.ts'
import { resolve_url, validate_url } from './resolve.ts'
import type { ResolveOptions } from './types.ts'
import { check_ytdlp_version } from './yt-dlp.ts'

const USAGE = 'usage: record-resolver [--playlist] [--binary <path>] [--timeout <ms>] <url>'
const INPUT_ERRORS = new Set(['MISSING_URL', 'INVALID_URL', 'BLOCKED_DESTINATION'])

function fail (message: string, exit_code: number): never {
  process.stderr.write(`${message}\n`)
  process.exit(exit_code)
}

async function main (): Promise<void> {
  let parsed
  try {
    parsed = parseArgs({
      allowPositionals: true,
      options: {
        playlist: { type: 'boolean', default: false },
        binary: { type: 'string' },
        timeout: { type: 'string' },
        help: { type: 'boolean', short: 'h', default: false }
      }
    })
  } catch (error) {
    fail(`${(error as Error).message}\n${USAGE}`, 2)
  }
  const { values, positionals } = parsed
  if (values.help) {
    process.stdout.write(`${USAGE}\n`)
    return
  }
  if (positionals.length !== 1) fail(USAGE, 2)

  const options: ResolveOptions = { playlist: values.playlist }
  if (values.binary !== undefined) options.binary_path = values.binary
  if (values.timeout !== undefined) {
    const timeout_ms = Number(values.timeout)
    if (!Number.isInteger(timeout_ms) || timeout_ms <= 0) fail(`--timeout must be a positive integer\n${USAGE}`, 2)
    options.timeout_ms = timeout_ms
  }

  try {
    const url = validate_url(positionals[0])
    const check = await check_ytdlp_version({ ...(options.binary_path === undefined ? {} : { binary_path: options.binary_path }) })
    if (!check.matches) {
      process.stderr.write(`warning: yt-dlp ${check.version} is installed; record-resolver is pinned to ${check.pinned}\n`)
    }
    const entries = await resolve_url(url, options)
    process.stdout.write(`${JSON.stringify(entries, null, 2)}\n`)
  } catch (error) {
    if (error instanceof ResolverError) {
      fail(`${error.code}: ${error.message}`, INPUT_ERRORS.has(error.code) ? 2 : 1)
    }
    throw error
  }
}

await main()
