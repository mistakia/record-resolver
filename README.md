# Record Resolver

Resolves audio URLs to Record Protocol v1 `ResolverEntry` records (spec section 2.4.2) using [yt-dlp](https://github.com/yt-dlp/yt-dlp). It is the URL resolution step of the section 6.4.2 URL ingest pipeline in [record-node](https://github.com/mistakia/record-node).

Runs under Node 22+ and Bun. It has no runtime npm dependencies.

## Requirements

yt-dlp is an external binary that the caller supplies; this package never downloads it. The supported release is pinned as `YTDLP_VERSION` (currently `2026.08.19`). `bun cli/install-yt-dlp.ts <dir>` installs that release after checking its SHA-256. The `yt-dlp` asset is a zipapp, so it needs `python3`.

The binary is found from the `binary_path` option, then the `YTDLP_PATH` environment variable, then `yt-dlp` on `PATH`.

## Usage

```ts
import { check_ytdlp_version, resolve_url, to_resolver_entry } from 'record-resolver'

const check = await check_ytdlp_version()
if (!check.matches) console.warn(`yt-dlp ${check.version} installed, ${check.pinned} pinned`)

const resolved = await resolve_url('https://soundcloud.com/skrillex/with-you-friends-long-drive')
for (const entry of resolved) {
  // entry.url is a direct HTTP(S) audio URL, sent with entry.http_headers
  const persisted = to_resolver_entry(entry) // drops url, ext and http_headers
}
```

`resolve_url(url, options?)` returns `ResolvedEntry[]`: the section 2.4.2 fields plus the ephemeral `url`, `ext` and `http_headers`. The spec forbids persisting the streaming `url`, so pass every entry through `to_resolver_entry` before it reaches a log. Absent optional fields are omitted, never `undefined` or `null`.

Options:

- `binary_path` — the yt-dlp binary
- `timeout_ms` — default 60000
- `playlist` — default `false`. Resolves every entry of a URL that names both an item and its playlist. A URL that names only a playlist resolves to all its entries either way.
- `lookup` — DNS lookup for the destination check; defaults to `node:dns`

`resolve_url` refuses a URL whose host is not public before yt-dlp runs: every address the host resolves to must lie outside the unspecified, loopback, private, shared (CGNAT), link-local, unique-local, site-local, multicast and reserved ranges, including IPv4 addresses embedded in IPv4-mapped, NAT64 and 6to4 IPv6 addresses. yt-dlp resolves the host again and follows redirects itself, so this check does not bind what yt-dlp connects to. A caller that fetches a resolved `url` checks it with the same exports: `guarded_lookup` is a `lookup` for `http.request` and `https.request` that refuses the connection unless every resolved address is public, and `address_class` classifies an IP-literal host, which skips lookup.

Failures throw `ResolverError` with a `code`: `MISSING_URL`, `INVALID_URL`, `BLOCKED_DESTINATION`, `UNSUPPORTED_URL`, `YTDLP_NOT_FOUND`, `YTDLP_FAILED`, `YTDLP_TIMEOUT` or `YTDLP_INVALID_OUTPUT`.

### CLI

```
record-resolver [--playlist] [--binary <path>] [--timeout <ms>] <url>
```

Prints the resolved entries as JSON. Exits 0 on success, 1 on a resolution failure, and 2 on invalid input.

## Development

```
bun install --ignore-scripts
bun run verify        # lint, typecheck, and check dist/ is current
bun test              # offline: recorded fixtures through a fake yt-dlp, plus a Node run of dist/
bun run test:network  # opt-in: live sites through the pinned yt-dlp
bun run build         # rebuild dist/ after changing src/
```

`dist/` is committed because consumers install this package as a git dependency with install scripts disabled, and Node does not strip types under `node_modules`.

Fixtures under `test/fixtures/yt-dlp/` are recorded with the pinned yt-dlp by `YTDLP_PATH=<pinned yt-dlp> bun cli/record-fixtures.ts`. The recorder keeps metadata fields only and replaces streaming URLs and request headers with placeholders.

## License

MIT
