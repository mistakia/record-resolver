import type { LookupAll } from './destination.ts'

// The persistable resolver record, exactly spec §2.4.2. Optional fields are
// omitted when absent, never undefined or null, so the object encodes as
// dag-cbor unchanged.
export interface ResolverEntry {
  extractor: string
  id: string
  fulltitle?: string
  thumbnail?: string
  artist?: string
  alt_title?: string
  upload_date?: string
  webpage_url?: string
  duration?: number
}

// What resolve_url returns: the §2.4.2 entry plus the ephemeral fields the
// §6.4.2 download step needs. None of them may be persisted; pass the record
// through to_resolver_entry before it reaches the log.
export interface ResolvedEntry extends ResolverEntry {
  // Direct HTTP(S) URL of the selected audio file. Short-lived and often signed.
  url: string
  // File extension of the selected format, e.g. "m4a".
  ext?: string
  // Request headers yt-dlp would send; some hosts reject a download without them.
  http_headers?: Record<string, string>
}

export interface ResolveOptions {
  // yt-dlp binary; defaults to YTDLP_PATH, then `yt-dlp` on PATH.
  binary_path?: string
  // Kill yt-dlp after this long. Default 60000.
  timeout_ms?: number
  // Resolve every entry of a URL that names both an item and its playlist.
  // Default false. A URL that names only a playlist resolves to all its
  // entries either way.
  playlist?: boolean
  // DNS lookup for the destination check. Defaults to node:dns lookup.
  lookup?: LookupAll
}
