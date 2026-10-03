// bun cli/install-yt-dlp.ts <dest-dir>
//
// Installs the pinned yt-dlp zipapp (needs python3) to <dest-dir>/yt-dlp after
// verifying its SHA-256 against the pin in src/yt-dlp.ts. For CI and fixture
// recording; the library never downloads a binary.
import { createHash } from 'node:crypto'
import { chmod, mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

import { YTDLP_SHA256, YTDLP_VERSION } from '../src/yt-dlp.ts'

const dest_dir = process.argv[2]
if (dest_dir === undefined) {
  console.error('usage: bun cli/install-yt-dlp.ts <dest-dir>')
  process.exit(2)
}

const asset_url = `https://github.com/yt-dlp/yt-dlp/releases/download/${YTDLP_VERSION}/yt-dlp`
const response = await fetch(asset_url)
if (!response.ok) {
  console.error(`download failed: ${response.status} ${asset_url}`)
  process.exit(1)
}
const bytes = new Uint8Array(await response.arrayBuffer())
const sha256 = createHash('sha256').update(bytes).digest('hex')
if (sha256 !== YTDLP_SHA256) {
  console.error(`checksum mismatch for yt-dlp ${YTDLP_VERSION}: got ${sha256}, pinned ${YTDLP_SHA256}`)
  process.exit(1)
}

await mkdir(dest_dir, { recursive: true })
const binary_path = join(dest_dir, 'yt-dlp')
await writeFile(binary_path, bytes)
await chmod(binary_path, 0o755)
console.log(`installed yt-dlp ${YTDLP_VERSION} to ${binary_path}`)
