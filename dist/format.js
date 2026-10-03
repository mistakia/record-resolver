function text(value) {
    if (typeof value !== 'string')
        return undefined;
    const trimmed = value.trim();
    return trimmed === '' ? undefined : trimmed;
}
function text_list(value) {
    if (!Array.isArray(value))
        return undefined;
    return text(value.map(text).filter((item) => item !== undefined).join(', '));
}
function first_text(...values) {
    return values.find((value) => value !== undefined);
}
function identifier(value) {
    if (typeof value === 'number' && Number.isFinite(value))
        return String(value);
    return text(value);
}
function duration(value) {
    return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined;
}
function headers(value) {
    if (value === null || typeof value !== 'object' || Array.isArray(value))
        return undefined;
    const entries = Object.entries(value).filter((entry) => typeof entry[1] === 'string');
    return entries.length === 0 ? undefined : Object.fromEntries(entries);
}
function assign_defined(target, fields) {
    for (const [key, value] of Object.entries(fields)) {
        if (value !== undefined)
            target[key] = value;
    }
    return target;
}
// Maps one yt-dlp info object to a resolved entry. Returns undefined when the
// object lacks the extractor, id or direct url every entry must carry.
export function format_entry(raw) {
    if (raw === null || typeof raw !== 'object' || Array.isArray(raw))
        return undefined;
    const info = raw;
    // `extractor` before `extractor_key`: it matches the legacy keys and the
    // §2.4.2 examples ("youtube", "bandcamp").
    const extractor = first_text(text(info['extractor']), text(info['extractor_key']))?.toLowerCase();
    const id = identifier(info['id']);
    const url = text(info['url']);
    if (extractor === undefined || id === undefined || url === undefined)
        return undefined;
    return assign_defined({ extractor, id, url }, {
        fulltitle: first_text(text(info['fulltitle']), text(info['title'])),
        thumbnail: text(info['thumbnail']),
        artist: first_text(text(info['artist']), text_list(info['artists']), text(info['creator']), text_list(info['creators']), text(info['uploader'])),
        alt_title: first_text(text(info['alt_title']), text(info['track'])),
        upload_date: text(info['upload_date']),
        webpage_url: text(info['webpage_url']),
        duration: duration(info['duration']),
        ext: text(info['ext']),
        http_headers: headers(info['http_headers'])
    });
}
// The persistable §2.4.2 entry. Copies only the spec fields, so the streaming
// url, the download headers and anything else ephemeral never reach the log.
export function to_resolver_entry(entry) {
    return assign_defined({ extractor: entry.extractor, id: entry.id }, {
        fulltitle: entry.fulltitle,
        thumbnail: entry.thumbnail,
        artist: entry.artist,
        alt_title: entry.alt_title,
        upload_date: entry.upload_date,
        webpage_url: entry.webpage_url,
        duration: entry.duration
    });
}
