import { ResolverError } from "./errors.js";
import { format_entry } from "./format.js";
import { dump_json } from "./yt-dlp.js";
// Returns the trimmed url, or throws MISSING_URL or INVALID_URL.
export function validate_url(url) {
    if (typeof url !== 'string' || url.trim() === '') {
        throw new ResolverError({ code: 'MISSING_URL', message: 'missing url' });
    }
    const trimmed = url.trim();
    let parsed;
    try {
        parsed = new URL(trimmed);
    }
    catch (error) {
        throw new ResolverError({ code: 'INVALID_URL', message: `not a valid url: ${trimmed}`, url: trimmed, cause: error });
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        throw new ResolverError({ code: 'INVALID_URL', message: `not an http(s) url: ${trimmed}`, url: trimmed });
    }
    return trimmed;
}
// Resolves a URL to one entry per audio item it names (spec §6.4.2 step 1).
// Every entry carries a direct `url` for the download step; strip it with
// to_resolver_entry before persisting (§2.4.2).
export async function resolve_url(url, options = {}) {
    const valid_url = validate_url(url);
    const raw_entries = await dump_json({
        url: valid_url,
        binary_path: options.binary_path,
        timeout_ms: options.timeout_ms,
        playlist: options.playlist
    });
    return raw_entries.map((raw, index) => {
        const entry = format_entry(raw);
        if (entry === undefined) {
            throw new ResolverError({
                code: 'YTDLP_INVALID_OUTPUT',
                message: `yt-dlp entry ${index} lacks an extractor, id or direct url`,
                url: valid_url
            });
        }
        return entry;
    });
}
